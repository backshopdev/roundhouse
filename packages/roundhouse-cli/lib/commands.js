"use strict";

/**
 * commands.js
 *
 * The three command implementations (SPEC-20261019-02, Public contracts,
 * Command semantics): init, compose, verify. Each is a run(options)-style
 * function returning { code, messages } WITHOUT exiting, so tests exercise
 * commands in-process; the bin (WP-03) maps results onto process exit
 * codes and routes messages to stderr. Exit codes: 0 success, 1 failure;
 * exit 2 (usage error) arises at the bin's argv layer, not here.
 *
 * Canonical content (PLAN-20261023-01): every content path — the managed
 * hashes (via model.js's canonical read), the managed/seed writes (via
 * materialize.js), the template hash, and verify check 5's comparison —
 * consumes the one canonicalization function (lib/canonical.js): UTF-8/LF,
 * CRLF normalized at ingestion. Check 4 stays raw byte-equality by design.
 *
 * Pipeline (all validation precedes any write — fail-closed composition):
 *   discovery (triage: vocabulary) -> model assembly (bidirectional skill
 *   content) -> template validation (exactly one core) -> graph validation
 *   (nine set-level checks) -> render -> materialize -> manifest.
 * A failing stage reports its findings and stops; nothing is written.
 *
 * init — for a fresh consumer: guard (an existing manifest is an error
 * directing to compose) -> validate -> create .roundhouse/manifest.json ->
 * compose managed artifacts and the rendered opencode.json -> create
 * missing seed artifacts. init never deletes: no stale removal, no seed
 * overwrite. The guard is the manifest's presence, per the spec; an
 * existing opencode.json without a manifest is overwritten (composed
 * artifacts regenerate).
 *
 * compose — requires an existing manifest (exit 1 directing to init
 * otherwise): re-discover -> recompute -> validate -> update managed
 * artifacts -> remove stale managed files by recorded ownership (each
 * removal logged; never-recorded files untouched) -> regenerate
 * opencode.json -> create newly applicable seeds only when missing ->
 * refresh .roundhouse/manifest.json.
 *
 * verify — read-only; requires an existing manifest (exit 1 directing to
 * init otherwise). The seven checks: (1) recorded packages resolve;
 * (2) contracts are compatible; (3) ownership is conflict-free; (4) the
 * effective opencode.json matches the recomputed composition (byte-equality
 * against the canonical re-render); (5) managed files match package
 * sources; (6) no tracked managed file is stale (tracked-and-unexpectedly-
 * missing is realized through check 5's missing report); (7) expected seed
 * files that have never been created are reported. Verify writes nothing;
 * exit 1 on any finding, 0 when clean.
 *
 * Every rejection, removal, creation, and warning is collected in
 * `messages` (the bin routes them to stderr); there are zero silent
 * mutations. Injection seams follow the generator's run(options) pattern:
 * every pipeline stage is replaceable via options for in-process tests.
 *
 * Runtime: Node 24, built-in modules only.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const discovery = require("./discovery");
const model = require("./model");
const template = require("./template");
const graph = require("./graph");
const render = require("./render");
const manifest = require("./manifest");
const materialize = require("./materialize");
const vocabulary = require("./vocabulary");
const { canonicalize } = require("./canonical");
const { lstatIfPresent, assertSafePath, revalidateMutationPath, mkdirSafe } = require("./safe-fs");

// ─── Pure helpers ───────────────────────────────────────────────────────────

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function manifestPathIn(consumerRoot) {
  return path.join(consumerRoot, ...manifest.MANIFEST_RELATIVE_PATH.split("/"));
}

function renderedPathIn(consumerRoot) {
  return path.join(consumerRoot, manifest.RENDERED_RELATIVE_PATH);
}

// ─── Injection seams ────────────────────────────────────────────────────────

/**
 * The CLI's own identity for the manifest's composer member:
 * "<name>@<version>" from this package's package.json.
 */
function readComposerIdentity() {
  const identityPath = path.join(__dirname, "..", "package.json");
  const parsed = JSON.parse(fs.readFileSync(identityPath, "utf8"));
  if (typeof parsed.name !== "string" || typeof parsed.version !== "string") {
    throw new Error(`the CLI package.json at ${identityPath} has no usable name/version`);
  }
  return `${parsed.name}@${parsed.version}`;
}

function resolveDeps(options) {
  return {
    discoverPackages: options.discoverPackages ?? discovery.discoverPackages,
    buildModels: options.buildModels ?? model.run,
    validateTemplateSource: options.validateTemplateSource ?? template.validateTemplateSource,
    validateGraph: options.validateGraph ?? graph.validateGraph,
    renderOpencode: options.renderOpencode ?? render.renderOpencode,
    serializeRendered: options.serializeRendered ?? render.serializeRendered,
    buildManifest: options.buildManifest ?? manifest.buildManifest,
    serializeManifest: options.serializeManifest ?? manifest.serializeManifest,
    parseManifest: options.parseManifest ?? manifest.parseManifest,
    validateManifest: options.validateManifest ?? manifest.validateManifest,
    copyManaged: options.copyManaged ?? materialize.copyManaged,
    removeStaleManaged: options.removeStaleManaged ?? materialize.removeStaleManaged,
    createMissingSeeds: options.createMissingSeeds ?? materialize.createMissingSeeds,
    computeStaleManaged: options.computeStaleManaged ?? materialize.computeStaleManaged,
    collectRecordedManagedPaths: options.collectRecordedManagedPaths ?? materialize.collectRecordedManagedPaths,
    collectOwnedManagedPaths: options.collectOwnedManagedPaths ?? materialize.collectOwnedManagedPaths,
    composer: options.composer ?? readComposerIdentity(),
  };
}

// ─── Shared composition pipeline ────────────────────────────────────────────

/**
 * Discover, assemble, and validate the composition. Returns
 * { ok: true, models, template, templateSha256, graphViolations } or
 * { ok: false } with the failure messages pushed onto `messages`.
 *
 * Discovery and model failures abort (ok: false): without models nothing
 * downstream is computable. Template validation aborts when exactly one
 * core exists but its template is invalid (render impossible); with a
 * wrong core count the template is null and graph check 8 reports the
 * core-count violation. Graph violations are RETURNED, not aborted on:
 * init/compose treat a non-empty set as fatal (composition must not
 * proceed), while verify collects them as findings and still evaluates
 * its remaining checks against the recomputed models.
 */
function computeComposition(consumerRoot, deps, messages) {
  const discoveryResult = deps.discoverPackages(consumerRoot);
  messages.push(...discoveryResult.warnings);
  if (discoveryResult.failures.length > 0) {
    messages.push(...discoveryResult.failures);
    return { ok: false };
  }
  const modelResult = deps.buildModels({ candidates: discoveryResult.discovered });
  if (modelResult.failures.length > 0) {
    messages.push(...modelResult.failures);
    return { ok: false };
  }
  const models = modelResult.models;
  const cores = models.filter((candidate) => candidate.kind === "core");
  let compiledTemplate = null;
  let templateSha256 = null;
  if (cores.length === 1) {
    const core = cores[0];
    const templatePath = path.join(core.root, "opencode-template.json");
    let raw;
    try {
      raw = fs.readFileSync(templatePath);
    } catch (error) {
      messages.push(`Error: core package ${core.name} has no readable opencode-template.json at the pinned location: ${error.message}`);
      return { ok: false };
    }
    // The template read canonicalizes (PLAN-20261023-01 WP-01, T-04): the
    // composed entry's templateSha256 is computed over canonical content
    // (UTF-8/LF), making it structurally platform-independent rather than
    // stable by the template's working-tree encoding. Parse and validate
    // from the canonical text; the validation contract is unchanged.
    raw = canonicalize(raw);
    templateSha256 = sha256(raw);
    const violations = deps.validateTemplateSource(raw.toString("utf8"));
    if (violations.length > 0) {
      messages.push(...violations.map((violation) => `Error: ${core.name}: ${violation}`));
      return { ok: false };
    }
    compiledTemplate = JSON.parse(raw.toString("utf8"));
  }
  const graphViolations = deps.validateGraph(models, compiledTemplate);
  return { ok: true, models, template: compiledTemplate, templateSha256, graphViolations };
}

// ─── Write-phase helpers (I/O) ──────────────────────────────────────────────

function writeManifestFile(consumerRoot, bytes, messages) {
  const manifestPath = manifestPathIn(consumerRoot);
  const existed = lstatIfPresent(manifestPath) !== null;
  mkdirSafe(consumerRoot, path.join(consumerRoot, ".roundhouse"), "manifest directory");
  revalidateMutationPath(consumerRoot, manifestPath, "manifest");
  fs.writeFileSync(manifestPath, bytes, "utf8");
  messages.push(`${existed ? "Refreshed" : "Created"} manifest: ${manifest.MANIFEST_RELATIVE_PATH}`);
}

function writeRenderedFile(consumerRoot, bytes, messages) {
  const renderedPath = renderedPathIn(consumerRoot);
  assertSafePath(consumerRoot, renderedPath, "composed artifact");
  revalidateMutationPath(consumerRoot, renderedPath, "composed artifact");
  fs.writeFileSync(renderedPath, bytes, "utf8");
  messages.push(`Wrote composed artifact: ${manifest.RENDERED_RELATIVE_PATH}`);
}

// ─── init ───────────────────────────────────────────────────────────────────

function runInit(options = {}) {
  const messages = [];
  try {
    const deps = resolveDeps(options);
    const consumerRoot = path.resolve(options.consumerRoot ?? process.cwd());
    // State guard first (SCEN-065): an existing manifest directs to compose.
    if (lstatIfPresent(manifestPathIn(consumerRoot))) {
      messages.push(`Error: ${manifest.MANIFEST_RELATIVE_PATH} already exists; run compose to update an initialized consumer.`);
      return { code: 1, messages };
    }
    const composition = computeComposition(consumerRoot, deps, messages);
    if (!composition.ok) return { code: 1, messages };
    if (composition.graphViolations.length > 0) {
      messages.push(...composition.graphViolations.map((violation) => `Error: ${violation}`));
      return { code: 1, messages };
    }
    const rendered = deps.renderOpencode(composition.template, composition.models);
    const renderedBytes = deps.serializeRendered(rendered);
    const renderedSha256 = sha256(renderedBytes);
    const built = deps.buildManifest({
      composer: deps.composer,
      models: composition.models,
      renderedSha256,
      templateSha256: composition.templateSha256,
    });
    const manifestBytes = deps.serializeManifest(built);
    // Write phase, in the spec's order: manifest -> managed + rendered -> seeds.
    writeManifestFile(consumerRoot, manifestBytes, messages);
    deps.copyManaged({ consumerRoot, models: composition.models, log: (message) => messages.push(message) });
    writeRenderedFile(consumerRoot, renderedBytes, messages);
    deps.createMissingSeeds({ consumerRoot, models: composition.models, log: (message) => messages.push(message) });
    return { code: 0, messages };
  } catch (error) {
    messages.push(`Error: init failed: ${error.message}`);
    return { code: 1, messages };
  }
}

// ─── compose ────────────────────────────────────────────────────────────────

function runCompose(options = {}) {
  const messages = [];
  try {
    const deps = resolveDeps(options);
    const consumerRoot = path.resolve(options.consumerRoot ?? process.cwd());
    const existingManifestPath = manifestPathIn(consumerRoot);
    // State guard first (SCEN-065): no manifest directs to init.
    if (!lstatIfPresent(existingManifestPath)) {
      messages.push(`Error: no ${manifest.MANIFEST_RELATIVE_PATH} found; run init to create it.`);
      return { code: 1, messages };
    }
    let existing;
    try {
      existing = deps.parseManifest(fs.readFileSync(existingManifestPath, "utf8"));
    } catch (error) {
      messages.push(`Error: ${manifest.MANIFEST_RELATIVE_PATH} is not parseable JSON: ${error.message}`);
      return { code: 1, messages };
    }
    const manifestViolations = deps.validateManifest(existing);
    if (manifestViolations.length > 0) {
      messages.push(`Error: ${manifest.MANIFEST_RELATIVE_PATH} failed validation; nothing written:`);
      messages.push(...manifestViolations.map((violation) => `  - ${violation}`));
      return { code: 1, messages };
    }
    const composition = computeComposition(consumerRoot, deps, messages);
    if (!composition.ok) return { code: 1, messages };
    if (composition.graphViolations.length > 0) {
      messages.push(...composition.graphViolations.map((violation) => `Error: ${violation}`));
      return { code: 1, messages };
    }
    const recorded = deps.collectRecordedManagedPaths(existing);
    const owned = deps.collectOwnedManagedPaths(composition.models);
    const stale = deps.computeStaleManaged(recorded, owned);
    const rendered = deps.renderOpencode(composition.template, composition.models);
    const renderedBytes = deps.serializeRendered(rendered);
    const renderedSha256 = sha256(renderedBytes);
    const built = deps.buildManifest({
      composer: deps.composer,
      models: composition.models,
      renderedSha256,
      templateSha256: composition.templateSha256,
    });
    const manifestBytes = deps.serializeManifest(built);
    // Write phase, in the spec's order: update managed -> remove stale ->
    // regenerate -> seeds (only when missing) -> refresh manifest.
    deps.copyManaged({ consumerRoot, models: composition.models, log: (message) => messages.push(message) });
    deps.removeStaleManaged({ consumerRoot, stalePaths: stale, log: (message) => messages.push(message) });
    writeRenderedFile(consumerRoot, renderedBytes, messages);
    deps.createMissingSeeds({ consumerRoot, models: composition.models, log: (message) => messages.push(message) });
    writeManifestFile(consumerRoot, manifestBytes, messages);
    return { code: 0, messages };
  } catch (error) {
    messages.push(`Error: compose failed: ${error.message}`);
    return { code: 1, messages };
  }
}

// ─── verify ─────────────────────────────────────────────────────────────────

function runVerify(options = {}) {
  const messages = [];
  try {
    const deps = resolveDeps(options);
    const consumerRoot = path.resolve(options.consumerRoot ?? process.cwd());
    const existingManifestPath = manifestPathIn(consumerRoot);
    // State guard first (SCEN-065): no manifest directs to init.
    if (!lstatIfPresent(existingManifestPath)) {
      messages.push(`Error: no ${manifest.MANIFEST_RELATIVE_PATH} found; run init to create it.`);
      return { code: 1, messages };
    }
    let existing;
    try {
      existing = deps.parseManifest(fs.readFileSync(existingManifestPath, "utf8"));
    } catch (error) {
      messages.push(`Error: ${manifest.MANIFEST_RELATIVE_PATH} is not parseable JSON: ${error.message}`);
      return { code: 1, messages };
    }
    const manifestViolations = deps.validateManifest(existing);
    if (manifestViolations.length > 0) {
      messages.push(`Error: ${manifest.MANIFEST_RELATIVE_PATH} failed validation:`);
      messages.push(...manifestViolations.map((violation) => `  - ${violation}`));
      return { code: 1, messages };
    }
    const composition = computeComposition(consumerRoot, deps, messages);
    if (!composition.ok) return { code: 1, messages };
    const { models, template } = composition;
    const findings = [];
    const recordedPaths = new Set(deps.collectRecordedManagedPaths(existing));

    // Check 1: recorded packages resolve.
    const names = new Set(models.map((candidate) => candidate.name));
    for (const pkg of existing.packages) {
      if (!names.has(pkg.name)) findings.push(`recorded package "${pkg.name}" no longer resolves in the discovered set`);
    }

    // Check 2: contracts are compatible (explicit re-assertion; discovery's
    // triage already enforces it, so this fires only if the pipeline changes).
    for (const candidate of models) {
      if (candidate.envelope.contractVersion !== vocabulary.SUPPORTED_CONTRACT_VERSION) {
        findings.push(`${candidate.name}: contract version ${candidate.envelope.contractVersion} is not the supported version ${vocabulary.SUPPORTED_CONTRACT_VERSION}`);
      }
    }

    // Check 3: ownership is conflict-free (the nine set-level checks, from
    // the shared pipeline's validation — verify collects violations as
    // findings instead of aborting, so the remaining checks still report).
    for (const violation of composition.graphViolations) {
      findings.push(`ownership conflict: ${violation}`);
    }

    // Check 4: the effective opencode.json matches the recomputed
    // composition. Skipped when no unique core template exists — the
    // core-count violation already stands among the findings and there is
    // no recomputation to compare against.
    if (template !== null) {
      const renderedBytes = deps.serializeRendered(deps.renderOpencode(template, models));
      const renderedPath = renderedPathIn(consumerRoot);
      const renderedStat = lstatIfPresent(renderedPath);
      if (!renderedStat) {
        findings.push(`${manifest.RENDERED_RELATIVE_PATH} is missing`);
      } else if (renderedStat.isSymbolicLink()) {
        findings.push(`${manifest.RENDERED_RELATIVE_PATH} is a symlink or junction`);
      } else if (Buffer.compare(fs.readFileSync(renderedPath), Buffer.from(renderedBytes, "utf8")) !== 0) {
        findings.push(`${manifest.RENDERED_RELATIVE_PATH} does not match the recomputed composition`);
      }
    }

    // Check 5: managed files match package sources (missing owned files are
    // reported here; see check 6 for staleness).
    for (const candidate of models) {
      for (const file of candidate.managedFiles) {
        const consumerAbsolute = path.join(consumerRoot, ...file.consumerPath.split("/"));
        const sourceAbsolute = path.join(candidate.root, "managed", ...file.path.split("/"));
        const consumerStat = lstatIfPresent(consumerAbsolute);
        if (!consumerStat) {
          findings.push(`managed file missing: ${file.consumerPath} (owned by ${candidate.name})`);
          continue;
        }
        if (consumerStat.isSymbolicLink()) {
          findings.push(`managed file is a symlink or junction: ${file.consumerPath} (owned by ${candidate.name})`);
          continue;
        }
        const sourceStat = lstatIfPresent(sourceAbsolute);
        if (!sourceStat) {
          findings.push(`managed source missing: ${file.path} (${candidate.name})`);
          continue;
        }
        // Both comparison sides canonicalize (PLAN-20261023-01 WP-01,
        // T-05): line-ending-only differences are not drift; real content
        // drift still is. Check 4 above stays raw byte-equality by design.
        if (Buffer.compare(canonicalize(fs.readFileSync(consumerAbsolute)), canonicalize(fs.readFileSync(sourceAbsolute))) !== 0) {
          findings.push(`managed file differs from its source: ${file.consumerPath} (owned by ${candidate.name})`);
        }
      }
    }

    // Check 6: no tracked managed file is stale. (A tracked-and-owned file
    // that is unexpectedly missing is already reported by check 5.)
    for (const stalePath of deps.computeStaleManaged([...recordedPaths], deps.collectOwnedManagedPaths(models))) {
      findings.push(`stale managed file: ${stalePath} (recorded in the manifest, no longer owned)`);
    }

    // Check 7: expected seed files that have never been created are reported.
    for (const candidate of models) {
      for (const seed of candidate.seedFiles) {
        if (!lstatIfPresent(path.join(consumerRoot, ...seed.consumerPath.split("/")))) {
          findings.push(`seed never created: ${seed.consumerPath} (offered by ${candidate.name})`);
        }
      }
    }

    messages.push(...findings);
    return { code: findings.length > 0 ? 1 : 0, messages };
  } catch (error) {
    messages.push(`Error: verify failed: ${error.message}`);
    return { code: 1, messages };
  }
}

module.exports = {
  runInit,
  runCompose,
  runVerify,
};

"use strict";

/**
 * model.js
 *
 * The assembly seam between discovery and validation (the plan's T-07):
 * turns discovered package roots into the normalized package-model set the
 * graph validator, renderer, materializer, and manifest builder consume.
 *
 * The model shape fulfills the contract graph.js's header pins:
 *   {
 *     name, root, version, envelope,
 *     kind, skills, bash, requires,
 *     managedFiles: [{ path, consumerPath, sha256 }],
 *     seedFiles: [{ path, consumerPath }],
 *   }
 * The artifact-class path mappings live HERE and nowhere else (single
 * definition): a package's `managed/<rel>` materializes to the
 * consumer-root-relative path `.opencode/<rel>`, and a package's
 * `seed/<rel>` materializes to the consumer root itself (`<rel>`)
 * (DEC-20261017-02, Artifact classes).
 *
 * This module owns the bidirectional skill-content family (the plan's
 * ownership map): a declared skill with no SKILL.md at the managed-path
 * convention, and a managed/skills/<id>/SKILL.md with no declaration, both
 * fail. The convention's entry shape is `skills/<id>/SKILL.md` within the
 * package's managed tree; additional files under managed/skills/<id>/ are
 * owned content needing no declaration (SPEC-20261019-02, vocabulary).
 *
 * I/O (the package.json version read, tree inventories via the ported
 * collectRelativePaths, source hashing) is separated from the pure
 * mapping/check logic and injectable via run(options), per the generator's
 * testability seams. Assembly failures are collected per candidate so one
 * broken package does not mask another; any failure fails the set closed.
 *
 * Runtime: Node 24, built-in modules only.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { collectRelativePaths } = require("./safe-fs");
const { readJsonIfExists } = require("./discovery");

// The managed-path convention's entry shape. graph.js carries the same
// convention constant (to exclude skill entries from the managed-path
// collision check); if review flags the duplication, consolidate on this
// module's export.
const SKILL_ENTRY_PATTERN = /^skills\/([^/]+)\/SKILL\.md$/;

// ─── Artifact-class path mappings (single definition) ───────────────────────

function managedConsumerPath(relativePath) {
  return `.opencode/${relativePath}`;
}

function seedConsumerPath(relativePath) {
  return relativePath;
}

// ─── Pure helpers ───────────────────────────────────────────────────────────

function comparePaths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

/**
 * The skill IDs actually present under the managed-path convention.
 */
function actualSkillIds(managedPaths) {
  const ids = [];
  for (const relativePath of managedPaths) {
    const match = SKILL_ENTRY_PATTERN.exec(relativePath);
    if (match) ids.push(match[1]);
  }
  return ids;
}

/**
 * The bidirectional declared-versus-actual skill check (this module's
 * fail-closed family). Returns violation strings prefixed with the package
 * name; empty means the package's skill content is consistent.
 */
function checkSkillContent(modelName, declaredSkills, managedPaths) {
  const violations = [];
  const actual = new Set(actualSkillIds(managedPaths));
  const declared = new Set();
  for (const skill of declaredSkills) {
    declared.add(skill);
    if (!actual.has(skill)) violations.push(`${modelName}: declared skill "${skill}" has no managed/skills/${skill}/SKILL.md`);
  }
  for (const relativePath of managedPaths) {
    const match = SKILL_ENTRY_PATTERN.exec(relativePath);
    if (match && !declared.has(match[1])) {
      violations.push(`${modelName}: managed/skills/${match[1]}/SKILL.md has no skills declaration`);
    }
  }
  return violations;
}

// ─── Per-candidate assembly (I/O) ───────────────────────────────────────────

/**
 * Reduce a collectRelativePaths inventory to its file entries. The ported
 * primitive inventories directories as well as files (legacy semantics:
 * the legacy deploy compared full path sets); the model carries files
 * only — the manifest schema records files with hashes and the
 * materializer copies files. A directory entry conveys no content; an
 * empty directory in a package tree therefore contributes nothing (and an
 * emptied directory in the consumer may linger after stale removal, which
 * removes recorded files, not directories).
 */
function listTreeFiles(inventory, baseDir) {
  const files = [];
  for (const relativePath of inventory) {
    if (fs.lstatSync(path.join(baseDir, ...relativePath.split("/"))).isFile()) files.push(relativePath);
  }
  return files;
}

/**
 * Assemble one candidate into a model. Throws on I/O or integrity failures
 * (the caller collects them as fail-closed set failures); the bidirectional
 * skill-content check runs in run() so its violations collect alongside
 * other candidates' results.
 */
function buildPackageModel(candidate, deps) {
  const packageResult = deps.readJsonIfExists(path.join(candidate.root, "package.json"));
  if (!packageResult.present) throw new Error(`${candidate.name}: package.json vanished between discovery and assembly`);
  if (packageResult.parseError) throw new Error(`${candidate.name}: package.json is not parseable JSON: ${packageResult.parseError}`);
  const version = packageResult.value && packageResult.value.version;
  if (typeof version !== "string" || version.length === 0) {
    throw new Error(`${candidate.name}: package.json has no usable "version" member`);
  }

  const managedDir = path.join(candidate.root, "managed");
  const seedDir = path.join(candidate.root, "seed");
  const managedPaths = listTreeFiles(deps.collectRelativePaths(managedDir, managedDir), managedDir).sort(comparePaths);
  const seedPaths = listTreeFiles(deps.collectRelativePaths(seedDir, seedDir), seedDir).sort(comparePaths);

  const managedFiles = managedPaths.map((relativePath) => {
    const sourcePath = path.join(managedDir, ...relativePath.split("/"));
    let content;
    try {
      content = deps.readFile(sourcePath);
    } catch (error) {
      throw new Error(`${candidate.name}: cannot read managed source ${relativePath}: ${error.message}`);
    }
    return { path: relativePath, consumerPath: managedConsumerPath(relativePath), sha256: sha256(content) };
  });
  const seedFiles = seedPaths.map((relativePath) => ({ path: relativePath, consumerPath: seedConsumerPath(relativePath) }));

  return {
    name: candidate.name,
    root: candidate.root,
    version,
    envelope: candidate.envelope,
    kind: candidate.envelope.kind ?? null,
    skills: [...candidate.envelope.skills],
    bash: [...candidate.envelope.bash],
    requires: [...candidate.envelope.requires],
    managedFiles,
    seedFiles,
  };
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Assemble the model set from discovery's candidates. Returns
 * { models, failures }: models sorted byte-wise by name (fulfilling the
 * shape contract above), failures non-empty means the set is unusable and
 * the caller must abort before any validation or write.
 *
 * Injection seams (the generator's run(options) pattern): the JSON reader,
 * tree inventory, and file reader are replaceable for in-process tests.
 */
function run(options = {}) {
  if (!Array.isArray(options.candidates)) {
    throw new Error("model.run requires options.candidates (the discovered candidate array)");
  }
  const deps = {
    readJsonIfExists: options.readJsonIfExists ?? readJsonIfExists,
    collectRelativePaths: options.collectRelativePaths ?? collectRelativePaths,
    readFile: options.readFile ?? ((absolutePath) => fs.readFileSync(absolutePath)),
  };
  const models = [];
  const failures = [];
  for (const candidate of options.candidates) {
    let assembled;
    try {
      assembled = buildPackageModel(candidate, deps);
    } catch (error) {
      failures.push(`Error: ${error.message}`);
      continue;
    }
    const skillViolations = checkSkillContent(assembled.name, assembled.skills, assembled.managedFiles.map((file) => file.path));
    failures.push(...skillViolations.map((violation) => `Error: ${violation}`));
    models.push(assembled);
  }
  models.sort((a, b) => comparePaths(a.name, b.name));
  return { models, failures };
}

module.exports = {
  run,
  managedConsumerPath,
  seedConsumerPath,
  actualSkillIds,
  checkSkillContent,
};

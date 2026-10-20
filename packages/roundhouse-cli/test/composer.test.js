#!/usr/bin/env node
"use strict";

/**
 * composer.test.js
 *
 * Asserts the SCEN-052..066 acceptance contracts from SPEC-20261019-02 for
 * the Phase 3 composer:
 *
 *   @integration SCEN-052..058, SCEN-064..066 — the bin via spawnSync
 *     against temporary consumers under os.tmpdir() (package.json,
 *     node_modules copies for declared dependencies, workspace shells);
 *     SCEN-059 — a library-level discovery call over the real repository
 *     root (read-only; never a CLI run, so no manifest is created in the
 *     real repo).
 *
 *   @unit SCEN-060..063 — the exported pure validators and renderer, with
 *     candidate inputs loaded from the checked-in fixtures (the SCEN-034
 *     provenance precedent: inputs may come from fixture files; the logic
 *     under test stays in-memory and pure).
 *
 * Isolation: temporary consumers are built under os.tmpdir(); the real
 * repository is touched only by SCEN-059's read-only discovery call and
 * SCEN-064's argv tests (no writes). The suite is side-effect-free on
 * failure: every temp tree is removed by the exit safety net.
 *
 * Usage:
 *   node packages/roundhouse-cli/test/composer.test.js
 *
 * Runtime: Node 24, built-in modules only.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const LIB = path.join(__dirname, "..", "lib");
const FIXTURES = path.join(__dirname, "fixtures");
const BIN = path.join(__dirname, "..", "bin", "roundhouse.js");
const repoRoot = path.resolve(__dirname, "..", "..", "..");

const discovery = require(path.join(LIB, "discovery.js"));
const vocabulary = require(path.join(LIB, "vocabulary.js"));
const templateLib = require(path.join(LIB, "template.js"));
const graph = require(path.join(LIB, "graph.js"));
const render = require(path.join(LIB, "render.js"));
const model = require(path.join(LIB, "model.js"));
const { assertSafePath } = require(path.join(LIB, "safe-fs.js"));

// ─── Helpers ────────────────────────────────────────────────────────────────

const tempDirs = [];

function makeTempDir(name) {
  fs.mkdirSync(path.join(os.tmpdir(), "opencode"), { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode", `roundhouse-composer-${name}-`));
  tempDirs.push(dir);
  return dir;
}

// Safety net: remove temp consumers even if a test throws past its own
// cleanup (test-migration-baseline.js precedent).
process.on("exit", () => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

function readFixtureFile(fixtureName, relativePath) {
  return fs.readFileSync(path.join(FIXTURES, fixtureName, ...relativePath.split("/")), "utf8");
}

function fixtureCandidate(fixtureName) {
  const dir = path.join(FIXTURES, fixtureName);
  return {
    name: JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name,
    root: dir,
    envelope: JSON.parse(fs.readFileSync(path.join(dir, "roundhouse.json"), "utf8")),
  };
}

/**
 * Assemble one checked-in fixture into a model (the SCEN-034 provenance
 * pattern: the input comes from the fixture files; the logic under test is
 * the in-memory pure pipeline).
 */
function fixtureModel(fixtureName) {
  const result = model.run({ candidates: [fixtureCandidate(fixtureName)] });
  assert.equal(result.failures.length, 0, `provenance precondition: fixture ${fixtureName} assembles clean (${result.failures.join(" | ")})`);
  return result.models[0];
}

function validCoreTemplate() {
  return JSON.parse(readFixtureFile("core", "opencode-template.json"));
}

/**
 * Build a temporary consumer: a package.json declaring the given fixtures
 * in dependencies/devDependencies, plus node_modules copies of every named
 * fixture. `undeclared` fixtures are copied into node_modules without any
 * manifest declaration (SCEN-058's non-scan input).
 */
function buildConsumer(name, { dependencies = [], devDependencies = [], undeclared = [] } = {}) {
  const dir = makeTempDir(name);
  const manifest = { name: `temp-consumer-${name}`, version: "0.0.0", private: true };
  if (dependencies.length > 0) {
    manifest.dependencies = Object.fromEntries(dependencies.map((fixture) => [`@roundhouse-fixture/${fixture}`, "0.0.0"]));
  }
  if (devDependencies.length > 0) {
    manifest.devDependencies = Object.fromEntries(devDependencies.map((fixture) => [`@roundhouse-fixture/${fixture}`, "0.0.0"]));
  }
  fs.writeFileSync(path.join(dir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const nodeModules = path.join(dir, "node_modules", "@roundhouse-fixture");
  fs.mkdirSync(nodeModules, { recursive: true });
  for (const fixture of [...dependencies, ...devDependencies, ...undeclared]) {
    fs.cpSync(path.join(FIXTURES, fixture), path.join(nodeModules, fixture), { recursive: true });
  }
  return dir;
}

function runBin(args, cwd) {
  const result = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });
  return { code: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function sha256Of(absolutePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

function readConsumerJson(consumerRoot, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(consumerRoot, ...relativePath.split("/")), "utf8"));
}

/**
 * Content snapshot of a tree: sorted [relativePath, sha256] pairs, used to
 * assert that a read-only command wrote nothing.
 */
function snapshotTree(root) {
  const entries = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) {
        entries.push([relative, "symlink"]);
      } else if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), relative);
      } else {
        entries.push([relative, sha256Of(path.join(dir, entry.name))]);
      }
    }
  };
  walk(root, "");
  return entries;
}

function assertNothingWritten(consumerRoot) {
  assert(!fs.existsSync(path.join(consumerRoot, ".roundhouse")), "no manifest written");
  assert(!fs.existsSync(path.join(consumerRoot, "opencode.json")), "no rendered opencode.json written");
  assert(!fs.existsSync(path.join(consumerRoot, ".opencode")), "no managed tree written");
}

// ─── SCEN-052: init on a fresh consumer (@integration) ──────────────────────

test("SCEN-052: init composes a fresh consumer end to end", () => {
  const consumer = buildConsumer("scen052", { dependencies: ["core", "alpha"] });
  const run = runBin(["init"], consumer);
  assert.equal(run.code, 0, `init exits 0 (stderr: ${run.stderr})`);

  const manifest = readConsumerJson(consumer, ".roundhouse/manifest.json");
  assert.equal(manifest.schemaVersion, 1, "manifest schemaVersion is 1");
  assert.deepEqual(
    manifest.packages.map((pkg) => pkg.name),
    ["@roundhouse-fixture/alpha", "@roundhouse-fixture/core"],
    "the manifest records both packages, sorted by name"
  );
  for (const pkg of manifest.packages) {
    assert.equal(pkg.version, "0.0.0", `${pkg.name} resolved version recorded`);
    assert.equal(pkg.contractVersion, 1, `${pkg.name} contract version recorded`);
    for (const entry of pkg.managed) {
      assert.match(entry.sha256, /^[0-9a-f]{64}$/, `${pkg.name} managed entry ${entry.path} carries a source hash`);
    }
  }
  const alpha = manifest.packages.find((pkg) => pkg.name === "@roundhouse-fixture/alpha");
  assert.deepEqual(alpha.skills, ["fixture-alpha"], "alpha's contributed skill recorded");
  assert.deepEqual(alpha.seeds, ["FIXTURE-SEED-ALPHA.md"], "alpha's offered seed recorded");

  assert.equal(
    fs.readFileSync(path.join(consumer, ".opencode", "skills", "fixture-alpha", "SKILL.md"), "utf8"),
    readFixtureFile("alpha", "managed/skills/fixture-alpha/SKILL.md"),
    "the capability fixture's skill composed at the managed-path convention location"
  );
  assert.equal(
    fs.readFileSync(path.join(consumer, ".opencode", "docs", "fixture-workflow.md"), "utf8"),
    readFixtureFile("core", "managed/docs/fixture-workflow.md"),
    "the core fixture's non-skill managed content composed"
  );

  const rendered = readConsumerJson(consumer, "opencode.json");
  assert.deepEqual(
    rendered.agent.orchestrator.permission.skill,
    { "*": "deny", "fixture-alpha": "allow", "fixture-core": "allow" },
    "the uniform skill map renders the deny-all wildcard plus the sorted union"
  );
  assert.deepEqual(
    Object.keys(rendered.agent["document-author"].permission.bash),
    ["*", "node fixture-tool --check", "fixture-locked", "fixture-tool *"],
    "the two-layer bash map renders role entries first, union block last"
  );
  assert.deepEqual(
    Object.keys(rendered.agent.orchestrator.permission.bash),
    ["fixture-tool *"],
    "an agent whose template declares no bash map renders the union block only"
  );
  assert.equal(
    manifest.composed["opencode.json"].sha256,
    sha256Of(path.join(consumer, "opencode.json")),
    "the manifest's composed hash matches the rendered file"
  );

  assert.equal(
    fs.readFileSync(path.join(consumer, "FIXTURE-SEED.md"), "utf8"),
    readFixtureFile("core", "seed/FIXTURE-SEED.md"),
    "the core fixture's seed created at its consumer-rooted path"
  );
  assert.equal(
    fs.readFileSync(path.join(consumer, "FIXTURE-SEED-ALPHA.md"), "utf8"),
    readFixtureFile("alpha", "seed/FIXTURE-SEED-ALPHA.md"),
    "the alpha fixture's seed created at its consumer-rooted path"
  );
});

// ─── SCEN-053: compose updates and regenerates (@integration) ───────────────

test("SCEN-053: compose recomputes, updates managed artifacts, and regenerates", () => {
  const consumer = buildConsumer("scen053", { dependencies: ["core", "alpha"] });
  assert.equal(runBin(["init"], consumer).code, 0, "init establishes the consumer");
  const manifestBefore = readConsumerJson(consumer, ".roundhouse/manifest.json");

  const alphaCopy = path.join(consumer, "node_modules", "@roundhouse-fixture", "alpha");
  const skillSource = path.join(alphaCopy, "managed", "skills", "fixture-alpha", "SKILL.md");
  fs.appendFileSync(skillSource, "\nUpdated fixture content.\n", "utf8");

  const run = runBin(["compose"], consumer);
  assert.equal(run.code, 0, `compose exits 0 (stderr: ${run.stderr})`);

  assert.equal(
    fs.readFileSync(path.join(consumer, ".opencode", "skills", "fixture-alpha", "SKILL.md"), "utf8"),
    fs.readFileSync(skillSource, "utf8"),
    "the changed managed file is updated to match the package source"
  );
  const manifestAfter = readConsumerJson(consumer, ".roundhouse/manifest.json");
  const beforeHash = manifestBefore.packages.find((pkg) => pkg.name === "@roundhouse-fixture/alpha").managed
    .find((entry) => entry.path === ".opencode/skills/fixture-alpha/SKILL.md").sha256;
  const afterHash = manifestAfter.packages.find((pkg) => pkg.name === "@roundhouse-fixture/alpha").managed
    .find((entry) => entry.path === ".opencode/skills/fixture-alpha/SKILL.md").sha256;
  assert.notEqual(afterHash, beforeHash, "the manifest is refreshed with the new source hash");
  assert.equal(afterHash, sha256Of(skillSource), "the recorded hash equals the mutated source's hash");
  assert.equal(
    manifestAfter.composed["opencode.json"].sha256,
    sha256Of(path.join(consumer, "opencode.json")),
    "opencode.json is regenerated to match the recomputed composition (the render depends on envelopes, not managed bytes, so the composed hash is unchanged here)"
  );
});

// ─── SCEN-054: compose removes stale managed files (@integration) ───────────

test("SCEN-054: compose removes stale managed files by recorded ownership", () => {
  const consumer = buildConsumer("scen054", { dependencies: ["core", "alpha"] });
  assert.equal(runBin(["init"], consumer).code, 0, "init establishes the consumer");

  // The alpha copy drops its skill (declaration and content), so the
  // previously recorded managed path is no longer owned.
  const alphaCopy = path.join(consumer, "node_modules", "@roundhouse-fixture", "alpha");
  const envelopePath = path.join(alphaCopy, "roundhouse.json");
  const envelope = JSON.parse(fs.readFileSync(envelopePath, "utf8"));
  envelope.skills = [];
  fs.writeFileSync(envelopePath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  fs.rmSync(path.join(alphaCopy, "managed", "skills", "fixture-alpha", "SKILL.md"));

  // A consumer file under .opencode/ that was never recorded must survive.
  const neverRecorded = path.join(consumer, ".opencode", "consumer-note.txt");
  fs.writeFileSync(neverRecorded, "consumer content\n", "utf8");

  const run = runBin(["compose"], consumer);
  assert.equal(run.code, 0, `compose exits 0 (stderr: ${run.stderr})`);
  assert(
    !fs.existsSync(path.join(consumer, ".opencode", "skills", "fixture-alpha", "SKILL.md")),
    "the stale managed file is removed from the consumer tree"
  );
  assert(
    run.stderr.includes("Removed stale managed file: .opencode/skills/fixture-alpha/SKILL.md"),
    "the removal is listed on stderr"
  );
  assert.equal(fs.readFileSync(neverRecorded, "utf8"), "consumer content\n", "a never-recorded consumer file is left untouched");
  const manifest = readConsumerJson(consumer, ".roundhouse/manifest.json");
  assert.deepEqual(
    manifest.packages.find((pkg) => pkg.name === "@roundhouse-fixture/alpha").managed,
    [],
    "the refreshed manifest no longer records the removed path"
  );
});

// ─── SCEN-055: compose seeds only when missing (@integration) ───────────────

test("SCEN-055: compose creates newly applicable seeds only when missing", () => {
  const consumer = buildConsumer("scen055", { dependencies: ["core", "alpha"] });
  assert.equal(runBin(["init"], consumer).code, 0, "init establishes the consumer");

  const editedSeed = path.join(consumer, "FIXTURE-SEED-ALPHA.md");
  fs.writeFileSync(editedSeed, "CONSUMER-EDITED\n", "utf8");
  const absentSeed = path.join(consumer, "FIXTURE-SEED.md");
  fs.rmSync(absentSeed);

  const run = runBin(["compose"], consumer);
  assert.equal(run.code, 0, `compose exits 0 (stderr: ${run.stderr})`);
  assert.equal(fs.readFileSync(editedSeed, "utf8"), "CONSUMER-EDITED\n", "the existing seed instance is byte-identical before and after — never overwritten");
  assert.equal(
    fs.readFileSync(absentSeed, "utf8"),
    readFixtureFile("core", "seed/FIXTURE-SEED.md"),
    "the absent seed is created from the offering package's seed template"
  );
  assert(run.stderr.includes("Seed already present, skipped: FIXTURE-SEED-ALPHA.md"), "the preserved seed is reported");
  assert(run.stderr.includes("Created seed: FIXTURE-SEED.md"), "the created seed is reported");
});

// ─── SCEN-056: verify is read-only and reports drift (@integration) ─────────

test("SCEN-056: verify reports every drift class and writes nothing", () => {
  // Clean half: a freshly initialized consumer verifies with exit 0.
  const clean = buildConsumer("scen056-clean", { dependencies: ["core", "alpha"] });
  assert.equal(runBin(["init"], clean).code, 0, "init establishes the clean consumer");
  const cleanRun = runBin(["verify"], clean);
  assert.equal(cleanRun.code, 0, `a clean consumer verifies with exit 0 (stderr: ${cleanRun.stderr})`);

  // Drift half: one consumer exhibiting all six drift classes.
  const consumer = buildConsumer("scen056-drift", { dependencies: ["core", "alpha"] });
  assert.equal(runBin(["init"], consumer).code, 0, "init establishes the drift consumer");

  const alphaCopy = path.join(consumer, "node_modules", "@roundhouse-fixture", "alpha");
  const envelopePath = path.join(alphaCopy, "roundhouse.json");
  const envelope = JSON.parse(fs.readFileSync(envelopePath, "utf8"));
  envelope.skills = []; // drift 1: the recorded managed path is no longer owned (stale)
  envelope.requires = ["@roundhouse-fixture/core", "@roundhouse-fixture/absent"]; // drift 5: unresolved requires entry
  fs.writeFileSync(envelopePath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  fs.rmSync(path.join(alphaCopy, "managed", "skills", "fixture-alpha", "SKILL.md"));

  fs.rmSync(path.join(consumer, ".opencode", "skills", "fixture-core", "SKILL.md")); // drift 2: missing tracked managed file
  fs.appendFileSync(path.join(consumer, ".opencode", "docs", "fixture-workflow.md"), "consumer edit\n", "utf8"); // drift 3: edited against its source
  const handEdited = readConsumerJson(consumer, "opencode.json"); // drift 4: hand-edited opencode.json
  handEdited.default_agent = "reviewer";
  fs.writeFileSync(path.join(consumer, "opencode.json"), `${JSON.stringify(handEdited, null, 2)}\n`, "utf8");
  fs.rmSync(path.join(consumer, "FIXTURE-SEED.md")); // drift 6: never-created seed

  const before = snapshotTree(consumer);
  const run = runBin(["verify"], consumer);
  assert.equal(run.code, 1, "verify exits 1 on findings");
  const stderr = run.stderr;
  assert(stderr.includes("stale managed file: .opencode/skills/fixture-alpha/SKILL.md"), "the stale managed file is reported");
  assert(stderr.includes("managed file missing: .opencode/skills/fixture-core/SKILL.md"), "the missing tracked managed file is reported");
  assert(stderr.includes("managed file differs from its source: .opencode/docs/fixture-workflow.md"), "the edited managed file is reported");
  assert(stderr.includes("opencode.json does not match the recomputed composition"), "the hand-edited opencode.json is reported");
  assert(stderr.includes('"@roundhouse-fixture/absent"'), "the unresolved requires entry is reported");
  assert(stderr.includes("seed never created: FIXTURE-SEED.md"), "the never-created seed is reported");
  assert.deepEqual(snapshotTree(consumer), before, "verify writes nothing");
});

// ─── SCEN-057: discovery via declared dependencies (@integration) ───────────

test("SCEN-057: discovery resolves declared dependencies", () => {
  const consumer = buildConsumer("scen057", { dependencies: ["core"], devDependencies: ["alpha"] });
  const run = runBin(["init"], consumer);
  assert.equal(run.code, 0, `init exits 0 (stderr: ${run.stderr})`);
  const manifest = readConsumerJson(consumer, ".roundhouse/manifest.json");
  assert.deepEqual(
    manifest.packages.map((pkg) => [pkg.name, pkg.version]),
    [["@roundhouse-fixture/alpha", "0.0.0"], ["@roundhouse-fixture/core", "0.0.0"]],
    "each declared package is discovered with its resolved version recorded"
  );
});

// ─── SCEN-058: no blind node_modules scan (@integration) ────────────────────

test("SCEN-058: an undeclared node_modules package is never discovered", () => {
  const consumer = buildConsumer("scen058", { dependencies: ["core"], undeclared: ["beta"] });
  const run = runBin(["init"], consumer);
  assert.equal(run.code, 0, `init exits 0 (stderr: ${run.stderr})`);
  const manifest = readConsumerJson(consumer, ".roundhouse/manifest.json");
  assert.deepEqual(
    manifest.packages.map((pkg) => pkg.name),
    ["@roundhouse-fixture/core"],
    "the undeclared package is not discovered and contributes nothing"
  );
  assert(!fs.existsSync(path.join(consumer, ".opencode", "skills", "fixture-beta")), "the undeclared package's skill is not composed");
  assert.deepEqual(
    readConsumerJson(consumer, "opencode.json").agent.orchestrator.permission.skill,
    { "*": "deny", "fixture-core": "allow" },
    "the rendered skill map excludes the undeclared package's skill"
  );
});

// ─── SCEN-059: workspace members are the discovered set (@integration) ──────

test("SCEN-059: workspace members map to the discovery contract for self-hosting", () => {
  const manifestPath = path.join(repoRoot, ".roundhouse", "manifest.json");
  assert(!fs.existsSync(manifestPath), "precondition: the real repository has no manifest");
  const result = discovery.discoverPackages(repoRoot);
  assert.deepEqual(result.failures, [], `discovery fails closed on nothing (stderr: ${result.failures.join(" | ")})`);
  assert.equal(result.discovered.length, 28, "the discovered set is exactly the 28 workspace members");
  assert.equal(result.skipped.length, 0, "no workspace member is skipped");
  const frameworkCms = new Set([
    "@backshop/roundhouse-framework-astro",
    "@backshop/roundhouse-framework-react",
    "@backshop/roundhouse-cms-apostrophe",
  ]);
  for (const found of result.discovered) {
    assert(match(found.name), `every discovered package is a workspace member: ${found.name}`);
    const expectedRequires = found.name === "@backshop/roundhouse-core" || found.name === "@backshop/roundhouse-cli"
      ? []
      : frameworkCms.has(found.name)
        ? ["@backshop/roundhouse-core", "@backshop/roundhouse-lang-javascript"]
        : ["@backshop/roundhouse-core"];
    assert.deepEqual(found.envelope.requires, expectedRequires, `${found.name} carries the expected requires`);
    assert.deepEqual(found.envelope.skills, [], `${found.name} declares no skills yet (Phase 3: no content moved)`);
    assert.deepEqual(found.envelope.bash, [], `${found.name} declares no bash patterns yet`);
  }
  const byName = new Map(result.discovered.map((found) => [found.name, found]));
  assert.equal(byName.get("@backshop/roundhouse-core").envelope.kind, "core", "the core member is core-kind");
  assert(!("kind" in byName.get("@backshop/roundhouse-cli").envelope), "the kind-less CLI member is discovered with empty contributions");
  assert(!fs.existsSync(manifestPath), "no manifest is created in the real repo");

  function match(name) {
    return /^@backshop\/roundhouse-[a-z0-9-]+$/.test(name);
  }
});

// ─── SCEN-060: template validation fails closed (@unit) ─────────────────────

test("SCEN-060: template validation rejects every invariant violation", () => {
  const base = validCoreTemplate();
  assert.deepEqual(templateLib.validateTemplate(base), [], "the core fixture's template is valid");

  const rows = [
    { name: "unparseable JSON", evaluate: () => templateLib.validateTemplateSource("{ not json ]"), expect: /invariant 1/ },
    { name: "a missing Core agent definition", mutate: (t) => { delete t.agent.implementor; }, expect: /invariant 2/ },
    { name: "an entry beyond the four Core agents and four disabled built-ins", mutate: (t) => { t.agent["extra-agent"] = { disable: true }; }, expect: /invariant 2/ },
    { name: "a built-in agent not disabled", mutate: (t) => { t.agent.build = { disable: false }; }, expect: /invariant 2/ },
    { name: "a Core agent missing mode", mutate: (t) => { delete t.agent.implementor.mode; }, expect: /invariant 3/ },
    { name: "a Core agent missing its tuning member", mutate: (t) => { delete t.agent.orchestrator.steps; }, expect: /invariant 3/ },
    { name: "a Core agent missing its permission block", mutate: (t) => { delete t.agent.reviewer.permission; }, expect: /invariant 3/ },
    { name: "a Core agent skill map without the deny-all wildcard", mutate: (t) => { t.agent.reviewer.permission.skill = {}; }, expect: /invariant 4/ },
    { name: "a Core agent skill map carrying an allow entry", mutate: (t) => { t.agent.reviewer.permission.skill = { "*": "deny", peer: "allow" }; }, expect: /invariant 4/ },
    { name: "a Core agent bash member that is a bare deny string rather than a map", mutate: (t) => { t.agent.reviewer.permission.bash = "deny"; }, expect: /invariant 5/ },
    { name: "default_agent absent", mutate: (t) => { delete t.default_agent; }, expect: /invariant 6/ },
    { name: "default_agent naming a non-Core agent", mutate: (t) => { t.default_agent = "build"; }, expect: /invariant 6/ },
  ];
  for (const row of rows) {
    const violations = row.evaluate ? row.evaluate() : templateLib.validateTemplate(mutatedBase(row.mutate));
    assert(violations.length > 0, `${row.name}: the candidate is rejected`);
    assert(
      violations.some((violation) => row.expect.test(violation)),
      `${row.name}: the invariant is named (${violations.join(" | ")})`
    );
  }

  function mutatedBase(mutate) {
    const candidate = structuredClone(base);
    mutate(candidate);
    return candidate;
  }
});

// ─── SCEN-061: uniform skill-map rendering (@unit) ──────────────────────────

test("SCEN-061: skill maps render the computed uniform allowlist", () => {
  const template = validCoreTemplate();
  const models = [
    { name: "@x/b", kind: null, skills: ["skill-b", "skill-a"], bash: [], requires: [], managedFiles: [], seedFiles: [] },
    { name: "@x/a", kind: null, skills: ["skill-a"], bash: [], requires: [], managedFiles: [], seedFiles: [] },
  ];
  const rendered = render.renderOpencode(template, models);
  const maps = templateLib.CORE_AGENTS.map((agentName) => rendered.agent[agentName].permission.skill);
  assert.equal(new Set(maps.map((map) => JSON.stringify(map))).size, 1, "every map is identical across the four agents");
  assert.deepEqual(
    maps[0],
    { "*": "deny", "skill-a": "allow", "skill-b": "allow" },
    "each map is the deny-all wildcard followed by every installed skill with value allow in byte-wise ascending order"
  );
  assert.equal(Object.keys(maps[0])[0], "*", "the deny-all wildcard comes first");
  assert.deepEqual(render.computeSkillUnion(models), ["skill-a", "skill-b"], "no skill outside the union appears and no union skill is omitted");
});

// ─── SCEN-062: two-layer bash rendering (@unit) ─────────────────────────────

test("SCEN-062: bash maps render the two layers distinguishably", () => {
  const template = validCoreTemplate();

  // Set A: no package pattern appears in any template map, so the union
  // block is identical across the four agents (the scenario's assertion).
  const modelsA = [
    { name: "@x/pkg", kind: "capability", skills: [], bash: ["zeta-cmd *", "alpha-cmd"], requires: [], managedFiles: [], seedFiles: [] },
  ];
  const renderedA = render.renderOpencode(template, modelsA);
  const unionA = render.computeBashUnion(modelsA);
  assert.deepEqual(unionA, ["alpha-cmd", "zeta-cmd *"], "the union is byte-wise sorted");
  const blocksA = templateLib.CORE_AGENTS.map((agentName) => {
    const keys = Object.keys(renderedA.agent[agentName].permission.bash);
    return keys.slice(keys.length - unionA.length);
  });
  assert.equal(new Set(blocksA.map((block) => JSON.stringify(block))).size, 1, "the union block is identical across the four agents");
  assert.deepEqual(blocksA[0], unionA, "the union block equals the union recomputed from the packages' declarations");
  assert.deepEqual(
    Object.keys(renderedA.agent["document-author"].permission.bash),
    ["*", "node fixture-tool --check", "fixture-locked", "alpha-cmd", "zeta-cmd *"],
    "role-driven entries appear first, verbatim, in template order; the union block follows contiguously last"
  );
  assert.deepEqual(
    Object.keys(renderedA.agent.orchestrator.permission.bash),
    ["alpha-cmd", "zeta-cmd *"],
    "an agent whose template declares no bash map renders the union block only"
  );

  // Set B: a package pattern colliding with an identical allow template
  // entry is idempotent — the template entry stands in the agent that
  // declares it, and the other agents still receive the pattern (uniform
  // bash consequence).
  const modelsB = [
    { name: "@x/pkg", kind: "capability", skills: [], bash: ["node fixture-tool --check"], requires: [], managedFiles: [], seedFiles: [] },
  ];
  const renderedB = render.renderOpencode(template, modelsB);
  assert.deepEqual(
    Object.keys(renderedB.agent["document-author"].permission.bash),
    ["*", "node fixture-tool --check", "fixture-locked"],
    "the template's allow entry stands; the union block skips it in that agent"
  );
  assert.deepEqual(
    Object.keys(renderedB.agent.orchestrator.permission.bash),
    ["node fixture-tool --check"],
    "the pattern still reaches the agent whose template does not declare it"
  );
});

// ─── SCEN-063: graph and content validation rejects violations (@unit) ──────

test("SCEN-063: composition validation rejects every violation", () => {
  const trio = ["core", "alpha", "beta"].map(fixtureModel);
  const template = validCoreTemplate();
  assert.deepEqual(graph.validateGraph(trio, template), [], "the valid trio composes clean");

  const rows = [
    {
      name: "duplicate skill IDs across two packages",
      evaluate: () => graph.validateGraph([...trio, fixtureModel("dup-skill")], template),
      expect: /duplicate skill ID "fixture-alpha"/,
      exactly: 1,
    },
    {
      name: "a requires entry resolving to no discovered package",
      evaluate: () => graph.validateGraph([...trio, fixtureModel("missing-requires")], template),
      expect: /requires "@roundhouse-fixture\/absent", which resolves to no discovered package/,
      exactly: 1,
    },
    {
      name: "a declared skill with no SKILL.md at the managed-path convention",
      evaluate: () => model.run({ candidates: [fixtureCandidate("missing-skill-file")] }).failures,
      expect: /declared skill "fixture-missing" has no managed\/skills\/fixture-missing\/SKILL\.md/,
      exactly: 1,
    },
    {
      name: "a managed/skills/<id>/SKILL.md with no skills declaration",
      evaluate: () => model.run({ candidates: [fixtureCandidate("undeclared-skill-file")] }).failures,
      expect: /managed\/skills\/fixture-ghost\/SKILL\.md has no skills declaration/,
      exactly: 1,
    },
    {
      name: "two packages owning the same managed path",
      evaluate: () => graph.validateGraph([...trio, fixtureModel("dup-managed-path")], template),
      expect: /duplicate managed path "\.opencode\/docs\/fixture-workflow\.md"/,
      exactly: 1,
    },
    {
      name: "a non-core package declaring a managed path under .opencode/agents/",
      evaluate: () => graph.validateGraph([...trio, fixtureModel("agent-path")], template),
      expect: /reserved \.opencode\/agents\/ prefix/,
      exactly: 1,
    },
    {
      name: "two packages offering the same seed path",
      evaluate: () => graph.validateGraph([...trio, fixtureModel("dup-seed")], template),
      expect: /duplicate seed path "FIXTURE-SEED-ALPHA\.md"/,
      exactly: 1,
    },
    {
      name: "a contractVersion other than the CLI's supported version",
      evaluate: () => vocabulary.validateVocabulary(JSON.parse(readFixtureFile("wrong-contract-version", "roundhouse.json")), { packageName: "@roundhouse-fixture/wrong-contract-version" }),
      expect: /contract version 1 \(got 2\)/,
      exactly: 1,
    },
    {
      name: "a requires cycle",
      evaluate: () => graph.validateGraph([...trio, fixtureModel("cycle-a"), fixtureModel("cycle-b")], template),
      expect: /requires cycle: @roundhouse-fixture\/cycle-a -> @roundhouse-fixture\/cycle-b -> @roundhouse-fixture\/cycle-a/,
      exactly: 1,
    },
    {
      name: "a capability or workflow package whose requires omits @backshop/roundhouse-core",
      evaluate: () => vocabulary.validateVocabulary(JSON.parse(readFixtureFile("no-core-requires", "roundhouse.json")), { packageName: "@roundhouse-fixture/no-core-requires" }),
      expect: /must require the core package/,
      exactly: 1,
    },
    {
      name: "a framework package whose requires omits its applicable language package",
      evaluate: () => vocabulary.validateVocabulary(JSON.parse(readFixtureFile("framework-no-lang", "roundhouse.json")), { packageName: "@roundhouse-fixture/framework-phantom" }),
      expect: /framework packages must require/,
      exactly: 1,
    },
    {
      name: "a CMS package whose requires omits its applicable language package",
      evaluate: () => vocabulary.validateVocabulary(JSON.parse(readFixtureFile("cms-no-lang", "roundhouse.json")), { packageName: "@roundhouse-fixture/cms-phantom" }),
      expect: /CMS packages must require/,
      exactly: 1,
    },
    {
      name: "a package bash pattern colliding with a role-driven non-allow template entry",
      evaluate: () => graph.validateGraph([...trio, fixtureModel("bash-collision")], template),
      expect: /bash pattern "fixture-locked" collides with agent "document-author"/,
      exactly: 1,
    },
  ];
  for (const row of rows) {
    const violations = row.evaluate();
    assert(violations.length > 0, `${row.name}: the candidate is rejected`);
    assert(
      violations.some((violation) => row.expect.test(violation)),
      `${row.name}: the violation is named (${violations.join(" | ")})`
    );
    if (row.exactly !== undefined) {
      assert.equal(violations.length, row.exactly, `${row.name}: exactly ${row.exactly} violation(s) reported`);
    }
  }

  // Row 14 (path escape): deliberately fixture-free (Appendix A) — a crafted
  // candidate path escaping its consumer root is rejected by the ported
  // confinement primitive in memory.
  const escapeRoot = makeTempDir("scen063-escape");
  assert.throws(
    () => assertSafePath(escapeRoot, path.join(escapeRoot, "..", "escaped.txt"), "escaped candidate"),
    /escapes consumer cwd/,
    "a managed or seed path escaping its consumer root is rejected"
  );

  // Row 15 (zero or multiple core-kind packages): zero is set assembly (the
  // valid set minus core); multiple is the second-core fixture.
  const zeroCore = [fixtureModel("alpha"), fixtureModel("beta")];
  const zeroViolations = graph.validateGraph(zeroCore, null);
  assert(zeroViolations.some((violation) => /no core-kind package/.test(violation)), "zero core-kind packages rejected");
  const twoCores = [...trio, fixtureModel("second-core")];
  const twoCoreViolations = graph.validateGraph(twoCores, null);
  assert.equal(twoCoreViolations.length, 1, "second-core violates exactly the core-count rule");
  assert.match(twoCoreViolations[0], /multiple core-kind packages/, "multiple core-kind packages rejected");
});

// ─── SCEN-064: usage errors exit 2 (@integration) ───────────────────────────

test("SCEN-064: unknown commands and unexpected arguments are usage errors", () => {
  const dir = makeTempDir("scen064");
  for (const args of [[], ["frobnicate"], ["init", "extra"], ["--help"]]) {
    const run = runBin(args, dir);
    assert.equal(run.code, 2, `invocation ${JSON.stringify(args)} exits 2`);
    assert(run.stderr.includes("Usage: roundhouse"), `invocation ${JSON.stringify(args)} prints usage text on stderr`);
    assert.deepEqual(fs.readdirSync(dir), [], `invocation ${JSON.stringify(args)} writes nothing`);
  }
});

// ─── SCEN-065: command-state guards fail closed (@integration) ──────────────

test("SCEN-065: command-state guards fail closed", () => {
  // An existing manifest: init exits 1 directing to compose.
  const initialized = buildConsumer("scen065-init", { dependencies: ["core", "alpha"] });
  assert.equal(runBin(["init"], initialized).code, 0, "init establishes the consumer");
  const again = runBin(["init"], initialized);
  assert.equal(again.code, 1, "init with an existing manifest exits 1");
  assert(again.stderr.includes("already exists") && again.stderr.includes("compose"), "the state is reported with the direction to compose");

  // No manifest: compose exits 1 directing to init.
  const fresh = buildConsumer("scen065-compose", { dependencies: ["core", "alpha"] });
  const composeRun = runBin(["compose"], fresh);
  assert.equal(composeRun.code, 1, "compose without a manifest exits 1");
  assert(composeRun.stderr.includes("run init"), "the state is reported with the direction to init");
  assertNothingWritten(fresh);

  // No manifest: verify exits 1 directing to init.
  const verifyRun = runBin(["verify"], fresh);
  assert.equal(verifyRun.code, 1, "verify without a manifest exits 1");
  assert(verifyRun.stderr.includes("run init"), "the state is reported with the direction to init");
  assertNothingWritten(fresh);
});

// ─── SCEN-066: discovery rejects an invalid roundhouse.json (@integration) ──

test("SCEN-066: a discovered candidate with an invalid roundhouse.json fails closed", () => {
  // Variant A: unparseable, via copy-and-mutate.
  const consumerA = buildConsumer("scen066a", { dependencies: ["core", "alpha"] });
  fs.writeFileSync(
    path.join(consumerA, "node_modules", "@roundhouse-fixture", "alpha", "roundhouse.json"),
    "{ not json ]",
    "utf8"
  );
  const runA = runBin(["init"], consumerA);
  assert.equal(runA.code, 1, "init exits 1");
  assert(
    runA.stderr.includes("@roundhouse-fixture/alpha") && runA.stderr.includes("not parseable JSON"),
    "the offending package is listed on stderr"
  );
  assertNothingWritten(consumerA);

  // Variant B: vocabulary-violating, via copy-and-mutate.
  const consumerB = buildConsumer("scen066b", { dependencies: ["core", "alpha"] });
  const envelopePath = path.join(consumerB, "node_modules", "@roundhouse-fixture", "alpha", "roundhouse.json");
  const envelope = JSON.parse(fs.readFileSync(envelopePath, "utf8"));
  delete envelope.skills;
  fs.writeFileSync(envelopePath, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");
  const runB = runBin(["init"], consumerB);
  assert.equal(runB.code, 1, "init exits 1");
  assert(
    runB.stderr.includes("@roundhouse-fixture/alpha") && runB.stderr.includes('missing required member "skills"'),
    "the offending package is listed on stderr"
  );
  assertNothingWritten(consumerB);
});

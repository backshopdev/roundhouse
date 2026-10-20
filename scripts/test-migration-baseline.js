#!/usr/bin/env node
"use strict";

/**
 * test-migration-baseline.js
 *
 * Asserts the SCEN-026..045 acceptance contracts from SPEC-20261017-01 for
 * the Phase 1 migration baseline fixture tooling:
 *
 *   @unit        SCEN-032 (structural validation), SCEN-034 (the post-cutover
 *                fixture carries zero managed annotations — the manifest owns
 *                composition state), SCEN-035 (pending marker), SCEN-038
 *                (schema conformance, all ten Examples rows), SCEN-040
 *                (platform-agnostic bytes), SCEN-042 (canonical
 *                serialization) — exercised against the generator's exported
 *                pure pipeline steps.
 *
 *   @integration SCEN-026 (byte-identical regeneration), SCEN-027/028
 *                (the post-cutover classification: the src scope is empty,
 *                zero managed and seed entries — the surfaces transferred
 *                to the composer), SCEN-029 (the post-cutover root-only
 *                inventory), SCEN-030 (scratch paths), SCEN-031 (the
 *                composed opencode.json inventoried; untracked derived
 *                state absent), SCEN-033 (validation failure
 *                writes nothing, via injected defects), SCEN-036 (stale
 *                annotation loud drop), SCEN-037 (invalid input fails
 *                closed), SCEN-039 (encoding), SCEN-041 (untracked warn),
 *                SCEN-043 (symlink rejection), SCEN-044 (tracked-but-absent),
 *                SCEN-045 (usage error) — exercised by running the generator
 *                end-to-end against the real repository or against isolated
 *                temporary git repositories.
 *
 * Controlled tree states (tracked symlink, tracked-but-absent path, stale
 * annotation, tracked seed instance) are constructed in temporary git
 * repositories under os.tmpdir(); the real repository's tracked content is
 * never mutated. The only real-repo writes are the generator's own
 * byte-identical regeneration of the fixture (SCEN-026); SCEN-026 snapshots
 * the fixture bytes first and restores them whenever the live bytes differ
 * after its assertions, so the test is side-effect-free on failure too.
 *
 * SCEN-033's injection mechanism (Discretion per the plan): the generator's
 * `run()` accepts injected `validateOutput` / `classifyPaths` replacements,
 * so a defect that cannot arise from repository content alone (schema-invalid
 * output, unclassifiable path) can be forced deterministically.
 *
 * Usage:
 *   node scripts/test-migration-baseline.js
 *
 * Preconditions: references/migration-baseline.json must exist (generate it
 * first with scripts/generate-migration-baseline.js); the schema file must
 * exist alongside it.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const generator = require("./generate-migration-baseline.js");

const repoRoot = path.resolve(__dirname, "..");
const generatorPath = path.join(__dirname, "generate-migration-baseline.js");
const schemaPath = path.join(repoRoot, "references", "migration-baseline.schema.json");
const fixturePath = path.join(repoRoot, "references", "migration-baseline.json");
const FIXTURE = generator.FIXTURE_RELATIVE_PATH;

const HEX64_A = "a".repeat(64);
const HEX64_B = "b".repeat(64);
const HEX64_C = "c".repeat(64);

// ─── Helpers ────────────────────────────────────────────────────────────────

const tempDirs = [];

function makeTempDir(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `roundhouse-baseline-${name}-`));
  tempDirs.push(dir);
  return dir;
}

/**
 * Create an isolated temporary git repository containing a copy of the
 * generator (at <dir>/scripts/, so the script's repo-root resolution lands
 * on the temp repo) and the schema (at <dir>/references/). `files` maps
 * POSIX-style relative paths to string content. No commit is made; the index
 * is populated with `git add` only, which is all `git ls-files` needs.
 */
function createTempRepo(name, { files = {}, gitignore = null } = {}) {
  const dir = makeTempDir(name);
  fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
  fs.mkdirSync(path.join(dir, "references"), { recursive: true });
  fs.copyFileSync(generatorPath, path.join(dir, "scripts", "generate-migration-baseline.js"));
  fs.copyFileSync(schemaPath, path.join(dir, "references", "migration-baseline.schema.json"));
  if (gitignore !== null) {
    fs.writeFileSync(path.join(dir, ".gitignore"), gitignore, "utf8");
  }
  for (const [relativePath, content] of Object.entries(files)) {
    const absolute = path.join(dir, ...relativePath.split("/"));
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content, "utf8");
  }
  execFileSync("git", ["init", "-q"], { cwd: dir, encoding: "utf8" });
  return dir;
}

function trackFiles(dir, relativePaths) {
  if (relativePaths.length > 0) {
    execFileSync("git", ["add", "--", ...relativePaths], { cwd: dir, encoding: "utf8" });
  }
}

function trackedPathsOf(dir) {
  const output = execFileSync("git", ["ls-files", "-z"], { cwd: dir, encoding: "buffer" });
  return output.toString("utf8").split("\0").filter(Boolean);
}

function tempFixturePath(dir) {
  return path.join(dir, "references", "migration-baseline.json");
}

function readFixtureBytes(dir) {
  const fixture = tempFixturePath(dir);
  return fs.existsSync(fixture) ? fs.readFileSync(fixture) : null;
}

function readFixtureEntries(dir) {
  return JSON.parse(fs.readFileSync(tempFixturePath(dir), "utf8")).entries;
}

function readRealFixtureEntries() {
  return JSON.parse(fs.readFileSync(fixturePath, "utf8")).entries;
}

/** Independent re-implementation used to verify recorded hashes/sizes. */
function hashFileBytes(absolutePath) {
  const content = fs.readFileSync(absolutePath);
  return {
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
    sizeBytes: content.length,
  };
}

/**
 * Spawn the generator copy inside a temp repo; capture exit code + streams.
 * spawnSync (not execFileSync) because execFileSync discards the child's
 * stderr on success, and the reporting contract asserts stderr on the
 * success path too.
 */
function spawnGenerator(dir, args = []) {
  const result = spawnSync(
    process.execPath,
    [path.join(dir, "scripts", "generate-migration-baseline.js"), ...args],
    { cwd: dir, encoding: "utf8" }
  );
  return { code: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function makeEntry(path, classification, extra = {}) {
  const entry = {
    path,
    base: classification === "root-only-artifact" ? "root" : "src",
    classification,
    sha256: HEX64_A,
    sizeBytes: 1,
  };
  if (classification === "managed") entry.intendedPhase5Owner = "@backshop/roundhouse-core";
  return { ...entry, ...extra };
}

// Safety net: remove temp repos even if a test throws past its own cleanup.
process.on("exit", () => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

// ─── SCEN-026: Deterministic regeneration (@integration) ────────────────────

test("SCEN-026: regeneration is byte-identical and completes within 5 seconds", () => {
  assert(fs.existsSync(fixturePath), "precondition: working-tree fixture exists (run the generator first)");
  const committedBytes = fs.readFileSync(fixturePath);
  try {
    const startedFirst = process.hrtime.bigint();
    const firstRun = generator.run();
    const firstMs = Number(process.hrtime.bigint() - startedFirst) / 1e6;
    const afterFirst = fs.readFileSync(fixturePath);

    const startedSecond = process.hrtime.bigint();
    const secondRun = generator.run();
    const secondMs = Number(process.hrtime.bigint() - startedSecond) / 1e6;
    const afterSecond = fs.readFileSync(fixturePath);

    assert.equal(firstRun.code, 0, `first run exits 0 (stderr: ${firstRun.messages.join(" | ")})`);
    assert.equal(secondRun.code, 0, `second run exits 0 (stderr: ${secondRun.messages.join(" | ")})`);
    assert.ok(firstMs < 5000, `first generation completes within 5s (took ${firstMs.toFixed(0)}ms)`);
    assert.ok(secondMs < 5000, `second generation completes within 5s (took ${secondMs.toFixed(0)}ms)`);
    assert.deepEqual(afterFirst, committedBytes, "first run's output is byte-identical to the committed fixture");
    assert.deepEqual(afterSecond, afterFirst, "second run's output is byte-identical to the first run's output");
  } finally {
    // Side-effect-free on failure (test-sync.js Test 9 precedent): the runs
    // above rewrite the fixture before the assertions fire, so restore the
    // snapshot whenever the live bytes differ from it after the assertions.
    const liveBytes = fs.existsSync(fixturePath) ? fs.readFileSync(fixturePath) : null;
    if (liveBytes === null || !liveBytes.equals(committedBytes)) {
      fs.writeFileSync(fixturePath, committedBytes);
    }
  }
});

// ─── SCEN-027: The post-cutover managed classification (@integration) ───────

test("SCEN-027: the src scope is empty — the fixture carries zero managed entries", () => {
  assert(fs.existsSync(fixturePath), "precondition: working-tree fixture exists");
  const entries = readRealFixtureEntries();
  // Post-cutover: src/ is empty of tracked paths, so the fixture's managed
  // surface is zero. The managed-overwrite contract the classification once
  // mirrored now lives with the composer — the committed
  // .roundhouse/manifest.json owns composition state, and the composer and
  // sync suites carry the materialization coverage (the coverage transfer
  // per the Phase 5+6 close).
  assert.deepEqual(
    entries.filter((entry) => entry.classification === "managed"),
    [],
    "zero managed entries in the post-cutover fixture"
  );
  assert.deepEqual(
    entries.filter((entry) => entry.path.startsWith("src/")),
    [],
    "no src/ entries remain in the fixture"
  );
});

// ─── SCEN-028: The post-cutover seed classification (@integration) ──────────

test("SCEN-028: the src scope is empty — the fixture carries zero seed entries", () => {
  assert(fs.existsSync(fixturePath), "precondition: working-tree fixture exists");
  const entries = readRealFixtureEntries();
  // Post-cutover: the Core seed set lives in packages/roundhouse-core/seed/
  // and its create-if-missing contract is the composer's (verified by the
  // composer and sync suites) — the classification's seed surface
  // transferred with the cutover.
  assert.deepEqual(
    entries.filter((entry) => entry.classification === "seed"),
    [],
    "zero seed entries in the post-cutover fixture"
  );
  assert.deepEqual(
    entries.filter((entry) => entry.path.startsWith("src/")),
    [],
    "no src/ entries remain in the fixture"
  );
});

// ─── SCEN-029: The post-cutover root-only inventory (@integration) ──────────

test("SCEN-029: root entries are the post-cutover inventory; the former seed instances are root-only artifacts", () => {
  assert(fs.existsSync(fixturePath), "precondition: working-tree fixture exists");
  const entries = readRealFixtureEntries();
  const tracked = generator.listTrackedPaths(repoRoot);
  const trackedSet = new Set(tracked.map((t) => t.path));
  const expectedRootOnly = tracked
    .filter((t) => !t.path.startsWith("src/") && t.path !== FIXTURE && !trackedSet.has(`src/${t.path}`))
    .map((t) => t.path)
    .sort();
  const rootOnlyEntries = entries.filter((entry) => entry.classification === "root-only-artifact");

  assert.deepEqual(
    rootOnlyEntries.map((entry) => entry.path),
    expectedRootOnly,
    "root-only-artifact entries are exactly the tracked non-src paths without a tracked src counterpart (fixture excluded)"
  );
  for (const entry of rootOnlyEntries) {
    assert.equal(entry.base, "root", `root entry ${entry.path} has base "root"`);
    const actual = hashFileBytes(path.join(repoRoot, ...entry.path.split("/")));
    assert.equal(entry.sha256, actual.sha256, `root entry ${entry.path} sha256 matches file content`);
    assert.equal(entry.sizeBytes, actual.sizeBytes, `root entry ${entry.path} sizeBytes matches file content`);
  }

  for (const expected of [
    "package.json",
    "LICENSE",
    "guiding-principles.md",
    ".gitignore",
    ".markdownlint-cli2.jsonc",
    ".npmignore",
  ]) {
    assert(expectedRootOnly.includes(expected), `${expected} is among the root-only artifacts`);
  }
  for (const directory of [".github", "references", "scripts", "package"]) {
    const trackedInDir = tracked.filter((t) => t.path.startsWith(`${directory}/`) && t.path !== FIXTURE);
    assert(trackedInDir.length > 0, `sanity: tracked files exist under ${directory}/`);
    for (const t of trackedInDir) {
      assert(expectedRootOnly.includes(t.path), `tracked file ${t.path} is a root-only artifact`);
    }
  }

  assert(!entries.some((entry) => entry.path === FIXTURE), "the fixture file itself does not appear among the entries");

  assert(trackedSet.has("docs/specs/SPEC-20261017-01.md"), "docs/specs/SPEC-20261017-01.md is tracked at root");
  assert(!trackedSet.has("src/docs/specs/SPEC-20261017-01.md"), "its exact src/ counterpart is absent");
  assert(
    expectedRootOnly.includes("docs/specs/SPEC-20261017-01.md"),
    "a tracked root file without an exact src/ counterpart is a root-only artifact despite the src/docs tree existing"
  );

  // Post-cutover: the former root seed instances' src/ counterparts moved
  // into packages/roundhouse-core/seed/, so the instances classify as
  // root-only artifacts and ARE inventoried (the pre-cutover
  // seed-instance exclusion retired with the src tree).
  for (const seedInstance of ["AGENTS.md", "README.md", "docs/index.md", "ktlo/index.md"]) {
    assert(trackedSet.has(seedInstance), `${seedInstance} is tracked at root`);
    assert(!trackedSet.has(`src/${seedInstance}`), `the src/ counterpart of ${seedInstance} moved away with the cutover`);
    assert(
      expectedRootOnly.includes(seedInstance),
      `${seedInstance} is a root-only artifact in the post-cutover fixture`
    );
  }
});

// ─── SCEN-030: Scratch-path classification (@integration) ───────────────────

test("SCEN-030: tracked files inside ignored directories are inventoried; derived copies are not", () => {
  assert(fs.existsSync(fixturePath), "precondition: working-tree fixture exists");
  const entries = readRealFixtureEntries();
  const scratchEntries = entries.filter((entry) => entry.path.includes("scratch/"));
  // Post-cutover: the src/scratch seed template moved to
  // packages/roundhouse-core/seed/, so the root scratch/README.md lost its
  // src counterpart; both scratch paths inventory as root-only artifacts.
  assert.deepEqual(
    scratchEntries.map((entry) => entry.path).sort(),
    ["packages/roundhouse-core/seed/scratch/README.md", "scratch/README.md"],
    "the moved seed template and the root instance are the only scratch paths in the fixture"
  );
  for (const entry of scratchEntries) {
    assert.equal(entry.base, "root", `scratch entry ${entry.path} has base "root" (post-cutover: no src scope)`);
    assert.equal(entry.classification, "root-only-artifact", `scratch entry ${entry.path} is a root-only artifact`);
  }

  // Controlled-state part: in a temp repo where BOTH copies are tracked, the
  // root copy is a tracked seed instance and still absent from the fixture.
  const gitignore = "scratch/*\n**/scratch/*\n!src/scratch/README.md\n!scratch/README.md\n";
  const dir = createTempRepo("scen030", {
    gitignore,
    files: {
      "src/scratch/README.md": "src scratch readme\n",
      "scratch/README.md": "root scratch readme\n",
      "src/tool.md": "seed template\n",
    },
  });
  trackFiles(dir, [".gitignore", "src/scratch/README.md", "scratch/README.md", "src/tool.md"]);
  assert(
    trackedPathsOf(dir).includes("scratch/README.md"),
    "temp-repo setup: root scratch/README.md is a tracked seed instance"
  );
  const spawned = spawnGenerator(dir);
  assert.equal(spawned.code, 0, `generator exits 0 in temp repo (stderr: ${spawned.stderr})`);
  // Reporting contract: one stdout summary line; all contract reporting on
  // stderr (here, the untracked warning for the copied tooling files).
  assert.equal(
    spawned.stdout,
    `Wrote ${FIXTURE}.\n`,
    "stdout is exactly the single summary line"
  );
  assert(
    spawned.stderr.includes("untracked-and-not-ignored"),
    "stderr carries the untracked warning"
  );
  const tempEntries = readFixtureEntries(dir);
  const tempSrcScratch = tempEntries.find((entry) => entry.path === "src/scratch/README.md");
  assert(tempSrcScratch && tempSrcScratch.classification === "seed", "src/scratch/README.md inventoried as seed");
  assert(
    !tempEntries.some((entry) => entry.path === "scratch/README.md"),
    "tracked root scratch/README.md is absent from the fixture as derived state"
  );
});

// ─── SCEN-031: Deployment outputs are not inventoried (@integration) ────────

test("SCEN-031: the committed composed opencode.json is inventoried; untracked derived root state is absent", () => {
  assert(fs.existsSync(fixturePath), "precondition: working-tree fixture exists");
  const entries = readRealFixtureEntries();
  // Post-cutover: the root opencode.json is the committed composed artifact
  // and IS inventoried (root-only-artifact); the root .opencode/ remains
  // gitignored deployed state and is absent. The scenario's original rule —
  // untracked derived root state never enters the fixture — is kept by the
  // temp-repo part below.
  const rootOpenCode = entries.find((entry) => entry.path === "opencode.json");
  assert(rootOpenCode !== undefined, "the committed composed opencode.json is inventoried");
  assert.equal(rootOpenCode.base, "root", "the composed opencode.json has base \"root\"");
  assert.equal(rootOpenCode.classification, "root-only-artifact", "the composed opencode.json is a root-only artifact");
  assert(
    !entries.some((entry) => entry.path.startsWith(".opencode/")),
    "no root .opencode/ entry (gitignored deployed state)"
  );
  const trackedSet = new Set(generator.listTrackedPaths(repoRoot).map((t) => t.path));
  for (const entry of entries) {
    assert(
      !trackedSet.has(`src/${entry.path}`),
      `no src/ counterpart remains for ${entry.path} (the src tree moved with the cutover)`
    );
  }

  // Controlled-state part: a stale managed file at root .opencode/ with no
  // src/ counterpart, plus a root opencode.json, change nothing.
  const dir = createTempRepo("scen031", {
    files: {
      "src/.opencode/agent.md": "managed content\n",
      "src/AGENTS.md": "seed template\n",
      "AGENTS.md": "root seed instance\n",
      ".opencode/stale.md": "stale managed file\n",
      "opencode.json": "root opencode.json\n",
    },
  });
  trackFiles(dir, ["src/.opencode/agent.md", "src/AGENTS.md", "AGENTS.md"]);
  const firstRun = generator.run({ root: dir });
  assert.equal(firstRun.code, 0, `generator exits 0 with stale root state present (stderr: ${firstRun.messages.join(" | ")})`);
  const firstBytes = readFixtureBytes(dir);
  const secondRun = generator.run({ root: dir });
  assert.equal(secondRun.code, 0);
  assert.deepEqual(readFixtureBytes(dir), firstBytes, "fixture unchanged by the derived root state");
  const tempEntries = readFixtureEntries(dir);
  assert(!tempEntries.some((entry) => entry.path.startsWith(".opencode/")), "no root .opencode/ entry");
  assert(!tempEntries.some((entry) => entry.path === "opencode.json"), "no root opencode.json entry");
  assert(!tempEntries.some((entry) => entry.path === "AGENTS.md"), "no root seed instance entry");
});

// ─── SCEN-032: Structural validation rejects invalid cases (@unit) ──────────

test("SCEN-032: duplicate and out-of-order paths are rejected", () => {
  const sorted = [makeEntry("src/a.md", "seed"), makeEntry("src/b.md", "seed")];
  assert.deepEqual(generator.validateStructure(sorted), [], "sorted unique entries are accepted");

  const duplicated = [makeEntry("src/a.md", "seed"), makeEntry("src/a.md", "seed")];
  const duplicateErrors = generator.validateStructure(duplicated);
  assert(duplicateErrors.length > 0, "duplicate paths are rejected");
  assert(duplicateErrors.some((error) => error.includes("duplicate path")), "duplicate error names the condition");

  const unordered = [makeEntry("src/b.md", "seed"), makeEntry("src/a.md", "seed")];
  const orderErrors = generator.validateStructure(unordered);
  assert(orderErrors.length > 0, "out-of-order paths are rejected");
  assert(orderErrors.some((error) => error.includes("out of order")), "order error names the condition");
});

// ─── SCEN-033: Validation failure writes nothing (@integration, injection) ──

test("SCEN-033: an injected validation failure produces no write", () => {
  const dir = createTempRepo("scen033", {
    files: {
      "src/.opencode/managed.md": "managed content\n",
      "src/seed.md": "seed content\n",
    },
  });
  trackFiles(dir, ["src/.opencode/managed.md", "src/seed.md"]);
  const cleanRun = generator.run({ root: dir });
  assert.equal(cleanRun.code, 0, `clean run establishes a fixture (stderr: ${cleanRun.messages.join(" | ")})`);
  const before = readFixtureBytes(dir);
  assert(before !== null, "clean run wrote the fixture");

  // Injected defect 1: schema-invalid output (cannot arise from content alone).
  const schemaFailure = generator.run({
    root: dir,
    validateOutput: () => ["injected defect: simulated schema-invalid output"],
  });
  assert.equal(schemaFailure.code, 1, "injected output-validation failure exits 1");
  assert.equal(schemaFailure.wrote, false, "injected output-validation failure writes nothing");
  assert.deepEqual(readFixtureBytes(dir), before, "existing fixture unchanged after injected output-validation failure");

  // Injected defect 2: unclassifiable tracked path (detection rules are total,
  // so this branch cannot arise from repository content alone).
  const classifyFailure = generator.run({
    root: dir,
    classifyPaths: () => ({
      entries: [],
      failures: [{ path: "src/injected/unclassifiable.bin", reason: "unclassifiable tracked path (injected)" }],
    }),
  });
  assert.equal(classifyFailure.code, 1, "injected unclassifiable path exits 1");
  assert.equal(classifyFailure.wrote, false, "injected unclassifiable path writes nothing");
  assert(
    classifyFailure.messages.join("\n").includes("src/injected/unclassifiable.bin"),
    "the injected offending path is listed on stderr"
  );
  assert.deepEqual(readFixtureBytes(dir), before, "existing fixture unchanged after injected classification failure");
});

// ─── SCEN-034: The post-cutover annotation state (@unit) ────────────────────

test("SCEN-034: the post-cutover fixture carries zero managed annotations", () => {
  assert(fs.existsSync(fixturePath), "precondition: working-tree fixture exists (provenance for this scenario)");
  const existing = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  // The annotation-carry-forward contract was the PRE-cutover fixture's
  // purpose: the human-authored intendedPhase5Owner values were the move
  // map's data, and the cutover realized their purpose by moving the
  // content. The loud-drop flow retired the annotations (SCEN-036 covers
  // the drop mechanics; SCEN-037 the invalid-input rejection). Post-cutover
  // the committed .roundhouse/manifest.json owns composition state and the
  // fixture is the plain inventory.
  const annotated = existing.entries.filter((entry) => entry.intendedPhase5Owner !== undefined);
  assert.deepEqual(annotated, [], "zero managed annotations in the post-cutover fixture");
  assert.deepEqual(
    existing.entries.filter((entry) => entry.classification === "managed"),
    [],
    "zero managed entries (no annotation carrier exists)"
  );
});

// ─── SCEN-035: New managed path is never guessed (@unit) ────────────────────

test("SCEN-035: unmapped managed paths receive the pending marker", () => {
  assert.equal(
    generator.PENDING_MARKER,
    "TODO: pending human mapping (new path at generation time)",
    "the pending marker contract is pinned"
  );
  const freshInventory = [
    makeEntry("src/.opencode/new-arrival/SKILL.md", "managed"),
    makeEntry("src/seed.md", "seed"),
  ];
  const { entries: merged } = generator.mergeAnnotations(freshInventory, new Map());
  const newManaged = merged.find((entry) => entry.path === "src/.opencode/new-arrival/SKILL.md");
  assert.equal(
    newManaged.intendedPhase5Owner,
    "TODO: pending human mapping (new path at generation time)",
    "the new managed path receives exactly the deterministic pending marker"
  );
  assert(
    !newManaged.intendedPhase5Owner.includes("@backshop"),
    "no package name is synthesized for the new managed path"
  );
  const seedEntry = merged.find((entry) => entry.path === "src/seed.md");
  assert(!("intendedPhase5Owner" in seedEntry), "seed entries never carry an annotation");
});

// ─── SCEN-036: Stale annotation is dropped loudly (@integration) ────────────

test("SCEN-036: a vanished or reclassified annotated path is reported, not silenced", () => {
  // Variant A: annotated path absent from the fresh inventory.
  const dirA = createTempRepo("scen036a", { files: { "src/.opencode/real.md": "managed content\n" } });
  trackFiles(dirA, ["src/.opencode/real.md"]);
  fs.writeFileSync(
    tempFixturePath(dirA),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        entries: [
          {
            path: "src/.opencode/ghost/SKILL.md",
            base: "src",
            classification: "managed",
            sha256: HEX64_A,
            sizeBytes: 1,
            intendedPhase5Owner: "@backshop/roundhouse-core",
          },
        ],
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  const resultA = generator.run({ root: dirA });
  assert.equal(resultA.code, 1, "vanished annotated path exits 1");
  assert.equal(resultA.wrote, true, "the regenerated fixture is still written");
  assert(
    resultA.messages.join("\n").includes("src/.opencode/ghost/SKILL.md"),
    "the dropped path is listed on stderr"
  );
  const entriesA = readFixtureEntries(dirA);
  assert(!entriesA.some((entry) => entry.path === "src/.opencode/ghost/SKILL.md"), "the ghost entry is gone");
  const realEntry = entriesA.find((entry) => entry.path === "src/.opencode/real.md");
  assert(
    realEntry && realEntry.intendedPhase5Owner === generator.PENDING_MARKER,
    "the surviving managed path carries the pending marker"
  );

  // Variant B: annotated path no longer classified managed.
  const dirB = createTempRepo("scen036b", { files: { "src/now-seed.md": "seed content\n" } });
  trackFiles(dirB, ["src/now-seed.md"]);
  fs.writeFileSync(
    tempFixturePath(dirB),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        entries: [
          {
            path: "src/now-seed.md",
            base: "src",
            classification: "managed",
            sha256: HEX64_B,
            sizeBytes: 1,
            intendedPhase5Owner: "@backshop/roundhouse-core",
          },
        ],
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  const resultB = generator.run({ root: dirB });
  assert.equal(resultB.code, 1, "reclassified annotated path exits 1");
  assert.equal(resultB.wrote, true, "the regenerated fixture is still written");
  assert(resultB.messages.join("\n").includes("src/now-seed.md"), "the dropped path is listed on stderr");
  const entriesB = readFixtureEntries(dirB);
  const reclassified = entriesB.find((entry) => entry.path === "src/now-seed.md");
  assert(reclassified && reclassified.classification === "seed", "the path is now classified seed");
  assert(!("intendedPhase5Owner" in reclassified), "the stale annotation is gone from the written fixture");
});

// ─── SCEN-037: Invalid existing fixture fails closed (@integration) ─────────

test("SCEN-037: an unparseable or misplaced-annotation fixture blocks generation", () => {
  const dir = createTempRepo("scen037", {
    files: {
      "src/.opencode/managed.md": "managed content\n",
      "src/seed.md": "seed content\n",
    },
  });
  trackFiles(dir, ["src/.opencode/managed.md", "src/seed.md"]);
  const fixture = tempFixturePath(dir);

  const variants = [
    {
      name: "unparseable JSON",
      content: "{ not json ]",
      stderrIncludes: "not parseable",
    },
    {
      name: "schema-invalid (missing sha256)",
      content: `${JSON.stringify(
        {
          schemaVersion: 1,
          entries: [
            {
              path: "src/.opencode/managed.md",
              base: "src",
              classification: "managed",
              sizeBytes: 8,
              intendedPhase5Owner: "@backshop/roundhouse-core",
            },
          ],
        },
        null,
        2
      )}\n`,
      stderrIncludes: "src/.opencode/managed.md",
    },
    {
      name: "structurally invalid (duplicate paths)",
      content: `${JSON.stringify(
        {
          schemaVersion: 1,
          entries: [
            makeEntry("src/.opencode/managed.md", "managed"),
            makeEntry("src/.opencode/managed.md", "managed"),
          ],
        },
        null,
        2
      )}\n`,
      stderrIncludes: "duplicate path",
    },
    {
      name: "structurally invalid (unsorted paths)",
      content: `${JSON.stringify(
        {
          schemaVersion: 1,
          entries: [makeEntry("src/z.md", "managed"), makeEntry("src/a.md", "seed")],
        },
        null,
        2
      )}\n`,
      stderrIncludes: "out of order",
    },
    {
      name: "misplaced annotation on a seed entry",
      content: `${JSON.stringify(
        {
          schemaVersion: 1,
          entries: [
            makeEntry("src/.opencode/managed.md", "managed"),
            { ...makeEntry("src/seed.md", "seed"), intendedPhase5Owner: "@backshop/roundhouse-core" },
          ],
        },
        null,
        2
      )}\n`,
      stderrIncludes: "src/seed.md",
    },
  ];

  for (const variant of variants) {
    fs.writeFileSync(fixture, variant.content, "utf8");
    const before = fs.readFileSync(fixture);
    const result = generator.run({ root: dir });
    assert.equal(result.code, 1, `${variant.name}: exits 1`);
    assert.equal(result.wrote, false, `${variant.name}: writes nothing`);
    assert.deepEqual(
      fs.readFileSync(fixture),
      before,
      `${variant.name}: the existing fixture file is unchanged`
    );
    const stderr = result.messages.join("\n");
    assert(stderr.includes(variant.stderrIncludes), `${variant.name}: stderr names the offender (${variant.stderrIncludes})`);
  }
});

// ─── SCEN-038: Schema conformance (@unit, all ten Examples rows) ────────────

test("SCEN-038: the schema accepts a conforming fixture and rejects every violation", () => {
  const schemaDocument = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const managed = makeEntry("src/.opencode/skill/SKILL.md", "managed");
  const seed = makeEntry("src/seed.md", "seed");
  const rootOnly = makeEntry("LICENSE", "root-only-artifact");
  const conforming = { schemaVersion: 1, entries: [rootOnly, managed, seed] };

  const rows = [
    { violation: "no violation (conforming fixture)", candidate: conforming, accepted: true },
    {
      violation: "a missing sha256",
      candidate: {
        schemaVersion: 1,
        entries: [
          {
            path: "src/.opencode/skill/SKILL.md",
            base: "src",
            classification: "managed",
            sizeBytes: 10,
            intendedPhase5Owner: "@backshop/roundhouse-core",
          },
        ],
      },
      accepted: false,
    },
    {
      violation: "a non-hexadecimal sha256",
      candidate: { schemaVersion: 1, entries: [{ ...managed, sha256: "z".repeat(64) }] },
      accepted: false,
    },
    {
      violation: "a non-lowercase (uppercase) sha256",
      candidate: { schemaVersion: 1, entries: [{ ...managed, sha256: "A".repeat(64) }] },
      accepted: false,
    },
    {
      violation: "a negative sizeBytes",
      candidate: { schemaVersion: 1, entries: [{ ...managed, sizeBytes: -1 }] },
      accepted: false,
    },
    {
      violation: "a non-integer sizeBytes",
      candidate: { schemaVersion: 1, entries: [{ ...managed, sizeBytes: 1.5 }] },
      accepted: false,
    },
    {
      violation: "a managed entry without intendedPhase5Owner",
      candidate: {
        schemaVersion: 1,
        entries: [
          {
            path: managed.path,
            base: "src",
            classification: "managed",
            sha256: HEX64_A,
            sizeBytes: 10,
          },
        ],
      },
      accepted: false,
    },
    {
      violation: "a seed entry with intendedPhase5Owner",
      candidate: { schemaVersion: 1, entries: [{ ...seed, intendedPhase5Owner: "@backshop/roundhouse-core" }] },
      accepted: false,
    },
    {
      violation: "a root-only-artifact entry with intendedPhase5Owner",
      candidate: { schemaVersion: 1, entries: [{ ...rootOnly, intendedPhase5Owner: "@backshop/roundhouse-core" }] },
      accepted: false,
    },
    {
      violation: 'base "root" with classification "managed"',
      candidate: {
        schemaVersion: 1,
        entries: [
          {
            path: "README.md",
            base: "root",
            classification: "managed",
            sha256: HEX64_C,
            sizeBytes: 3,
            intendedPhase5Owner: "@backshop/roundhouse-core",
          },
        ],
      },
      accepted: false,
    },
    {
      violation: 'base "src" with classification "root-only-artifact"',
      candidate: {
        schemaVersion: 1,
        entries: [
          {
            path: "src/stray.md",
            base: "src",
            classification: "root-only-artifact",
            sha256: HEX64_C,
            sizeBytes: 3,
          },
        ],
      },
      accepted: false,
    },
    {
      violation: "an unknown classification",
      candidate: {
        schemaVersion: 1,
        entries: [
          {
            path: "src/unknown.md",
            base: "src",
            classification: "derived",
            sha256: HEX64_C,
            sizeBytes: 3,
          },
        ],
      },
      accepted: false,
    },
  ];

  for (const row of rows) {
    const errors = generator.validateAgainstSchema(schemaDocument, row.candidate);
    if (row.accepted) {
      assert.deepEqual(errors, [], `${row.violation}: expected accepted`);
    } else {
      assert(errors.length > 0, `${row.violation}: expected rejected`);
    }
  }
});

// ─── SCEN-039: Encoding and line-ending conformance (@integration) ──────────

test("SCEN-039: fixture bytes are pinned on a CRLF-prone platform", () => {
  const attrOutput = execFileSync(
    "git",
    ["check-attr", "text", "eol", "--", "references/migration-baseline.json", "references/migration-baseline.schema.json"],
    { cwd: repoRoot, encoding: "utf8" }
  );
  const attrLines = attrOutput.split("\n").filter((line) => line.trim());
  assert.equal(attrLines.length, 4, "check-attr reports text and eol for both pinned paths");
  // git check-attr emits one line per (path, attribute) pair.
  for (const target of ["references/migration-baseline.json", "references/migration-baseline.schema.json"]) {
    const targetLines = attrLines.filter((line) => line.startsWith(`${target}:`));
    assert.equal(targetLines.length, 2, `check-attr reports two attributes for ${target}`);
    assert(
      targetLines.some((line) => line.endsWith("text: set")),
      `text attribute is set for ${target}`
    );
    assert(
      targetLines.some((line) => line.endsWith("eol: lf")),
      `eol attribute is lf for ${target}`
    );
  }

  for (const filePath of [fixturePath, schemaPath]) {
    const bytes = fs.readFileSync(filePath);
    assert(
      !bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
      `${path.basename(filePath)} has no UTF-8 BOM`
    );
    assert(!bytes.includes(0x0d), `${path.basename(filePath)} contains no CR bytes (LF only)`);
    assert(bytes.length >= 2 && bytes[bytes.length - 1] === 0x0a, `${path.basename(filePath)} ends with a newline`);
    assert(
      bytes[bytes.length - 2] !== 0x0a,
      `${path.basename(filePath)} ends with a single trailing newline`
    );
  }
  // "Bytes equal the committed blob bytes": compare the working-tree fixture
  // against the index blob (git show :<path>), which equals the committed
  // blob once committed. The comparison fires only when the fixture is
  // identical in the working tree, the index, and HEAD (fully
  // committed-clean); it defers whenever any of these differ, including
  // staged-but-uncommitted windows — the committed-state guarantee is
  // enforced from the first post-commit run, and the deferred windows are
  // covered by SCEN-026's working-tree byte-truth plus the unconditional
  // byte properties and the eol=lf pin above.
  const fixtureStatus = execFileSync(
    "git",
    ["status", "--porcelain", "--", "references/migration-baseline.json"],
    { cwd: repoRoot, encoding: "utf8" }
  ).trim();
  if (fixtureStatus === "") {
    const blobBytes = execFileSync("git", ["show", ":references/migration-baseline.json"], {
      cwd: repoRoot,
      encoding: "buffer",
      maxBuffer: 64 * 1024 * 1024,
    });
    assert.deepEqual(
      fs.readFileSync(fixturePath),
      blobBytes,
      "working-tree fixture bytes equal the index blob bytes"
    );
  }
  // "Regeneration does not change its bytes" is asserted by SCEN-026
  // (byte-identical regeneration).
});

// ─── SCEN-040: Platform-agnostic byte properties (@unit) ────────────────────

test("SCEN-040: serialized output is platform-agnostic", () => {
  const sample = {
    schemaVersion: 1,
    entries: [makeEntry("src/.opencode/skill/SKILL.md", "managed"), makeEntry("src/seed.md", "seed"), makeEntry("LICENSE", "root-only-artifact")],
  };
  const bytes = Buffer.from(generator.serializeFixture(sample), "utf8");
  assert(!bytes.includes(0x0d), "serialized output contains no CR bytes");
  assert(
    !bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
    "serialized output has no BOM"
  );
  for (const entry of sample.entries) {
    assert(!entry.path.includes("\\"), `no entry path contains a backslash: ${entry.path}`);
  }
  assert(fs.existsSync(fixturePath), "precondition: working-tree fixture exists");
  for (const entry of readRealFixtureEntries()) {
    assert(!entry.path.includes("\\"), `real fixture path has no backslash: ${entry.path}`);
  }
});

// ─── SCEN-041: Untracked paths warn, not fail (@integration) ────────────────

test("SCEN-041: work-in-progress files do not block generation", () => {
  const dir = createTempRepo("scen041", {
    files: {
      "src/tool.md": "seed template\n",
      "wip-root.txt": "work in progress at root\n",
      "src/wip.md": "work in progress under src\n",
    },
  });
  trackFiles(dir, ["src/tool.md"]);
  // wip-root.txt and src/wip.md remain untracked-and-not-ignored.
  const result = generator.run({ root: dir });
  assert.equal(result.code, 0, "untracked paths do not fail generation");
  const stderr = result.messages.join("\n");
  assert(stderr.includes("wip-root.txt"), "the untracked root path is listed on stderr as a warning");
  assert(stderr.includes("src/wip.md"), "the untracked src path is listed on stderr as a warning");
  const entries = readFixtureEntries(dir);
  assert(
    !entries.some((entry) => entry.path === "wip-root.txt" || entry.path === "src/wip.md"),
    "none of the untracked paths is added to the fixture"
  );
});

// ─── SCEN-042: Canonical serialization (@unit) ──────────────────────────────

test("SCEN-042: serialization is byte-deterministic with pinned order", () => {
  const fixture = {
    schemaVersion: 1,
    entries: [
      // Keys deliberately scrambled; the serializer must impose canonical order.
      { sizeBytes: 1, sha256: HEX64_A, classification: "seed", base: "src", path: "src/b.md" },
      { intendedPhase5Owner: "@backshop/roundhouse-core", sizeBytes: 2, sha256: HEX64_B, classification: "managed", base: "src", path: "src/a.md" },
    ],
  };
  const first = generator.serializeFixture(fixture);
  const second = generator.serializeFixture(fixture);
  assert.equal(first, second, "serializing the same object twice produces identical bytes");

  const parsed = JSON.parse(first);
  assert.deepEqual(
    parsed.entries.map((entry) => entry.path),
    ["src/a.md", "src/b.md"],
    "entries are ordered ascending byte-wise by path"
  );

  const lines = first.split("\n");
  assert.equal(lines[1], '  "schemaVersion": 1,', "two-space indent at depth 1");
  assert.equal(lines[2], '  "entries": [', "entries member follows schemaVersion");
  const entriesMarker = lines.findIndex((line) => line.trim() === '"entries": [');
  const keyOrder = [];
  for (let i = entriesMarker + 2; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === "{" || trimmed === "") continue;
    if (trimmed.startsWith("}")) break;
    const keyMatch = trimmed.match(/^"([A-Za-z0-9]+)":/);
    if (keyMatch) keyOrder.push(keyMatch[1]);
  }
  assert.deepEqual(
    keyOrder,
    ["path", "base", "classification", "sha256", "sizeBytes", "intendedPhase5Owner"],
    "member order is path, base, classification, sha256, sizeBytes, intendedPhase5Owner"
  );
  assert(first.endsWith("\n") && !first.endsWith("\n\n"), "output ends with a single LF");
});

// ─── SCEN-043: Tracked symlink is rejected (@integration) ───────────────────

test("SCEN-043: a tracked symlink fails generation closed", () => {
  const dir = createTempRepo("scen043", { files: { "src/tool.md": "seed template\n" } });
  // Stage a symlink index entry (git mode 120000) without requiring platform
  // symlink support: write the link target as a blob, then register it with
  // the symlink mode via update-index --cacheinfo.
  fs.writeFileSync(path.join(dir, "link-content.txt"), "outside-target\n", "utf8");
  const blob = execFileSync("git", ["hash-object", "-w", "link-content.txt"], { cwd: dir, encoding: "utf8" }).trim();
  execFileSync("git", ["update-index", "--add", "--cacheinfo", `120000,${blob},src/linked.md`], { cwd: dir, encoding: "utf8" });
  trackFiles(dir, ["src/tool.md"]);
  // Materialize a plain file at the symlink path (as a Windows checkout
  // without symlink support would) so the git-mode signal is isolated.
  fs.writeFileSync(path.join(dir, "src", "linked.md"), "outside-target\n", "utf8");

  const spawned = spawnGenerator(dir);
  assert.equal(spawned.code, 1, "tracked symlink exits 1");
  assert.equal(spawned.stdout, "", "no stdout on the failure path (reporting contract)");
  assert(spawned.stderr.includes("src/linked.md"), "the symlink path is listed on stderr");
  assert.equal(readFixtureBytes(dir), null, "no fixture file was written");
});

// ─── SCEN-044: Tracked-but-absent path fails closed (@integration) ──────────

test("SCEN-044: a tracked path missing on disk blocks generation", () => {
  const dir = createTempRepo("scen044", {
    files: { "src/gone.md": "tracked but soon absent\n", "src/tool.md": "seed template\n" },
  });
  trackFiles(dir, ["src/gone.md", "src/tool.md"]);
  fs.unlinkSync(path.join(dir, "src", "gone.md"));

  const result = generator.run({ root: dir });
  assert.equal(result.code, 1, "tracked-but-absent path exits 1");
  assert.equal(result.wrote, false, "tracked-but-absent path writes nothing");
  assert(result.messages.join("\n").includes("src/gone.md"), "the absent path is listed on stderr");
  assert.equal(readFixtureBytes(dir), null, "no fixture file was written");
});

// ─── SCEN-045: Usage error on any argument (@integration) ───────────────────

test("SCEN-045: any argument is a usage error", () => {
  assert(fs.existsSync(fixturePath), "precondition: working-tree fixture exists");
  const before = fs.readFileSync(fixturePath);
  for (const args of [["--help"], ["stray-positional"], ["--mode", "sync"]]) {
    let code;
    let stderr = "";
    try {
      execFileSync(process.execPath, [generatorPath, ...args], { cwd: repoRoot, encoding: "utf8" });
      code = 0;
    } catch (error) {
      code = error.status;
      stderr = error.stderr || "";
    }
    assert.equal(code, 2, `arguments ${args.join(" ")} exit 2`);
    assert(stderr.includes("Usage"), `arguments ${args.join(" ")} print usage text on stderr`);
  }
  assert.deepEqual(fs.readFileSync(fixturePath), before, "no fixture file is written on a usage error");
});

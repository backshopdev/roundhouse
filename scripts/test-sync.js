#!/usr/bin/env node
"use strict";

/**
 * test-sync.js
 *
 * Automated tests for the composer-backed sync-roundhouse.js adapter
 * (PLAN-20261019-04 T-12). The behavioral contracts hold; the
 * implementation behind them swapped from the src/-tree deployment to the
 * composer library, and the assertions relabel accordingly:
 *
 *   1. Sync runs without error (init on a fresh consumer)
 *   2. The composed managed set exists at the consumer (derived from the
 *      packages' managed trees — the source relabel)
 *   3. Root-only artifacts are preserved (not deleted)
 *   4. Stale managed files are removed by recorded ownership; never-recorded
 *      files are never removed
 *   5. --mode verify flag works correctly
 *   6. --mode verify detects a missing managed file (negative test)
 *   7. opencode.json is the composed render (the uniform skill map)
 *   8. --mode verify detects a hand-edited opencode.json
 *   9. --mode verify detects a managed file edited against its source
 *  10. --mode verify detects a missing opencode.json
 *  11. Sync fails closed when the consumer's manifest is corrupt (the
 *      missing-src premise retired with the source tree)
 *  12. Seeds are created when missing (the Core seed set)
 *  13. Seeds are never overwritten (create-if-missing)
 *  14. --mode verify detects never-created seed files
 *  15. Empty consumer dir gets fully populated by sync
 *  16. Existing consumer with customizations — managed replaced, seeds
 *      preserved, never-recorded files preserved
 *  17. Missing --mode flag exits 2 with a clear error
 *  18. Invalid --mode value exits 2
 *  19. Managed junction rejection
 *  20. Source-side symlink rejection (through the preserved copyMissing API)
 *  21. Nested destination junction rejection
 *  22. Unrelated consumer links ignored
 *  23. Managed type-conflict disposition (see the in-test deviation note)
 *  24. Path-escape rejection: deploy destination escapes consumer cwd
 *  25. Path-escape rejection: copyMissing destination escapes consumer cwd
 *  26. Path-escape rejection: symlinked path component inside consumer cwd
 *  27. Root consumer-owned seed files are preserved untouched by sync
 *  28. Self-hosting verification: --mode verify passes on the repo's own root
 *
 * Tests run in an isolated OS temp directory (created from os.tmpdir()) so
 * they never touch the real repo root. The source is the real workspace
 * package set, read-only — the harness isolates via --consumer alone (the
 * --src flag is inert compatibility surface). Tests 24-26 exercise the
 * escape contracts through package/deploy-roundhouse.js's preserved API
 * because the sync CLI constructs every path internally. Test 28 is the one
 * real-repo touchpoint: --mode verify is read-only.
 *
 * Usage:
 *   node scripts/test-sync.js
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");
const { deploy, copyMissing } = require("../package/deploy-roundhouse");
// The canonical-comparison form (PLAN-20261023-01 WP-03): materialized
// files carry the sources' canonicalized content (UTF-8/LF), so the
// source-versus-materialized assertions below compare canonicalized forms
// — line-ending-only differences are not drift.
const { canonicalize } = require("../packages/roundhouse-cli/lib/canonical.js");

const repoRoot = path.resolve(__dirname, "..");
const packagesDir = path.join(repoRoot, "packages");
const coreSeedDir = path.join(packagesDir, "roundhouse-core", "seed");
const syncScript = path.join(__dirname, "sync-roundhouse.js");

// ─── Temp fixture setup ─────────────────────────────────────────────────────
// The source is the real workspace package set (read-only); tests isolate
// via --consumer alone. No src/ copy exists post-cutover.
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "roundhouse-sync-test-"));

// Safety net: ensure tempRoot is removed even if a synchronous throw bypasses
// the linear cleanup at the end of the suite. Idempotent via `force: true`.
function cleanupTemp() {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
}
process.on("exit", cleanupTemp);
process.on("beforeExit", cleanupTemp);

const destDir = path.join(tempRoot, ".opencode");
const destOpenCodeJson = path.join(tempRoot, "opencode.json");
const destManifest = path.join(tempRoot, ".roundhouse", "manifest.json");

/**
 * Root-only artifacts that must be preserved after sync.
 */
const ROOT_ONLY = [
  "node_modules",
  "package.json",
  "package-lock.json",
  ".gitignore",
  "data",
];

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

/**
 * The expected composed managed set: every file under the packages'
 * managed/ trees, as consumer-root-relative .opencode/ paths. Derived from
 * the real package tree (read-only) — the source relabel.
 */
function expectedManagedPaths() {
  const result = new Set();
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("roundhouse-")) continue;
    const managedDir = path.join(packagesDir, entry.name, "managed");
    const walk = (dir, prefix) => {
      if (!fs.existsSync(dir)) return;
      for (const child of fs.readdirSync(dir, { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${child.name}` : child.name;
        if (child.isDirectory()) walk(path.join(dir, child.name), relative);
        else result.add(relative);
      }
    };
    walk(managedDir, "");
  }
  return result;
}

/**
 * The Core seed set: every file under packages/roundhouse-core/seed/, as
 * consumer-root-relative paths.
 */
function expectedSeedPaths() {
  const result = [];
  const walk = (dir, prefix) => {
    for (const child of fs.readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${child.name}` : child.name;
      if (child.isDirectory()) walk(path.join(dir, child.name), relative);
      else result.push(relative);
    }
  };
  walk(coreSeedDir, "");
  return result.sort();
}

function collectFilesRecursive(dir, base) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).split(path.sep).join("/");
    if (entry.isDirectory()) {
      for (const child of collectFilesRecursive(full, base)) result.push(child);
    } else if (entry.isFile()) {
      result.push(rel);
    }
  }
  return result;
}

/**
 * Canonical-form file equality (PLAN-20261023-01 WP-03): two files are
 * equal when their canonicalized contents (UTF-8/LF) are byte-equal —
 * the comparison form matching the composer's materialization and verify
 * semantics. Materialized files are LF on every platform while package
 * sources may be CRLF in a given working tree. (The former verbatim
 * `filesAreEqual` helper retired with the sweep: every source-versus-
 * materialized comparison is canonicalization-aware now; the within-run
 * restore assertions compare Buffers directly.)
 */
function canonicalFilesEqual(fileA, fileB) {
  if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) return false;
  const statA = fs.statSync(fileA);
  const statB = fs.statSync(fileB);
  if (statA.isFile() && statB.isFile()) {
    return canonicalize(fs.readFileSync(fileA)).equals(canonicalize(fs.readFileSync(fileB)));
  }
  return false;
}

function runSync(args, options = {}) {
  const consumerDir = options.consumer || tempRoot;
  // --src is exercised once (test 1) to prove it is accepted and ignored;
  // the flag is inert compatibility surface.
  const srcFlag = options.src !== undefined ? ` --src "${options.src}"` : "";
  // 2>&1 merges the adapter's stderr reporting (creations, removals,
  // findings — the spec routes them to stderr) into the captured output.
  const cmd = `node "${syncScript}" --consumer "${consumerDir}"${srcFlag}${args ? " " + args : ""} 2>&1`;
  return execSync(cmd, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function runSyncExpectFailure(args, options = {}) {
  const consumerDir = options.consumer || tempRoot;
  let output = "";
  let exitCode = null;
  try {
    output = runSync(args, options);
    exitCode = 0;
  } catch (err) {
    exitCode = err.status;
    output = (err.stdout || "") + "\n" + (err.stderr || "");
  }
  return { exitCode, output };
}

// ─── Test 1: Sync runs without error ────────────────────────────────────────
console.log("\nTest 1: Sync runs without error (init on a fresh consumer)");
try {
  // --src points at a nonexistent path on purpose: the flag is accepted and
  // ignored (inert compatibility surface).
  const output = runSync("--mode sync", { src: path.join(tempRoot, "no-such-src") });
  assert(output.includes("initialized"), "Sync reports the initialized summary");
} catch (err) {
  assert(false, `Sync ran without error (got: ${err.message})`);
}
assert(fs.existsSync(destManifest), "Sync created .roundhouse/manifest.json");
assert(fs.existsSync(destOpenCodeJson), "Sync wrote the composed opencode.json");

// ─── Test 2: The composed managed set exists at the consumer ────────────────
console.log("\nTest 2: The composed managed set exists at the consumer");
const expectedManaged = expectedManagedPaths();
let allPresent = true;
for (const rel of expectedManaged) {
  const destPath = path.join(destDir, rel.split("/").join(path.sep));
  if (!fs.existsSync(destPath)) {
    assert(false, `Missing in consumer .opencode/: ${rel}`);
    allPresent = false;
  }
}
if (allPresent) {
  assert(true, `All ${expectedManaged.size} composed managed files present at the consumer`);
}

// ─── Test 3: Root-only artifacts are preserved ──────────────────────────────
console.log("\nTest 3: Root-only artifacts are preserved after sync");

const createdArtifacts = [];
for (const artifact of ROOT_ONLY) {
  const artifactPath = path.join(tempRoot, artifact);
  if (!fs.existsSync(artifactPath)) {
    if (artifact === "node_modules" || artifact === "data") {
      fs.mkdirSync(artifactPath, { recursive: true });
    } else {
      fs.writeFileSync(artifactPath, "# test artifact\n");
    }
    createdArtifacts.push(artifact);
  }
}

try {
  runSync("--mode sync");
} catch (err) {
  assert(false, `Sync ran successfully in test 3 (got: ${err.message})`);
}

let allPreserved = true;
for (const artifact of ROOT_ONLY) {
  const artifactPath = path.join(tempRoot, artifact);
  if (!fs.existsSync(artifactPath)) {
    assert(false, `Root-only artifact deleted: ${artifact}`);
    allPreserved = false;
  }
}
if (allPreserved) {
  assert(true, "All root-only artifacts preserved");
}

for (const artifact of createdArtifacts) {
  const artifactPath = path.join(tempRoot, artifact);
  if (fs.existsSync(artifactPath)) {
    const stat = fs.lstatSync(artifactPath);
    if (stat.isDirectory()) {
      fs.rmSync(artifactPath, { recursive: true });
    } else {
      fs.unlinkSync(artifactPath);
    }
  }
}

// ─── Test 4: Stale removal by recorded ownership ────────────────────────────
console.log("\nTest 4: Stale managed files are removed by recorded ownership; never-recorded files are never removed");

// Consumer-side stale construction: record a path the composition does not
// own by adding it to the consumer manifest, then create the file.
const manifest = JSON.parse(fs.readFileSync(destManifest, "utf8"));
manifest.packages[0].managed.push({ path: ".opencode/__stale_test_file__.tmp", sha256: "a".repeat(64) });
fs.writeFileSync(destManifest, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const staleFile = path.join(destDir, "__stale_test_file__.tmp");
fs.writeFileSync(staleFile, "recorded but no longer owned\n");
assert(fs.existsSync(staleFile), "Recorded stale test file created");

// A never-recorded file (and nested directory) in .opencode/ must survive.
const neverRecorded = path.join(destDir, "__never_recorded__.txt");
fs.writeFileSync(neverRecorded, "never recorded — must survive\n");
const neverRecordedDir = path.join(destDir, "__never_recorded_dir__");
fs.mkdirSync(neverRecordedDir, { recursive: true });
fs.writeFileSync(path.join(neverRecordedDir, "nested.txt"), "nested\n");

const test4 = runSyncExpectFailure("--mode sync");
assert(test4.exitCode === 0, `Sync ran successfully in test 4 (got: ${test4.exitCode})`);
assert(!fs.existsSync(staleFile), "The recorded-but-unowned stale file was removed");
assert(test4.output.includes("Removed stale managed file: .opencode/__stale_test_file__.tmp"), "The removal is listed on stderr");
assert(fs.existsSync(neverRecorded), "A never-recorded consumer file is left untouched");
assert(fs.existsSync(path.join(neverRecordedDir, "nested.txt")), "A never-recorded consumer directory is left untouched");

// ─── Test 5: --mode verify flag works ───────────────────────────────────────
console.log("\nTest 5: --mode verify flag reports success when composed");
try {
  const output = runSync("--mode verify");
  assert(output.includes("no findings"), "--mode verify reports no findings");
} catch (err) {
  assert(false, `--mode verify ran without error (got: ${err.message})`);
}

// ─── Test 6: --mode verify detects a missing managed file ───────────────────
console.log("\nTest 6: --mode verify detects a missing managed file (negative test)");

const targetRel = "agents/orchestrator.md";
const targetPath = path.join(destDir, "agents", "orchestrator.md");
fs.unlinkSync(targetPath);
assert(!fs.existsSync(targetPath), `Deleted ${targetRel} from the consumer to create a discrepancy`);

const test6 = runSyncExpectFailure("--mode verify");
assert(test6.exitCode === 1, `--mode verify exited with code 1 when a managed file is missing (got: ${test6.exitCode})`);
assert(test6.output.includes("managed file missing: .opencode/agents/orchestrator.md"), "--mode verify output reports the missing managed file");

try {
  runSync("--mode sync");
  assert(fs.existsSync(targetPath), `Re-sync restored ${targetRel}`);
} catch (err) {
  assert(false, `Re-sync succeeded in test 6 (got: ${err.message})`);
}

// ─── Test 7: opencode.json is the composed render ───────────────────────────
console.log("\nTest 7: opencode.json is the composed render (the uniform skill map)");
assert(fs.existsSync(destOpenCodeJson), "The consumer opencode.json exists after sync");
const rendered = JSON.parse(fs.readFileSync(destOpenCodeJson, "utf8"));
const skillNames = Object.keys(rendered.agent.orchestrator.permission.skill);
assert(skillNames[0] === "*", "The rendered skill map carries the deny-all wildcard first");
assert(skillNames.length === 53, `The rendered skill map carries the deny-all wildcard plus the 52-skill union (got ${skillNames.length})`);
assert(
  new Set(["orchestrator", "document-author", "implementor", "reviewer"].map((name) => JSON.stringify(rendered.agent[name].permission.skill))).size === 1,
  "The rendered skill map is identical across the four agents"
);

// ─── Test 8: --mode verify detects a hand-edited opencode.json ──────────────
console.log("\nTest 8: --mode verify detects a hand-edited opencode.json");

const originalJsonBytes = fs.readFileSync(destOpenCodeJson);
fs.writeFileSync(destOpenCodeJson, originalJsonBytes.toString("utf-8") + "\n", "utf-8");
const test8 = runSyncExpectFailure("--mode verify");
assert(test8.exitCode === 1, `--mode verify exited with code 1 for a hand-edited opencode.json (got: ${test8.exitCode})`);
assert(test8.output.includes("opencode.json does not match the recomputed composition"), "--mode verify output reports the opencode.json mismatch");

try {
  runSync("--mode sync");
  assert(fs.readFileSync(destOpenCodeJson).equals(originalJsonBytes), "Re-sync restored the composed opencode.json");
} catch (err) {
  assert(false, `Re-sync succeeded in test 8 (got: ${err.message})`);
}

// ─── Test 9: --mode verify detects a managed file edited against its source ─
console.log("\nTest 9: --mode verify detects a managed file edited against its source");

const managedTarget = path.join(destDir, "docs-check.js");
const managedOriginal = fs.readFileSync(managedTarget);
fs.appendFileSync(managedTarget, "\n// consumer edit\n", "utf-8");
const test9 = runSyncExpectFailure("--mode verify");
assert(test9.exitCode === 1, `--mode verify exited with code 1 for an edited managed file (got: ${test9.exitCode})`);
assert(test9.output.includes("managed file differs from its source: .opencode/docs-check.js"), "--mode verify output reports the edited managed file");

try {
  runSync("--mode sync");
  assert(fs.readFileSync(managedTarget).equals(managedOriginal), "Re-sync overwrote the edited managed file back to the package source");
} catch (err) {
  assert(false, `Re-sync succeeded in test 9 (got: ${err.message})`);
}

// ─── Test 10: --mode verify detects a missing opencode.json ─────────────────
console.log("\nTest 10: --mode verify detects a missing opencode.json");

fs.unlinkSync(destOpenCodeJson);
assert(!fs.existsSync(destOpenCodeJson), "The consumer opencode.json deleted to create a discrepancy");

const test10 = runSyncExpectFailure("--mode verify");
assert(test10.exitCode === 1, `--mode verify exited with code 1 for a missing opencode.json (got: ${test10.exitCode})`);
assert(test10.output.includes("opencode.json is missing"), "--mode verify output reports the missing opencode.json");

try {
  runSync("--mode sync");
  assert(fs.existsSync(destOpenCodeJson), "Re-sync restored the composed opencode.json");
} catch (err) {
  assert(false, `Re-sync succeeded in test 10 (got: ${err.message})`);
}

// ─── Test 11: Sync fails closed when the consumer manifest is corrupt ───────
console.log("\nTest 11: Sync fails closed when the consumer's manifest is corrupt");

const manifestBytes = fs.readFileSync(destManifest);
fs.writeFileSync(destManifest, "{ not json ]", "utf8");
const test11 = runSyncExpectFailure("--mode sync");
assert(test11.exitCode === 1, `Sync exited with code 1 when the manifest is corrupt (got: ${test11.exitCode})`);
assert(test11.output.includes("not parseable JSON"), "Sync error message reports the corrupt manifest");
fs.writeFileSync(destManifest, manifestBytes);
assert(JSON.parse(fs.readFileSync(destManifest, "utf8")).schemaVersion === 1, "The manifest restored after test 11");

// ─── Test 12: Seeds are created when missing ────────────────────────────────
console.log("\nTest 12: Seeds are created when missing (the Core seed set)");

const buildingPath = path.join(tempRoot, "BUILDING.md");
const testingPath = path.join(tempRoot, "TESTING.md");
const seedBuildingPath = path.join(coreSeedDir, "BUILDING.md");
const seedTestingPath = path.join(coreSeedDir, "TESTING.md");
try { fs.unlinkSync(buildingPath); } catch {}
try { fs.unlinkSync(testingPath); } catch {}
assert(!fs.existsSync(buildingPath), "Pre-test: consumer BUILDING.md deleted");
assert(!fs.existsSync(testingPath), "Pre-test: consumer TESTING.md deleted");

try {
  runSync("--mode sync");
} catch (err) {
  assert(false, `Sync ran without error in test 12 (got: ${err.message})`);
}

assert(fs.existsSync(buildingPath), "Sync created consumer BUILDING.md from the Core seed set");
assert(fs.existsSync(testingPath), "Sync created consumer TESTING.md from the Core seed set");
assert(
  canonicalFilesEqual(buildingPath, seedBuildingPath),
  "consumer BUILDING.md content matches the Core seed template (canonical form)"
);
assert(
  canonicalFilesEqual(testingPath, seedTestingPath),
  "consumer TESTING.md content matches the Core seed template (canonical form)"
);

// ─── Test 13: Seeds are never overwritten ───────────────────────────────────
console.log("\nTest 13: Seeds are never overwritten (create-if-missing)");

const sentinelContent = "# sentinel — Mode 2 must not overwrite\n";
fs.writeFileSync(buildingPath, sentinelContent, "utf-8");
assert(fs.readFileSync(buildingPath, "utf-8") === sentinelContent, "Sentinel written to consumer BUILDING.md");

try {
  runSync("--mode sync");
} catch (err) {
  assert(false, `Sync ran without error in test 13 (got: ${err.message})`);
}

assert(
  fs.readFileSync(buildingPath, "utf-8") === sentinelContent,
  "The seed instance was not overwritten by sync"
);
assert(
  fs.readFileSync(buildingPath, "utf-8") !== fs.readFileSync(seedBuildingPath, "utf-8"),
  "consumer BUILDING.md still has sentinel content (not the seed template)"
);

try { fs.unlinkSync(buildingPath); } catch {}

// ─── Test 14: --mode verify detects never-created seed files ────────────────
console.log("\nTest 14: --mode verify detects never-created seed files");

try {
  runSync("--mode sync");
} catch (err) {
  assert(false, `Baseline sync succeeded in test 14 (got: ${err.message})`);
}
assert(fs.existsSync(buildingPath), "Baseline: consumer BUILDING.md present after sync");

fs.unlinkSync(buildingPath);
assert(!fs.existsSync(buildingPath), "consumer BUILDING.md deleted to create seed drift");

const test14 = runSyncExpectFailure("--mode verify");
assert(test14.exitCode === 1, `--mode verify exited with code 1 for a never-created seed (got: ${test14.exitCode})`);
assert(test14.output.includes("seed never created: BUILDING.md"), "--mode verify output reports the never-created seed");

try {
  runSync("--mode sync");
  assert(fs.existsSync(buildingPath), "Re-sync restored consumer BUILDING.md");
} catch (err) {
  assert(false, `Re-sync succeeded in test 14 (got: ${err.message})`);
}

// ─── Test 15: Empty consumer dir gets fully populated by sync ───────────────
console.log("\nTest 15: Empty consumer dir gets fully populated by sync");

const test15Dir = path.join(tempRoot, "test15");
fs.mkdirSync(test15Dir, { recursive: true });
assert(fs.readdirSync(test15Dir).length === 0, "Test 15 starts with an empty consumer dir");

try {
  runSync("--mode sync", { consumer: test15Dir });
} catch (err) {
  assert(false, `Sync populated empty consumer (got: ${err.message})`);
}

assert(fs.existsSync(path.join(test15Dir, ".opencode")), "test15: .opencode/ was created");
assert(fs.existsSync(path.join(test15Dir, "opencode.json")), "test15: opencode.json was created");
assert(fs.existsSync(path.join(test15Dir, ".roundhouse", "manifest.json")), "test15: .roundhouse/manifest.json was created");

// The composed managed set matches the packages' managed trees in
// canonical form (PLAN-20261023-01: materialized files carry the sources'
// canonicalized content, UTF-8/LF).
const test15OpenCode = path.join(test15Dir, ".opencode");
const test15ManagedFiles = collectFilesRecursive(test15OpenCode, test15OpenCode);
let test15ManagedMatch = true;
for (const rel of expectedManaged) {
  const packageFile = null; // resolved per-path below
  let sourceFile = null;
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("roundhouse-")) continue;
    const candidate = path.join(packagesDir, entry.name, "managed", ...rel.split("/"));
    if (fs.existsSync(candidate)) { sourceFile = candidate; break; }
  }
  if (!sourceFile || !canonicalFilesEqual(sourceFile, path.join(test15OpenCode, ...rel.split("/")))) {
    assert(false, `test15: .opencode/${rel} does not match its package source (canonical form)`);
    test15ManagedMatch = false;
  }
}
if (test15ManagedMatch) {
  assert(true, `test15: all ${expectedManaged.size} composed managed files match their package sources (canonical form)`);
}

// The Core seed set exists with the seed templates' content (canonical form).
const test15SeedFiles = expectedSeedPaths;
let test15SeedMatch = true;
for (const rel of test15SeedFiles()) {
  const seedTemplate = path.join(coreSeedDir, ...rel.split("/"));
  const consumerSeed = path.join(test15Dir, ...rel.split("/"));
  if (!canonicalFilesEqual(seedTemplate, consumerSeed)) {
    assert(false, `test15: seed file ${rel} does not match the Core seed template (canonical form)`);
    test15SeedMatch = false;
  }
}
if (test15SeedMatch) {
  assert(true, `test15: all ${test15SeedFiles().length} Core seed files match their templates (canonical form)`);
}

// Spot-check a few well-known seed paths to make the assertion explicit.
const test15SeedSpotChecks = ["BUILDING.md", "AGENTS.md", "docs/index.md", "ktlo/template.md", "scratch/README.md"];
for (const rel of test15SeedSpotChecks) {
  assert(
    canonicalFilesEqual(path.join(coreSeedDir, ...rel.split("/")), path.join(test15Dir, ...rel.split("/"))),
    `test15: seed file ${rel} matches the Core seed template (canonical form)`
  );
}

// ─── Test 16: Existing consumer with customizations ─────────────────────────
console.log("\nTest 16: Existing consumer with customizations — managed replaced, seeds and never-recorded files preserved");

const test16Dir = path.join(tempRoot, "test16");
fs.mkdirSync(test16Dir, { recursive: true });
runSync("--mode sync", { consumer: test16Dir });

const test16OrchestratorPath = path.join(test16Dir, ".opencode", "agents", "orchestrator.md");
const test16OpenCodeJsonPath = path.join(test16Dir, "opencode.json");
const test16NeverRecorded = path.join(test16Dir, ".opencode", "__consumer_note__.md");

const mode1Sentinel = "# mode-1 sentinel — should be replaced by sync\n";
fs.writeFileSync(test16OrchestratorPath, mode1Sentinel, "utf-8");
const originalTest16Json = fs.readFileSync(test16OpenCodeJsonPath);
fs.writeFileSync(test16OpenCodeJsonPath, originalTest16Json.toString("utf-8") + "\n// tampered\n", "utf-8");
fs.writeFileSync(test16NeverRecorded, "consumer note\n", "utf-8");

const mode2Sentinel = "# mode-2 sentinel — must be preserved by sync\n";
const test16BuildingPath = path.join(test16Dir, "BUILDING.md");
const test16TestingPath = path.join(test16Dir, "TESTING.md");
fs.writeFileSync(test16BuildingPath, mode2Sentinel, "utf-8");
fs.writeFileSync(test16TestingPath, mode2Sentinel, "utf-8");

const packageOrchestratorPath = path.join(packagesDir, "roundhouse-core", "managed", "agents", "orchestrator.md");

try {
  runSync("--mode sync", { consumer: test16Dir });
} catch (err) {
  assert(false, `Sync ran on customized consumer (got: ${err.message})`);
}

assert(
  canonicalFilesEqual(packageOrchestratorPath, test16OrchestratorPath),
  "test16: .opencode/agents/orchestrator.md replaced with the package source (canonical form)"
);
assert(
  fs.readFileSync(test16OpenCodeJsonPath).equals(originalTest16Json),
  "test16: opencode.json regenerated to the composed render"
);
assert(
  fs.readFileSync(test16NeverRecorded, "utf-8") === "consumer note\n",
  "test16: the never-recorded consumer file is preserved (recorded-ownership staleness)"
);
assert(
  fs.readFileSync(test16BuildingPath, "utf-8") === mode2Sentinel,
  "test16: BUILDING.md sentinel preserved (seed create-if-missing)"
);
assert(
  fs.readFileSync(test16TestingPath, "utf-8") === mode2Sentinel,
  "test16: TESTING.md sentinel preserved (seed create-if-missing)"
);

// ─── Test 17: Missing --mode flag exits 2 with a clear error ────────────────
console.log("\nTest 17: Missing --mode flag exits 2 with a clear error");

const test17 = runSyncExpectFailure();
assert(test17.exitCode === 2, `Missing --mode exited with code 2 (got: ${test17.exitCode})`);
assert(
  test17.output.includes("--mode") && (test17.output.includes("required") || test17.output.includes("missing")),
  "Missing --mode error message mentions --mode is required"
);

// ─── Test 18: Invalid --mode value exits 2 ──────────────────────────────────
console.log("\nTest 18: Invalid --mode value exits 2");

const test18 = runSyncExpectFailure("--mode bogus");
assert(test18.exitCode === 2, `Invalid --mode exited with code 2 (got: ${test18.exitCode})`);
assert(test18.output.includes("invalid") && test18.output.includes("--mode"), "Invalid --mode error message mentions invalid --mode");

// ─── Test 19: Managed junction rejection ────────────────────────────────────
console.log("\nTest 19: Managed junction rejection");

const outside19 = fs.mkdtempSync(path.join(tempRoot, "outside-19-"));
fs.rmSync(destDir, { recursive: true, force: true });
fs.symlinkSync(outside19, destDir, "junction");
const test19 = runSyncExpectFailure("--mode sync");
assert(test19.exitCode === 1, `Sync exited 1 on a junction at the managed root (got: ${test19.exitCode})`);
assert(/symlink or junction/.test(test19.output), "Sync rejects a junction at the managed .opencode root");
assert(fs.readdirSync(outside19).length === 0, "Junction target remains untouched");
fs.rmSync(destDir, { recursive: true, force: true });
fs.rmSync(outside19, { recursive: true, force: true });
try {
  runSync("--mode sync");
  assert(
    fs.existsSync(path.join(destDir, "agents")) && fs.statSync(path.join(destDir, "agents")).isDirectory(),
    "Re-sync restored the managed root after the rejected junction"
  );
} catch (err) {
  assert(false, `Re-sync succeeded in test 19 (got: ${err.message})`);
}

// ─── Test 20: Source-side symlink rejection (through the preserved API) ─────
console.log("\nTest 20: Source-side symlink rejection (through the preserved copyMissing API)");

// The source is the real package set (read-only), so the source-side
// rejection is exercised through the preserved copyMissing API: a junctioned
// source is rejected before any mutation.
const outside20 = fs.mkdtempSync(path.join(tempRoot, "outside-20-"));
const sourceLink20 = path.join(tempRoot, "junctioned-source");
fs.symlinkSync(outside20, sourceLink20, "junction");
const consumer20 = path.join(tempRoot, "copymissing-consumer-20");
fs.mkdirSync(consumer20, { recursive: true });
let test20Error = null;
try {
  copyMissing(sourceLink20, path.join(consumer20, "copied.md"), false, () => {}, consumer20);
} catch (err) {
  test20Error = err.message;
}
assert(
  test20Error && /source uses a symlink or junction/.test(test20Error),
  "copyMissing rejects a junctioned source before any mutation"
);
assert(fs.readdirSync(outside20).length === 0, "Source junction target remains untouched");
assert(!fs.existsSync(path.join(consumer20, "copied.md")), "No file was written through the junction");
fs.rmSync(sourceLink20, { recursive: true, force: true });
fs.rmSync(outside20, { recursive: true, force: true });
fs.rmSync(consumer20, { recursive: true, force: true });

// ─── Test 21: Nested destination junction rejection ─────────────────────────
console.log("\nTest 21: Nested destination junction rejection");

const outside21 = fs.mkdtempSync(path.join(tempRoot, "outside-21-"));
const nestedLink21 = path.join(destDir, "agents");
fs.rmSync(nestedLink21, { recursive: true, force: true });
fs.symlinkSync(outside21, nestedLink21, "junction");
const test21 = runSyncExpectFailure("--mode sync");
assert(test21.exitCode === 1, `Sync exited 1 on a nested destination junction (got: ${test21.exitCode})`);
assert(/symlink or junction/.test(test21.output), "Sync rejects a junction nested inside the managed root");
assert(fs.readdirSync(outside21).length === 0, "Nested destination target remains untouched");
fs.rmSync(nestedLink21, { recursive: true, force: true });
fs.rmSync(outside21, { recursive: true, force: true });
try {
  runSync("--mode sync");
  assert(fs.statSync(nestedLink21).isDirectory(), "Re-sync restored the nested managed directory");
} catch (err) {
  assert(false, `Re-sync succeeded in test 21 (got: ${err.message})`);
}

// ─── Test 22: Unrelated consumer links ignored ──────────────────────────────
console.log("\nTest 22: Unrelated consumer links ignored");

const outside22 = fs.mkdtempSync(path.join(tempRoot, "outside-22-"));
const unrelatedLink22 = path.join(tempRoot, "consumer-only-link");
fs.symlinkSync(outside22, unrelatedLink22, "junction");
try {
  runSync("--mode sync");
  assert(fs.existsSync(unrelatedLink22), "Sync ignores unrelated consumer links");
} catch (err) {
  assert(false, `Sync succeeded with an unrelated consumer link (got: ${err.message})`);
}
fs.rmSync(unrelatedLink22, { recursive: true, force: true });
fs.rmSync(outside22, { recursive: true, force: true });

// ─── Test 23: Managed type-conflict repair ──────────────────────────────────
console.log("\nTest 23: Managed type-conflict repair");

// A consumer file at a managed directory path is repaired in place by the
// managed-update semantics (SCEN-072): removed, recreated as a directory,
// and repopulated from the package source — unlike seed paths, which are
// skipped (the create-if-missing contract).
const agentsDir23 = path.join(destDir, "agents");
fs.rmSync(agentsDir23, { recursive: true, force: true });
fs.writeFileSync(agentsDir23, "consumer conflict\n", "utf8");
try {
  runSync("--mode sync");
  assert(fs.statSync(agentsDir23).isDirectory(), "Sync repairs a file at the managed agents path back to a directory");
  assert(
    fs.existsSync(path.join(agentsDir23, "orchestrator.md")),
    "Repaired managed directory is repopulated from the packages"
  );
} catch (err) {
  assert(false, `Sync repaired the managed type conflict (got: ${err.message})`);
}

// ─── Test 24: Path-escape rejection — deploy destination ────────────────────
console.log("\nTest 24: Path-escape rejection: deploy destination escapes consumer cwd");

const consumerRoot24 = path.join(tempRoot, "escape-consumer-24");
fs.mkdirSync(consumerRoot24, { recursive: true });
let test24Error = null;
try {
  deploy({
    destinationDir: path.join(consumerRoot24, "..", "escaped-opencode-24"),
    destinationJson: path.join(consumerRoot24, "opencode.json"),
    log: () => {},
  });
} catch (err) {
  test24Error = err.message;
}
assert(
  test24Error && /escapes consumer cwd/.test(test24Error),
  "deploy rejects a destination that escapes the consumer cwd (assertSafePath)"
);
assert(
  !fs.existsSync(path.join(tempRoot, "escaped-opencode-24")),
  "No directory was created outside the consumer cwd"
);
fs.rmSync(consumerRoot24, { recursive: true, force: true });

// ─── Test 25: Path-escape rejection — copyMissing destination ───────────────
console.log("\nTest 25: Path-escape rejection: copyMissing destination escapes consumer cwd");

const consumerRoot25 = path.join(tempRoot, "escape-consumer-25");
fs.mkdirSync(consumerRoot25, { recursive: true });
let test25Error = null;
try {
  copyMissing(
    path.join(coreSeedDir, "BUILDING.md"),
    path.join(consumerRoot25, "..", "escaped-building-25.md"),
    false,
    () => {},
    consumerRoot25
  );
} catch (err) {
  test25Error = err.message;
}
assert(
  test25Error && /escapes consumer cwd/.test(test25Error),
  "copyMissing rejects a destination that escapes the consumer cwd (assertSafePath)"
);
assert(
  !fs.existsSync(path.join(tempRoot, "escaped-building-25.md")),
  "No file was created outside the consumer cwd"
);
fs.rmSync(consumerRoot25, { recursive: true, force: true });

// ─── Test 26: Path-escape rejection — symlinked path component ──────────────
console.log("\nTest 26: Path-escape rejection: symlinked path component inside consumer cwd");

const consumerRoot26 = path.join(tempRoot, "escape-consumer-26");
fs.mkdirSync(consumerRoot26, { recursive: true });
const outside26 = fs.mkdtempSync(path.join(tempRoot, "outside-26-"));
const link26 = path.join(consumerRoot26, "link");
fs.symlinkSync(outside26, link26, "junction");
let test26Error = null;
try {
  copyMissing(
    path.join(coreSeedDir, "BUILDING.md"),
    path.join(link26, "escaped-building-26.md"),
    false,
    () => {},
    consumerRoot26
  );
} catch (err) {
  test26Error = err.message;
}
assert(
  test26Error && /uses a symlink or junction/.test(test26Error),
  "assertSafePath rejects a destination whose path component is a symlink"
);
assert(fs.readdirSync(outside26).length === 0, "The symlink target remains untouched");
fs.rmSync(link26, { recursive: true, force: true });
fs.rmSync(outside26, { recursive: true, force: true });
fs.rmSync(consumerRoot26, { recursive: true, force: true });

// ─── Test 27: Root consumer-owned seed files are preserved untouched ────────
console.log("\nTest 27: Root consumer-owned seed files are preserved untouched by sync");

const seedFiles27 = [
  "AGENTS.md",
  "AGENTIC_WORKFLOW.md",
  "BUILDING.md",
  "TESTING.md",
  "CONTRIBUTING.md",
  "scratch/README.md",
  "ktlo/index.md",
  "ktlo/template.md",
  "docs/index.md",
];
const sentinels27 = new Map();
for (const relative of seedFiles27) {
  const absolute = path.join(tempRoot, ...relative.split("/"));
  assert(fs.existsSync(absolute), `Pre-test: seed file ${relative} exists at the consumer root`);
  const sentinel = `# sentinel — consumer-owned, sync must not overwrite (${relative})\n`;
  fs.writeFileSync(absolute, sentinel, "utf8");
  sentinels27.set(relative, sentinel);
}
// Control: a managed file IS overwritten, proving sync ran and that this
// test can detect an overwrite if the seed guarantee ever regresses.
const controlManaged27 = path.join(destDir, "agents", "orchestrator.md");
const controlSource27 = fs.readFileSync(path.join(packagesDir, "roundhouse-core", "managed", "agents", "orchestrator.md"));
fs.writeFileSync(controlManaged27, "# consumer edit — managed-overwrite must replace this\n", "utf8");
try {
  runSync("--mode sync");
} catch (err) {
  assert(false, `Sync ran in test 27 (got: ${err.message})`);
}
for (const [relative, sentinel] of sentinels27) {
  const absolute = path.join(tempRoot, ...relative.split("/"));
  assert(
    fs.readFileSync(absolute, "utf8") === sentinel,
    `Seed file ${relative} preserved untouched by sync`
  );
}
assert(
  canonicalize(fs.readFileSync(controlManaged27)).equals(canonicalize(controlSource27)),
  "Control: managed file was overwritten back to the package source's canonical content (sync ran)"
);
// Restore the seed files from their Core seed templates for state cleanliness.
for (const relative of seedFiles27) {
  fs.copyFileSync(
    path.join(coreSeedDir, ...relative.split("/")),
    path.join(tempRoot, ...relative.split("/"))
  );
}

// ─── Test 28: Self-hosting verification ─────────────────────────────────────
console.log("\nTest 28: Self-hosting verification: --mode verify passes on the repo's own root");

let test28Output = "";
let test28ExitCode = null;
try {
  test28Output = execSync(`node "${syncScript}" --mode verify`, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
  test28ExitCode = 0;
} catch (err) {
  test28ExitCode = err.status;
  test28Output = `${err.stdout || ""}\n${err.stderr || ""}`;
}
assert(
  test28ExitCode === 0,
  `Self-hosting verify exits 0 on the repo's own root (got: ${test28ExitCode})`
);
assert(
  test28Output.includes("no findings"),
  "Self-hosting verify reports no findings against the composed root"
);

// ─── Temp cleanup ───────────────────────────────────────────────────────────
try {
  fs.rmSync(tempRoot, { recursive: true, force: true });
} catch (err) {
  console.error(`Warning: temp dir cleanup failed: ${err.message}`);
}

// ─── Summary ────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\nAll tests passed.");
  process.exit(0);
}

#!/usr/bin/env node
"use strict";

/**
 * test-sync.js
 *
 * Automated tests for sync-roundhouse.js. Verifies:
 *   1. Sync runs without error
 *   2. All src/.opencode/ files exist in root .opencode/ after sync
 *   3. Root-only artifacts are preserved (not deleted)
 *   4. Stale files (in root but not in src) are removed
 *   5. --verify flag works correctly
 *   6. --verify detects discrepancies (negative test)
 *   7. opencode.json content is synced from src
 *   8. --verify checks opencode.json integrity
 *   9. --verify-only detects opencode.json content discrepancy
 *  10. --verify-only detects missing root opencode.json
 *  11. Sync fails when src/opencode.json is missing
 *  12. Mode 2 creates missing seed files at root
 *  13. Mode 2 leaves existing seed files alone
 *  14. --verify-only detects Mode 2 drift
 *  15. Empty consumer dir gets fully populated by sync
 *  16. Existing consumer with customizations — Mode 1 replaces, Mode 2 preserves
 *
 * Tests run in an isolated OS temp directory (created from os.tmpdir())
 * so they never touch the real repo root. A copy of src/ is placed in the
 * fixture so sync can be exercised with --src and --consumer overrides.
 *
 * Usage:
 *   node scripts/test-sync.js
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const srcDir = path.join(repoRoot, "src", ".opencode");
const srcOpenCodeJson = path.join(repoRoot, "src", "opencode.json");
const syncScript = path.join(__dirname, "sync-roundhouse.js");

// ─── Temp fixture setup ─────────────────────────────────────────────────────
// Tests run in an isolated OS temp directory so the real repo root is never
// touched. We copy src/ into the fixture and pass --src/--consumer overrides
// to the sync script so it operates on the fixture, not the live repo.
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "roundhouse-sync-test-"));
fs.cpSync(path.join(repoRoot, "src"), path.join(tempRoot, "src"), { recursive: true });

// Safety net: ensure tempRoot is removed even if a synchronous throw bypasses
// the linear cleanup at the end of the suite. Idempotent via `force: true`.
function cleanupTemp() {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
}
process.on("exit", cleanupTemp);
process.on("beforeExit", cleanupTemp);

// Consumer-side path constants now point at the temp fixture.
const destDir = path.join(tempRoot, ".opencode");
const destOpenCodeJson = path.join(tempRoot, "opencode.json");
const fixtureSrcDir = path.join(tempRoot, "src", ".opencode");
const fixtureSrcOpenCodeJson = path.join(tempRoot, "src", "opencode.json");

/**
 * Root-only artifacts that must be preserved after sync.
 * Must match the ROOT_ONLY list in sync-roundhouse.js.
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
 * Recursively collect all relative POSIX-style paths under a directory.
 */
function collectRelativePaths(dir, base) {
  const result = new Set();
  if (!fs.existsSync(dir)) {
    return result;
  }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const rel = path
      .relative(base, path.join(dir, entry.name))
      .split(path.sep)
      .join("/");
    result.add(rel);
    if (entry.isDirectory()) {
      const childPaths = collectRelativePaths(
        path.join(dir, entry.name),
        base
      );
      for (const cp of childPaths) {
        result.add(cp);
      }
    }
  }
  return result;
}

/**
 * Recursively collect all files under a directory, returning relative POSIX
 * paths. Used by Tests 15/16 to compare whole subtrees byte-for-byte.
 */
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

function filesAreEqual(fileA, fileB) {
  if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) return false;
  const statA = fs.statSync(fileA);
  const statB = fs.statSync(fileB);
  if (statA.isDirectory() && statB.isDirectory()) return true;
  if (statA.isFile() && statB.isFile()) {
    return fs.readFileSync(fileA).equals(fs.readFileSync(fileB));
  }
  return false;
}

/**
 * Filter a set of relative paths to those whose entries are regular files.
 * `collectRelativePaths` includes both files and directories; byte-for-byte
 * comparisons must skip directories.
 */
function filterFilesOnly(dir, paths) {
  const result = new Set();
  for (const rel of paths) {
    const fullPath = path.join(dir, rel);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      result.add(rel);
    }
  }
  return result;
}

function runSync(args, options = {}) {
  const consumerDir = options.consumer || tempRoot;
  const sourceDir = options.src || path.join(tempRoot, "src");
  const cmd = `node "${syncScript}" --src "${sourceDir}" --consumer "${consumerDir}"${args ? " " + args : ""}`;
  return execSync(cmd, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

// ─── Test 1: Sync runs without error ────────────────────────────────────────
console.log("\nTest 1: Sync runs without error");
try {
  const output = runSync();
  assert(output.includes("Synced:"), "Sync reports success message");
  assert(
    output.includes("up to date"),
    "Sync reports 'up to date' message"
  );
} catch (err) {
  assert(false, `Sync ran without error (got: ${err.message})`);
}

// ─── Test 2: All src files exist in root after sync ─────────────────────────
console.log("\nTest 2: All src/.opencode/ files exist in root .opencode/");
const srcPaths = collectRelativePaths(fixtureSrcDir, fixtureSrcDir);
const destPaths = collectRelativePaths(destDir, destDir);

let allPresent = true;
for (const rel of srcPaths) {
  const destPath = path.join(destDir, rel);
  if (!fs.existsSync(destPath)) {
    assert(false, `Missing in root: ${rel}`);
    allPresent = false;
  }
}
if (allPresent) {
  assert(true, `All ${srcPaths.size} src entries present in root`);
}

// ─── Test 3: Root-only artifacts are preserved ──────────────────────────────
console.log("\nTest 3: Root-only artifacts are preserved after sync");

// Ensure root-only artifacts exist before sync (create any that are missing)
const createdArtifacts = [];
for (const artifact of ROOT_ONLY) {
  const artifactPath = path.join(destDir, artifact);
  if (!fs.existsSync(artifactPath)) {
    if (artifact === "node_modules" || artifact === "data") {
      fs.mkdirSync(artifactPath, { recursive: true });
    } else {
      fs.writeFileSync(artifactPath, "# test artifact\n");
    }
    createdArtifacts.push(artifact);
  }
}

// Run sync
try {
  runSync();
} catch (err) {
  assert(false, `Sync ran successfully in test 3 (got: ${err.message})`);
}

// Verify all root-only artifacts still exist
let allPreserved = true;
for (const artifact of ROOT_ONLY) {
  const artifactPath = path.join(destDir, artifact);
  if (!fs.existsSync(artifactPath)) {
    assert(false, `Root-only artifact deleted: ${artifact}`);
    allPreserved = false;
  }
}
if (allPreserved) {
  assert(true, "All root-only artifacts preserved");
}

// Clean up artifacts we created for this test
for (const artifact of createdArtifacts) {
  const artifactPath = path.join(destDir, artifact);
  if (fs.existsSync(artifactPath)) {
    const stat = fs.lstatSync(artifactPath);
    if (stat.isDirectory()) {
      fs.rmSync(artifactPath, { recursive: true });
    } else {
      fs.unlinkSync(artifactPath);
    }
  }
}

// ─── Test 4: Stale files are removed ────────────────────────────────────────
console.log("\nTest 4: Stale files are removed");

// Create a stale file in root .opencode/
const staleFile = path.join(destDir, "__stale_test_file__.tmp");
fs.writeFileSync(staleFile, "this should be removed by sync\n");
assert(fs.existsSync(staleFile), "Stale test file created");

// Create a stale directory in root .opencode/
const staleDir = path.join(destDir, "__stale_test_dir__");
fs.mkdirSync(staleDir, { recursive: true });
fs.writeFileSync(
  path.join(staleDir, "nested.txt"),
  "nested stale file\n"
);
assert(fs.existsSync(staleDir), "Stale test directory created");

// Run sync
try {
  runSync();
} catch (err) {
  assert(false, `Sync ran successfully in test 4 (got: ${err.message})`);
}

assert(!fs.existsSync(staleFile), "Stale file was removed");
assert(!fs.existsSync(staleDir), "Stale directory was removed");

// ─── Test 5: --verify flag works ────────────────────────────────────────────
console.log("\nTest 5: --verify flag reports success when in sync");
try {
  const output = runSync("--verify");
  assert(
    output.includes("Integrity verification passed"),
    "--verify reports integrity passed"
  );
} catch (err) {
  assert(false, `--verify ran without error (got: ${err.message})`);
}

// ─── Test 6: --verify detects discrepancies (negative test) ─────────────────
console.log("\nTest 6: --verify detects discrepancies (negative test)");

// Step 1: Ensure baseline is in sync
try {
  runSync();
} catch (err) {
  assert(false, `Baseline sync succeeded in test 6 (got: ${err.message})`);
}

// Step 2: Pick a known file and delete it from root to create a discrepancy
let targetFile = null;
for (const rel of srcPaths) {
  const destPath = path.join(destDir, rel);
  if (fs.existsSync(destPath) && fs.statSync(destPath).isFile()) {
    targetFile = rel;
    break;
  }
}

if (targetFile) {
  const targetPath = path.join(destDir, targetFile);
  fs.unlinkSync(targetPath);
  assert(
    !fs.existsSync(targetPath),
    `Deleted ${targetFile} from root to create discrepancy`
  );

  // Step 3: Run --verify-only and expect failure (exit code 1)
  // --verify-only runs integrity check without syncing, so the discrepancy persists
  let combinedOutput = "";
  let exitCode = null;
  try {
    combinedOutput = runSync("--verify-only");
    exitCode = 0;
  } catch (err) {
    exitCode = err.status;
    combinedOutput = (err.stdout || "") + "\n" + (err.stderr || "");
  }

  assert(
    exitCode === 1,
    `--verify-only exited with code 1 when discrepancy exists (got: ${exitCode})`
  );
  assert(
    combinedOutput.includes("Missing in root"),
    "--verify-only output reports missing file"
  );

  // Step 4: Re-sync to restore the deleted file for subsequent tests
  try {
    runSync();
    assert(
      fs.existsSync(targetPath),
      `Re-sync restored ${targetFile}`
    );
  } catch (err) {
    assert(false, `Re-sync succeeded in test 6 (got: ${err.message})`);
  }
} else {
  assert(false, "Could not find a src file to use for discrepancy test");
}

// ─── Test 7: opencode.json content is synced from src ───────────────────────
console.log("\nTest 7: opencode.json content is synced from src");
try {
  runSync();
} catch (err) {
  assert(false, `Sync ran without error in test 7 (got: ${err.message})`);
}

assert(
  fs.existsSync(destOpenCodeJson),
  "Root opencode.json exists after sync"
);

const srcJsonContent = fs.readFileSync(fixtureSrcOpenCodeJson, "utf-8");
const destJsonContent = fs.readFileSync(destOpenCodeJson, "utf-8");
assert(
  srcJsonContent === destJsonContent,
  "Root opencode.json content matches src/opencode.json byte-for-byte"
);

// ─── Test 8: --verify checks opencode.json integrity ────────────────────────
console.log("\nTest 8: --verify checks opencode.json integrity");
try {
  const output = runSync("--verify");
  assert(
    output.includes("opencode.json matches src/opencode.json"),
    "--verify output confirms opencode.json integrity"
  );
} catch (err) {
  assert(
    false,
    `--verify ran without error in test 8 (got: ${err.message})`
  );
}

// ─── Test 9: --verify-only detects opencode.json content discrepancy ────────
console.log(
  "\nTest 9: --verify-only detects opencode.json content discrepancy"
);

// Ensure baseline is in sync
try {
  runSync();
} catch (err) {
  assert(
    false,
    `Baseline sync succeeded in test 9 (got: ${err.message})`
  );
}

// Modify root opencode.json to create a content discrepancy
const originalJsonContent = fs.readFileSync(destOpenCodeJson, "utf-8");
let test9ResyncError = null;
try {
  fs.writeFileSync(
    destOpenCodeJson,
    originalJsonContent + "\n// tampered\n",
    "utf-8"
  );
  assert(
    fs.readFileSync(destOpenCodeJson, "utf-8") !== srcJsonContent,
    "Root opencode.json modified to create discrepancy"
  );

  // Run --verify-only and expect failure
  let test9Output = "";
  let test9ExitCode = null;
  try {
    test9Output = runSync("--verify-only");
    test9ExitCode = 0;
  } catch (err) {
    test9ExitCode = err.status;
    test9Output = (err.stdout || "") + "\n" + (err.stderr || "");
  }

  assert(
    test9ExitCode === 1,
    `--verify-only exited with code 1 for opencode.json mismatch (got: ${test9ExitCode})`
  );
  assert(
    test9Output.includes("does not match src/opencode.json"),
    "--verify-only output reports opencode.json content mismatch"
  );
} finally {
  // Always restore root opencode.json, even if setup or verification fails.
  try {
    runSync();
  } catch (err) {
    test9ResyncError = err;
  } finally {
    if (
      !fs.existsSync(destOpenCodeJson) ||
      fs.readFileSync(destOpenCodeJson, "utf-8") !== originalJsonContent
    ) {
      fs.writeFileSync(destOpenCodeJson, originalJsonContent, "utf-8");
    }
  }
}

if (test9ResyncError) {
  assert(
    false,
    `Re-sync succeeded in test 9 (got: ${test9ResyncError.message})`
  );
}
const restoredJsonContent = fs.readFileSync(destOpenCodeJson, "utf-8");
assert(
  restoredJsonContent === srcJsonContent,
  "Re-sync restored root opencode.json content"
);

// ─── Test 10: --verify-only detects missing root opencode.json ──────────────
console.log("\nTest 10: --verify-only detects missing root opencode.json");

// Ensure baseline is in sync
try {
  runSync();
} catch (err) {
  assert(
    false,
    `Baseline sync succeeded in test 10 (got: ${err.message})`
  );
}

// Delete root opencode.json to create a missing-file discrepancy
fs.unlinkSync(destOpenCodeJson);
assert(
  !fs.existsSync(destOpenCodeJson),
  "Root opencode.json deleted to create discrepancy"
);

// Run --verify-only and expect failure
let test10Output = "";
let test10ExitCode = null;
try {
  test10Output = runSync("--verify-only");
  test10ExitCode = 0;
} catch (err) {
  test10ExitCode = err.status;
  test10Output = (err.stdout || "") + "\n" + (err.stderr || "");
}

assert(
  test10ExitCode === 1,
  `--verify-only exited with code 1 for missing opencode.json (got: ${test10ExitCode})`
);
assert(
  test10Output.includes("Missing") &&
    test10Output.includes("opencode.json"),
  "--verify-only output reports missing root opencode.json"
);

// Restore by re-syncing
try {
  runSync();
  assert(
    fs.existsSync(destOpenCodeJson),
    "Re-sync restored root opencode.json"
  );
} catch (err) {
  assert(false, `Re-sync succeeded in test 10 (got: ${err.message})`);
}

// ─── Test 11: Sync fails when src/opencode.json is missing ──────────────────
console.log("\nTest 11: Sync fails when src/opencode.json is missing");

// Temporarily rename fixture src/opencode.json to simulate its absence
const tmpSrcJson = fixtureSrcOpenCodeJson + ".tmp_test_backup";
let srcJsonWasRenamed = false;
try {
  fs.renameSync(fixtureSrcOpenCodeJson, tmpSrcJson);
  srcJsonWasRenamed = true;
  assert(
    !fs.existsSync(fixtureSrcOpenCodeJson),
    "src/opencode.json temporarily removed"
  );

  // Run sync and expect failure
  let test11Output = "";
  let test11ExitCode = null;
  try {
    test11Output = runSync();
    test11ExitCode = 0;
  } catch (err) {
    test11ExitCode = err.status;
    test11Output = (err.stdout || "") + "\n" + (err.stderr || "");
  }

  assert(
    test11ExitCode === 1,
    `Sync exited with code 1 when src/opencode.json missing (got: ${test11ExitCode})`
  );
  assert(
    test11Output.includes("source file not found") ||
      test11Output.includes("Error"),
    "Sync error message mentions missing source file"
  );
} finally {
  // Always restore fixture src/opencode.json
  if (srcJsonWasRenamed && fs.existsSync(tmpSrcJson)) {
    fs.renameSync(tmpSrcJson, fixtureSrcOpenCodeJson);
  }
}

assert(
  fs.existsSync(fixtureSrcOpenCodeJson),
  "src/opencode.json restored after test"
);

// ─── Test 12: Mode 2 creates missing files at root ──────────────────────────
console.log("\nTest 12: Mode 2 creates missing files at root");

// Seed files used for Mode 2 verification. The pre-test state had neither
// file at root, so we delete any that exist to force Mode 2 to recreate them.
const buildingPath = path.join(tempRoot, "BUILDING.md");
const testingPath = path.join(tempRoot, "TESTING.md");
const srcBuildingPath = path.join(tempRoot, "src", "BUILDING.md");
const srcTestingPath = path.join(tempRoot, "src", "TESTING.md");
try { fs.unlinkSync(buildingPath); } catch {}
try { fs.unlinkSync(testingPath); } catch {}
assert(!fs.existsSync(buildingPath), "Pre-test: root/BUILDING.md deleted");
assert(!fs.existsSync(testingPath), "Pre-test: root/TESTING.md deleted");

try {
  runSync();
} catch (err) {
  assert(false, `Sync ran without error in test 12 (got: ${err.message})`);
}

const srcBuildingContent = fs.readFileSync(srcBuildingPath, "utf-8");
const srcTestingContent = fs.readFileSync(srcTestingPath, "utf-8");
assert(fs.existsSync(buildingPath), "Mode 2 created root/BUILDING.md");
assert(fs.existsSync(testingPath), "Mode 2 created root/TESTING.md");
assert(
  fs.readFileSync(buildingPath, "utf-8") === srcBuildingContent,
  "root/BUILDING.md content matches src/BUILDING.md"
);
assert(
  fs.readFileSync(testingPath, "utf-8") === srcTestingContent,
  "root/TESTING.md content matches src/TESTING.md"
);

// ─── Test 13: Mode 2 leaves existing files alone ───────────────────────────
console.log("\nTest 13: Mode 2 leaves existing files alone");

const sentinelContent = "# sentinel — Mode 2 must not overwrite\n";
fs.writeFileSync(buildingPath, sentinelContent, "utf-8");
assert(
  fs.readFileSync(buildingPath, "utf-8") === sentinelContent,
  "Sentinel written to root/BUILDING.md"
);

try {
  runSync();
} catch (err) {
  assert(false, `Sync ran without error in test 13 (got: ${err.message})`);
}

assert(
  fs.readFileSync(buildingPath, "utf-8") === sentinelContent,
  "Mode 2 did not overwrite sentinel content in root/BUILDING.md"
);
assert(
  fs.readFileSync(buildingPath, "utf-8") !== srcBuildingContent,
  "root/BUILDING.md still has sentinel content (not src content)"
);

// Clean up: delete the sentinel so the next sync re-creates it from src/
try { fs.unlinkSync(buildingPath); } catch {}

// ─── Test 14: --verify-only detects Mode 2 drift ────────────────────────────
console.log("\nTest 14: --verify-only detects Mode 2 drift");

// Ensure baseline is in sync (re-creates BUILDING.md from src/)
try {
  runSync();
} catch (err) {
  assert(false, `Baseline sync succeeded in test 14 (got: ${err.message})`);
}
assert(
  fs.existsSync(buildingPath),
  "Baseline: root/BUILDING.md present after sync"
);

// Delete root/BUILDING.md to create Mode 2 drift
fs.unlinkSync(buildingPath);
assert(
  !fs.existsSync(buildingPath),
  "root/BUILDING.md deleted to create Mode 2 drift"
);

// Run --verify-only and expect failure
let test14Output = "";
let test14ExitCode = null;
try {
  test14Output = runSync("--verify-only");
  test14ExitCode = 0;
} catch (err) {
  test14ExitCode = err.status;
  test14Output = (err.stdout || "") + "\n" + (err.stderr || "");
}

assert(
  test14ExitCode === 1,
  `--verify-only exited with code 1 for Mode 2 drift (got: ${test14ExitCode})`
);
assert(
  test14Output.includes("Mode 2 drift") ||
    test14Output.includes("missing from root"),
  "--verify-only output reports Mode 2 drift"
);

// Re-sync to clean state for any subsequent runs
try {
  runSync();
  assert(
    fs.existsSync(buildingPath),
    "Re-sync restored root/BUILDING.md"
  );
} catch (err) {
  assert(false, `Re-sync succeeded in test 14 (got: ${err.message})`);
}

// ─── Test 15: Empty consumer dir gets fully populated by sync ──────────────
console.log("\nTest 15: Empty consumer dir gets fully populated by sync");

const test15Dir = path.join(tempRoot, "test15");
fs.mkdirSync(test15Dir, { recursive: true });
assert(
  fs.readdirSync(test15Dir).length === 0,
  "Test 15 starts with an empty consumer dir"
);

try {
  runSync("", { consumer: test15Dir });
} catch (err) {
  assert(false, `Sync populated empty consumer (got: ${err.message})`);
}

const test15OpenCode = path.join(test15Dir, ".opencode");
const test15OpenCodeJson = path.join(test15Dir, "opencode.json");
assert(
  fs.existsSync(test15OpenCode),
  "test15: .opencode/ was created"
);
assert(
  fs.existsSync(test15OpenCodeJson),
  "test15: opencode.json was created"
);

// Mode 1: full .opencode/ match (sample by checking byte-for-byte equality
// across every file path present in src/.opencode/).
const test15OpenCodePaths = collectRelativePaths(test15OpenCode, test15OpenCode);
const test15SrcFilePaths = filterFilesOnly(fixtureSrcDir, srcPaths);
let test15Mode1Match = true;
for (const rel of test15SrcFilePaths) {
  const srcPath = path.join(fixtureSrcDir, rel);
  const test15Path = path.join(test15OpenCode, rel);
  if (!filesAreEqual(srcPath, test15Path)) {
    assert(false, `test15: .opencode/${rel} does not match src byte-for-byte`);
    test15Mode1Match = false;
  }
}
if (test15Mode1Match) {
  assert(
    true,
    `test15: all ${test15SrcFilePaths.size} .opencode/ files match src byte-for-byte`
  );
}

assert(
  filesAreEqual(fixtureSrcOpenCodeJson, test15OpenCodeJson),
  "test15: opencode.json matches src/opencode.json byte-for-byte"
);

// Mode 2: seed files exist with src content. The list mirrors the seed
// files in src/ — root-only consumer files (e.g. guiding-principles.md)
// are not produced by sync and are excluded.
const test15SeedFiles = [
  "BUILDING.md",
  "TESTING.md",
  "AGENTS.md",
  "AGENTIC_WORKFLOW.md",
  "README.md",
  "CONTRIBUTING.md",
  "scratch/README.md",
];
for (const rel of test15SeedFiles) {
  const test15SeedPath = path.join(test15Dir, rel);
  const srcSeedPath = path.join(tempRoot, "src", rel);
  assert(
    fs.existsSync(test15SeedPath),
    `test15: seed file ${rel} was created`
  );
  assert(
    filesAreEqual(srcSeedPath, test15SeedPath),
    `test15: seed file ${rel} matches src content byte-for-byte`
  );
}

// docs/ subtree matches src/docs/ recursively (sample by comparing every
// file under both trees byte-for-byte).
const test15DocsDir = path.join(test15Dir, "docs");
const test15DocsFiles = collectFilesRecursive(test15DocsDir, test15DocsDir);
const srcDocsFiles = collectFilesRecursive(
  path.join(tempRoot, "src", "docs"),
  path.join(tempRoot, "src", "docs")
);
assert(
  test15DocsFiles.length === srcDocsFiles.length,
  `test15: docs/ file count matches src (${test15DocsFiles.length} vs ${srcDocsFiles.length})`
);
const srcDocsBase = path.join(tempRoot, "src", "docs");
let test15DocsMatch = true;
for (const rel of srcDocsFiles) {
  if (!filesAreEqual(path.join(srcDocsBase, rel), path.join(test15DocsDir, rel))) {
    assert(false, `test15: docs/${rel} does not match src`);
    test15DocsMatch = false;
  }
}
if (test15DocsMatch && test15DocsFiles.length > 0) {
  assert(
    true,
    `test15: all ${test15DocsFiles.length} docs/ files match src byte-for-byte`
  );
}

// Spot-check a few well-known docs paths to make the assertion explicit.
const test15DocsSpotChecks = [
  "specs/index.md",
  "specs/template.md",
  "architecture/index.md",
  "architecture/template.md",
  "plans/template.md",
];
for (const rel of test15DocsSpotChecks) {
  assert(
    filesAreEqual(
      path.join(srcDocsBase, rel),
      path.join(test15DocsDir, rel)
    ),
    `test15: docs/${rel} matches src byte-for-byte`
  );
}

// ktlo/ subtree matches src/ktlo/ recursively.
const test15KtloDir = path.join(test15Dir, "ktlo");
const test15KtloFiles = collectFilesRecursive(test15KtloDir, test15KtloDir);
const srcKtloBase = path.join(tempRoot, "src", "ktlo");
const srcKtloFiles = collectFilesRecursive(srcKtloBase, srcKtloBase);
assert(
  test15KtloFiles.length === srcKtloFiles.length,
  `test15: ktlo/ file count matches src (${test15KtloFiles.length} vs ${srcKtloFiles.length})`
);
let test15KtloMatch = true;
for (const rel of srcKtloFiles) {
  if (!filesAreEqual(path.join(srcKtloBase, rel), path.join(test15KtloDir, rel))) {
    assert(false, `test15: ktlo/${rel} does not match src`);
    test15KtloMatch = false;
  }
}
if (test15KtloMatch && test15KtloFiles.length > 0) {
  assert(
    true,
    `test15: all ${test15KtloFiles.length} ktlo/ files match src byte-for-byte`
  );
}

// ─── Test 16: Existing consumer with customizations ────────────────────────
console.log(
  "\nTest 16: Existing consumer with customizations — Mode 1 replaces, Mode 2 preserves"
);

const test16Dir = path.join(tempRoot, "test16");
fs.mkdirSync(test16Dir, { recursive: true });

// Mirror the seed file shape by running sync once on the empty consumer,
// then customizing. (We can't simply rely on a hand-rolled mirror because
// Mode 2 logic is the behavior under test.)
runSync("", { consumer: test16Dir });

// Mode 1 targets: overwrite .opencode/ agents and opencode.json with
// sentinels; add a stale file inside .opencode/.
const test16OrchestratorPath = path.join(
  test16Dir,
  ".opencode",
  "agents",
  "orchestrator.md"
);
const test16ImplementorPath = path.join(
  test16Dir,
  ".opencode",
  "agents",
  "implementor.md"
);
const test16OpenCodeJsonPath = path.join(test16Dir, "opencode.json");
const test16StaleMarker = path.join(test16Dir, ".opencode", "__stale_test_marker__.md");

const mode1Sentinel = "# mode-1 sentinel — should be replaced by sync\n";
fs.writeFileSync(test16OrchestratorPath, mode1Sentinel, "utf-8");
fs.writeFileSync(test16ImplementorPath, mode1Sentinel, "utf-8");
const originalTest16Json = fs.readFileSync(test16OpenCodeJsonPath, "utf-8");
fs.writeFileSync(
  test16OpenCodeJsonPath,
  originalTest16Json + "\n// tampered\n",
  "utf-8"
);
fs.writeFileSync(test16StaleMarker, "stale\n", "utf-8");

// Mode 2 targets: overwrite BUILDING.md and TESTING.md with sentinels.
const test16BuildingPath = path.join(test16Dir, "BUILDING.md");
const test16TestingPath = path.join(test16Dir, "TESTING.md");
const mode2Sentinel = "# mode-2 sentinel — must be preserved by sync\n";
fs.writeFileSync(test16BuildingPath, mode2Sentinel, "utf-8");
fs.writeFileSync(test16TestingPath, mode2Sentinel, "utf-8");

// Snapshot the src files we're comparing against.
const srcOrchestratorPath = path.join(
  tempRoot,
  "src",
  ".opencode",
  "agents",
  "orchestrator.md"
);
const srcImplementorPath = path.join(
  tempRoot,
  "src",
  ".opencode",
  "agents",
  "implementor.md"
);

// Run sync against the customized consumer.
try {
  runSync("", { consumer: test16Dir });
} catch (err) {
  assert(false, `Sync ran on customized consumer (got: ${err.message})`);
}

// Mode 1 assertions: replaced with src content, stale marker removed.
assert(
  filesAreEqual(srcOrchestratorPath, test16OrchestratorPath),
  "test16: .opencode/agents/orchestrator.md replaced with src content"
);
assert(
  filesAreEqual(srcImplementorPath, test16ImplementorPath),
  "test16: .opencode/agents/implementor.md replaced with src content"
);
assert(
  fs.readFileSync(test16OpenCodeJsonPath, "utf-8") === originalTest16Json,
  "test16: opencode.json replaced with src content"
);
assert(
  !fs.existsSync(test16StaleMarker),
  "test16: stale marker file was removed"
);

// Mode 2 assertions: sentinels preserved untouched.
assert(
  fs.readFileSync(test16BuildingPath, "utf-8") === mode2Sentinel,
  "test16: BUILDING.md sentinel preserved (Mode 2 left alone)"
);
assert(
  fs.readFileSync(test16TestingPath, "utf-8") === mode2Sentinel,
  "test16: TESTING.md sentinel preserved (Mode 2 left alone)"
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

#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { init } = require("../package/deploy-roundhouse");
const { parseArgs } = require("node:util");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const cli = path.join(root, "package", "roundhouse.js");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// Optional --version X.Y.Z flag for release-prep verification. When provided,
// the test asserts package.json's version matches. When absent, the assertion
// is skipped (backward-compatible with existing invocations that don't pass it).
const { values: cliOptions } = parseArgs({
  options: {
    version: { type: "string" },
  },
  strict: true,
  allowPositionals: false,
});
const expectedVersion = cliOptions.version ?? null;

if (expectedVersion !== null) {
  assert.strictEqual(packageJson.version, expectedVersion, `package.json version (${packageJson.version}) matches --version argument (${expectedVersion})`);
}

function files(dir, base = dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...files(full, base));
    else result.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return result;
}

const npmCommand = "npm";
const npmArgs = ["pack", "--dry-run", "--json", "--ignore-scripts"];
const npmOptions = { cwd: root, encoding: "utf8", shell: process.platform === "win32" };
const pack = JSON.parse(execFileSync(npmCommand, npmArgs, npmOptions))[0];
const packed = new Set(pack.files.map((file) => file.path));
const runtimeFiles = files(path.join(root, "package")).map((file) => `package/${file}`);
const templateFiles = files(src).map((file) => `src/${file}`);
const allowedFiles = new Set(["package.json", "README.md", "LICENSE", ...runtimeFiles, ...templateFiles]);
assert.strictEqual(packageJson.license, "MIT", "package metadata declares the license");
assert(packed.has("README.md"), "tarball manifest includes root README package metadata");
assert(packed.has("LICENSE"), "tarball manifest includes LICENSE package metadata");
assert(packed.has("src/README.md"), "tarball manifest includes template README deployment content");
assert(packed.has("src/scratch/README.md"), "tarball manifest includes scratch");
const lifecycleHooks = ["prepublish", "prepare", "preprepare", "postprepare", "prepublishOnly", "prepack", "postpack", "publish", "postpublish", "preinstall", "install", "postinstall", "dependencies"];
for (const hook of lifecycleHooks) assert(!packageJson.scripts?.[hook], `package has no ${hook} lifecycle script`);
for (const file of allowedFiles) assert(packed.has(file), `package manifest includes ${file}`);
for (const file of packed) assert(allowedFiles.has(file), `package manifest excludes unexpected ${file}`);
for (const file of ["AGENTS.md", "AGENTIC_WORKFLOW.md", "CONTRIBUTING.md", "BUILDING.md", "TESTING.md", "docs/", "references/", "guiding-principles.md", "scripts/"]) {
  assert(![...packed].some((item) => item === file || item.startsWith(file)), `package allowlist excludes root artifact ${file}`);
}
for (const file of ["AGENTS.md", "AGENTIC_WORKFLOW.md", "CONTRIBUTING.md", "guiding-principles.md", "docs/", "references/", "scripts/sync-opencode.js", "scripts/test-sync.js", "scripts/test-package.js"]) {
  assert(![...packed].some((item) => item === file || item.startsWith(file)), `package excludes ${file}`);
}

// Inspect and execute a real packed artifact. npm extracts the archive itself,
// so this remains portable when an external tar executable is unavailable.
const actualPack = JSON.parse(execFileSync(npmCommand, ["pack", "--json", "--ignore-scripts"], npmOptions))[0];
const tarball = path.join(root, actualPack.filename);
try {
  const consumer = fs.mkdtempSync(path.join(os.tmpdir(), "roundhouse-packed-consumer-"));
  try {
    execFileSync(npmCommand, ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], { ...npmOptions, cwd: consumer });
    const installedCli = path.join(consumer, "node_modules", "@backshopdev", "roundhouse", "package", "roundhouse.js");
    assert(fs.existsSync(installedCli), "packed artifact installs its CLI");
    const packedRun = (...args) => execFileSync(process.execPath, [installedCli, ...args], { cwd: consumer, encoding: "utf8" });
    packedRun("init");
    assert(fs.existsSync(path.join(consumer, "scratch", "README.md")), "packed CLI init delivers scratch");
    const before = files(consumer).map((file) => [file, fs.statSync(path.join(consumer, file)).mtimeMs]);
    packedRun("update", "--dry-run");
    assert.deepStrictEqual(files(consumer).map((file) => [file, fs.statSync(path.join(consumer, file)).mtimeMs]), before, "packed CLI dry-run is non-mutating");
    packedRun("update");
  } finally { fs.rmSync(consumer, { recursive: true, force: true }); }
} finally {
  fs.rmSync(tarball, { force: true });
}

function run(temp, ...args) {
  return execFileSync(process.execPath, [cli, ...args], { cwd: temp, encoding: "utf8" });
}
function read(rel, temp) { return fs.readFileSync(path.join(temp, rel), "utf8"); }

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "roundhouse-test-"));
try {
  // Init dry-run on a fresh consumer is non-mutating and reports its work.
  const initDryRun = run(temp, "init", "--dry-run");
  assert.deepStrictEqual(files(temp), [], "init dry-run creates no files");
  assert(initDryRun.includes("Would create"), "init dry-run reports creates");

  // Fresh init creates the complete template, including nested directories.
  const initOutput = run(temp, "init");
  for (const file of files(src)) assert.strictEqual(read(file, temp), read(file, src), `init creates ${file}`);
  assert.notStrictEqual(read("README.md", temp), read("README.md", root), "init deploys src/README.md, not the root package README");
  assert(!fs.existsSync(path.join(temp, "LICENSE")), "init never deploys root LICENSE metadata");
  assert(initOutput.includes("Created:"), "init reports created entries");

  // Init never overwrites consumer files and reports them as skipped.
  const seed = path.join(temp, "README.md");
  fs.writeFileSync(seed, "consumer README\n");
  const initAgain = run(temp, "init");
  assert.strictEqual(fs.readFileSync(seed, "utf8"), "consumer README\n");
  assert(initAgain.includes("Skipped existing:"), "init reports skipped existing files");

  // Update overwrites managed content, removes stale managed files, and preserves seeds.
  fs.writeFileSync(path.join(temp, "opencode.json"), "old config\n");
  const stale = path.join(temp, ".opencode", "stale.txt");
  fs.writeFileSync(stale, "stale\n");
  fs.writeFileSync(path.join(temp, "AGENTS.md"), "consumer agents\n");
  const updateOutput = run(temp, "update");
  assert.strictEqual(read("opencode.json", temp), read("opencode.json", src), "update overwrites opencode.json");
  assert(!fs.existsSync(stale), "update removes stale managed files");
  assert.strictEqual(read("AGENTS.md", temp), "consumer agents\n", "update preserves seed files");
  assert(updateOutput.includes("Seed files are never overwritten"), "update documents seed policy");

  // A consumer file at the package-owned managed root is rejected before any mutation.
  fs.rmSync(path.join(temp, ".opencode"), { recursive: true, force: true });
  fs.writeFileSync(path.join(temp, ".opencode"), "consumer managed root\n");
  const protectedSeed = read("AGENTS.md", temp);
  let managedRootError;
  try { run(temp, "update"); } catch (error) { managedRootError = `${error.stderr || ""}\n${error.message}`; }
  assert(managedRootError && /managed destination root must be a directory/.test(managedRootError), "update rejects a file at managed .opencode root");
  assert.strictEqual(read(".opencode", temp), "consumer managed root\n", "managed-root rejection preserves the consumer file");
  assert.strictEqual(read("AGENTS.md", temp), protectedSeed, "managed-root rejection occurs before seed mutation");
  fs.rmSync(path.join(temp, ".opencode"), { force: true });
  run(temp, "update");

  // Newly added seed files are created on update, while managed files continue to overwrite.
  fs.unlinkSync(path.join(temp, "BUILDING.md"));
  run(temp, "update");
  assert.strictEqual(read("BUILDING.md", temp), read("BUILDING.md", src), "update creates missing seed files");

  // Dry-run is non-mutating for both lifecycle paths.
  fs.unlinkSync(path.join(temp, "TESTING.md"));
  const dryStale = path.join(temp, ".opencode", "dry-run-stale.txt");
  fs.writeFileSync(dryStale, "must remain\n");
  fs.writeFileSync(path.join(temp, ".opencode", "agents", "dry-run-edit.md"), "consumer edit\n");
  const before = files(temp).map((file) => [file, fs.statSync(path.join(temp, file)).mtimeMs, read(file, temp)]);
  run(temp, "update", "--dry-run");
  assert.deepStrictEqual(files(temp).map((file) => [file, fs.statSync(path.join(temp, file)).mtimeMs, read(file, temp)]), before, "update dry-run makes no changes");
  assert(fs.existsSync(dryStale), "dry-run does not remove stale entries");

  // Init handles incompatible consumer types without deleting them.
  const conflict = path.join(temp, "docs");
  fs.rmSync(conflict, { recursive: true, force: true });
  fs.writeFileSync(conflict, "consumer docs\n");
  const conflictOutput = run(temp, "init");
  assert.strictEqual(fs.readFileSync(conflict, "utf8"), "consumer docs\n");
  assert(conflictOutput.includes("Skipped incompatible existing"), "init reports type conflicts");

  // Managed update replaces incompatible managed types deliberately.
  const managedConflict = path.join(temp, ".opencode", "agents");
  fs.rmSync(managedConflict, { recursive: true, force: true });
  fs.writeFileSync(managedConflict, "consumer conflict\n");
  run(temp, "update");
  assert(fs.statSync(managedConflict).isDirectory(), "update repairs managed type conflicts");

  // A junction in a managed destination is rejected before any write/removal.
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "roundhouse-outside-"));
  const junction = path.join(temp, ".opencode");
  fs.rmSync(junction, { recursive: true, force: true });
  fs.symlinkSync(outside, junction, "junction");
  let deploymentError;
  try { run(temp, "update"); } catch (error) { deploymentError = `${error.stderr || ""}\n${error.message}`; }
  assert(deploymentError && /symlink or junction/.test(deploymentError), "update rejects managed junctions");
  assert(fs.existsSync(outside), "outside junction target remains");
  fs.rmSync(junction, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });

  const sourceLink = path.join(os.tmpdir(), `roundhouse-source-link-${process.pid}`);
  fs.rmSync(sourceLink, { recursive: true, force: true });
  fs.symlinkSync(src, sourceLink, "junction");
  try { assert.throws(() => init({ sourceDir: sourceLink, destinationDir: temp }), /source uses a symlink or junction/); } finally { fs.rmSync(sourceLink, { recursive: true, force: true }); }
  const nestedOutside = fs.mkdtempSync(path.join(os.tmpdir(), "roundhouse-nested-outside-"));
  const nestedLink = path.join(temp, "docs");
  fs.rmSync(nestedLink, { recursive: true, force: true });
  fs.symlinkSync(nestedOutside, nestedLink, "junction");
  try { assert.throws(() => run(temp, "update"), /symlink or junction/); assert.deepStrictEqual(files(nestedOutside), [], "nested destination target remains untouched"); }
  finally { fs.rmSync(nestedLink, { recursive: true, force: true }); fs.rmSync(nestedOutside, { recursive: true, force: true }); }

  // Unrelated consumer links are outside the destination tree the deployment reads.
  const unrelatedOutside = fs.mkdtempSync(path.join(os.tmpdir(), "roundhouse-unrelated-outside-"));
  const unrelatedLink = path.join(temp, "consumer-only-link");
  fs.symlinkSync(unrelatedOutside, unrelatedLink, "junction");
  try { run(temp, "update"); assert(fs.existsSync(unrelatedLink), "update ignores unrelated consumer links"); }
  finally { fs.rmSync(unrelatedLink, { recursive: true, force: true }); fs.rmSync(unrelatedOutside, { recursive: true, force: true }); }
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
console.log("Package and lifecycle tests passed.");

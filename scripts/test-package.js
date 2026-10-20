#!/usr/bin/env node
"use strict";

/**
 * test-package.js — workspace-root + lifecycle suite.
 *
 * Asserts the converted root manifest's workspace-shell shape (SCEN-046)
 * and the deploy tool's lifecycle behavior against temp consumers (init /
 * update semantics and safety rejections), with the composer-backed adapter
 * (package/deploy-roundhouse.js) as the engine (PLAN-20261019-04 T-13).
 * The lifecycle contracts hold: fresh init composes the complete consumer
 * scaffolding (the Core seed set and managed content), a repeated init
 * skips existing consumer files and reports them, update overwrites managed
 * content and creates newly-applicable seeds, dry-run forms mutate nothing,
 * and the junction/symlink/escape rejections hold. Assertions whose
 * expected values changed with the composer (the composed opencode.json,
 * the recorded-ownership stale detail, the seed-skip message) relabel to
 * the composer's outputs.
 *
 * The Phase 2 workspace-members block (SCEN-047..049's stub coverage) is
 * RETIRED post-cutover: its derivation source (the fixture's managed
 * annotations) is consumed by the content move, and the packages no longer
 * match the stub shape. SCEN-047..049's durable coverage transferred to the
 * composer suite's SCEN-059 assertions over the real 33-member set (the
 * coverage continuity per the Phase 2 plan's durable-test-home commitment).
 *
 * The legacy publish/tarball assertions were dropped with the root's
 * publish-oriented fields (SPEC-20261019-01); the lifecycle tests are
 * unchanged in contract.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { init, update, copyMissing } = require("../package/deploy-roundhouse");

const root = path.resolve(__dirname, "..");
const packagesDir = path.join(root, "packages");
const coreSeedDir = path.join(packagesDir, "roundhouse-core", "seed");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

// Root workspace-shell shape (SCEN-046): the field set is the contract.
assert.strictEqual(packageJson.name, "@backshopdev/roundhouse", "root manifest keeps its name");
assert.strictEqual(packageJson.private, true, "root manifest is a private workspace shell");
assert.deepStrictEqual(packageJson.workspaces, ["packages/*"], "root manifest declares the packages/* workspace");
assert.deepStrictEqual(
  packageJson.scripts,
  {
    "commit": "node scripts/commit.js",
    "sync-roundhouse": "node scripts/sync-roundhouse.js",
    "test-sync": "node scripts/test-sync.js",
    "test-package": "node scripts/test-package.js",
    "test-commit": "node scripts/test-commit.js",
    "check-contracts": "node scripts/check-contracts.js",
    "check-deps": "node scripts/check-deps.js",
    "check-matrix": "node packages/roundhouse-cli/test/composition-matrix.test.js",
    "check-drift": "node scripts/sync-roundhouse.js --mode verify",
    "check-pack": "node scripts/check-pack.js",
    "check-all": "node scripts/check-all.js",
  },
  "root scripts: the five lifecycle scripts verbatim plus the six Phase 9 check scripts"
);
assert.deepStrictEqual(packageJson.engines, { "node": ">= 24.0.0" }, "root engines stays verbatim");
for (const droppedField of ["version", "description", "bin", "files", "publishConfig", "license"]) {
  assert(!(droppedField in packageJson), `root manifest drops ${droppedField}`);
}

// No lifecycle hooks on the workspace root (kept from the pre-conversion suite).
const lifecycleHooks = ["prepublish", "prepare", "preprepare", "postprepare", "prepublishOnly", "prepack", "postpack", "publish", "postpublish", "preinstall", "install", "postinstall", "dependencies"];
for (const hook of lifecycleHooks) assert(!packageJson.scripts?.[hook], `package has no ${hook} lifecycle script`);

// ─── Workspace-members block: RETIRED post-cutover ──────────────────────────
// The Phase 2 block derived the 28 stub members from the committed fixture's
// managed annotations and asserted the stub pair shape. The cutover consumed
// the annotations' purpose (the content moved under the annotations' owners)
// and the packages now carry managed/seed trees, so the derivation and the
// stub-shape assertions no longer describe the tree. SCEN-047..049's durable
// coverage lives in the composer suite's SCEN-059 assertions over the real
// 33-member discovered set (vocabulary conformance, requires mapping, and
// the skills arrays derived against each member's managed/skills/ tree).

// ─── Lifecycle block (the composer-backed adapter) ──────────────────────────

function files(dir, base = dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...files(full, base));
    else result.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return result;
}

function run(temp, ...args) {
  return execFileSync(process.execPath, [path.join(root, "package", "roundhouse.js"), ...args], { cwd: temp, encoding: "utf8" });
}

function read(rel, temp) { return fs.readFileSync(path.join(temp, rel), "utf8"); }

/**
 * The expected composed managed set: every file under the packages' managed/
 * trees, as consumer-root-relative .opencode/ paths (the source relabel).
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

function packageSourceOf(relative) {
  // Resolve which package owns a managed relative path (the first match).
  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("roundhouse-")) continue;
    const candidate = path.join(packagesDir, entry.name, "managed", ...relative.split("/"));
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "roundhouse-test-"));
try {
  // Init dry-run on a fresh consumer is non-mutating and reports its work.
  const initDryRun = run(temp, "init", "--dry-run");
  assert.deepStrictEqual(files(temp), [], "init dry-run creates no files");
  assert(initDryRun.includes("Would create"), "init dry-run reports creates");

  // Fresh init composes the complete consumer scaffolding: the managed set
  // from the packages and the Core seed set.
  const initOutput = run(temp, "init");
  const managedPaths = expectedManagedPaths();
  for (const relative of managedPaths) {
    const source = packageSourceOf(relative);
    assert(source !== null, `sanity: a package owns managed/${relative}`);
    assert.strictEqual(read(path.join(".opencode", relative), temp), fs.readFileSync(source, "utf8"), `init composes .opencode/${relative}`);
  }
  for (const relative of files(coreSeedDir, coreSeedDir)) {
    assert.strictEqual(read(relative, temp), fs.readFileSync(path.join(coreSeedDir, ...relative.split("/")), "utf8"), `init deploys the Core seed ${relative}`);
  }
  assert.notStrictEqual(read("README.md", temp), read("README.md", root), "init deploys the Core seed README, not the root package README");
  assert(!fs.existsSync(path.join(temp, "LICENSE")), "init never deploys root LICENSE metadata");
  assert(initOutput.includes("Created managed file"), "init reports created managed entries");
  assert(initOutput.includes("Created seed"), "init reports created seed entries");

  // Init never overwrites consumer files and reports them as skipped.
  const seed = path.join(temp, "README.md");
  fs.writeFileSync(seed, "consumer README\n");
  const initAgain = run(temp, "init");
  assert.strictEqual(fs.readFileSync(seed, "utf8"), "consumer README\n");
  assert(initAgain.includes("Seed already present, skipped"), "repeated init reports skipped existing seeds");

  // Update overwrites managed content, regenerates the composed render,
  // preserves seeds, and preserves never-recorded consumer files
  // (recorded-ownership staleness).
  const composedJsonSnapshot = fs.readFileSync(path.join(temp, "opencode.json"));
  fs.writeFileSync(path.join(temp, "opencode.json"), "old config\n");
  const stale = path.join(temp, ".opencode", "stale.txt");
  fs.writeFileSync(stale, "stale\n");
  fs.writeFileSync(path.join(temp, "AGENTS.md"), "consumer agents\n");
  const updateOutput = run(temp, "update");
  assert.deepStrictEqual(fs.readFileSync(path.join(temp, "opencode.json")), composedJsonSnapshot, "update regenerates the composed opencode.json");
  assert(fs.existsSync(stale), "update preserves never-recorded consumer files (recorded-ownership staleness)");
  assert.strictEqual(read("AGENTS.md", temp), "consumer agents\n", "update preserves seed files");
  assert(updateOutput.includes("Seed already present, skipped"), "update reports the seed skip policy");

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
  assert.strictEqual(read("BUILDING.md", temp), fs.readFileSync(path.join(coreSeedDir, "BUILDING.md"), "utf8"), "update creates missing seed files from the Core seed set");

  // Dry-run is non-mutating for both lifecycle paths.
  fs.unlinkSync(path.join(temp, "TESTING.md"));
  const dryStale = path.join(temp, ".opencode", "dry-run-stale.txt");
  fs.writeFileSync(dryStale, "must remain\n");
  fs.writeFileSync(path.join(temp, ".opencode", "agents", "dry-run-edit.md"), "consumer edit\n");
  const before = files(temp).map((file) => [file, fs.statSync(path.join(temp, file)).mtimeMs, read(file, temp)]);
  run(temp, "update", "--dry-run");
  assert.deepStrictEqual(files(temp).map((file) => [file, fs.statSync(path.join(temp, file)).mtimeMs, read(file, temp)]), before, "update dry-run makes no changes");
  assert(fs.existsSync(dryStale), "dry-run does not remove stale entries");

  // Init handles incompatible consumer types without deleting them: a
  // consumer file at a seed parent-directory path means the seed cannot be
  // created — the seed is skipped with a report (the create-if-missing
  // contract), the consumer file is preserved, and init continues.
  const conflict = path.join(temp, "docs");
  fs.rmSync(conflict, { recursive: true, force: true });
  fs.writeFileSync(conflict, "consumer docs\n");
  const conflictOutput = run(temp, "init");
  assert.strictEqual(fs.readFileSync(conflict, "utf8"), "consumer docs\n");
  assert(conflictOutput.includes("Skipped incompatible existing"), "init reports type conflicts");

  // Managed update replaces incompatible managed types deliberately (the
  // managed-update repair semantics): a consumer file at a managed directory
  // path is removed, recreated as a directory, and repopulated.
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

  // The source-junction contract targets what the adapter actually reads:
  // the preserved copyMissing primitive rejects a junctioned source before
  // any mutation (the src/-based sourceDir parameter is inert surface).
  const sourceLink = path.join(os.tmpdir(), `roundhouse-source-link-${process.pid}`);
  fs.rmSync(sourceLink, { recursive: true, force: true });
  fs.symlinkSync(coreSeedDir, sourceLink, "junction");
  try { assert.throws(() => copyMissing(sourceLink, path.join(temp, "copied.md"), false, () => {}, temp), /source uses a symlink or junction/); } finally { fs.rmSync(sourceLink, { recursive: true, force: true }); }
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

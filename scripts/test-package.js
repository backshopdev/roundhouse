#!/usr/bin/env node
"use strict";

/**
 * test-package.js — workspace-root + lifecycle suite.
 *
 * Asserts the converted root manifest's workspace-shell shape (SCEN-046),
 * the 28 workspace members' envelope conformance (SCEN-047..049; the
 * envelopes carry the migrated Phase 3 vocabulary — skills/bash/requires —
 * per the WP-05 mapping), and the deploy tool's lifecycle behavior against
 * temp consumers (init / update semantics and safety rejections). The
 * legacy publish/tarball assertions were dropped with the root's
 * publish-oriented fields (SPEC-20261019-01); the lifecycle tests are
 * unchanged.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { init } = require("../package/deploy-roundhouse");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const cli = path.join(root, "package", "roundhouse.js");
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
  },
  "root scripts stay verbatim"
);
assert.deepStrictEqual(packageJson.engines, { "node": ">= 24.0.0" }, "root engines stays verbatim");
for (const droppedField of ["version", "description", "bin", "files", "publishConfig", "license"]) {
  assert(!(droppedField in packageJson), `root manifest drops ${droppedField}`);
}

// No lifecycle hooks on the workspace root (kept from the pre-conversion suite).
const lifecycleHooks = ["prepublish", "prepare", "preprepare", "postprepare", "prepublishOnly", "prepack", "postpack", "publish", "postpublish", "preinstall", "install", "postinstall", "dependencies"];
for (const hook of lifecycleHooks) assert(!packageJson.scripts?.[hook], `package has no ${hook} lifecycle script`);

// Workspace members: the 28 scaffolded stubs (SCEN-047..049). The member set
// is derived from the committed fixture's managed-entry owner values — the
// @backshop/roundhouse-<subject> form as the whole value; TODO rationale
// values select nothing. Each member directory name equals its npm name
// minus the @backshop/ scope.
const fixture = JSON.parse(fs.readFileSync(path.join(root, "references", "migration-baseline.json"), "utf8"));
const ownerNames = new Set(
  fixture.entries
    .filter((entry) => entry.classification === "managed" && typeof entry.intendedPhase5Owner === "string")
    .map((entry) => entry.intendedPhase5Owner)
    .filter((owner) => /^@backshop\/roundhouse-[a-z0-9-]+$/.test(owner))
);
assert.strictEqual(ownerNames.size, 28, "the committed fixture derives exactly 28 workspace members");
const memberNames = [...ownerNames].sort();
// The framework/CMS members whose migrated requires also include the
// applicable language package (DEC-20261017-02 rules 3 and 4, applied by
// the WP-05 envelope migration).
const frameworkCmsMembers = new Set([
  "roundhouse-framework-astro",
  "roundhouse-framework-react",
  "roundhouse-cms-apostrophe",
]);
const packagesDir = path.join(root, "packages");
assert.deepStrictEqual(
  fs.readdirSync(packagesDir).sort(),
  memberNames.map((memberName) => memberName.slice("@backshop/".length)),
  "packages/ contains exactly one directory per derived member and nothing else"
);
for (const memberName of memberNames) {
  const memberDirName = memberName.slice("@backshop/".length);
  const memberPath = path.join(packagesDir, memberDirName);
  assert(fs.statSync(memberPath).isDirectory(), `member ${memberDirName} is a directory`);
  // The CLI member gains the Phase 3 composer's tooling directories (bin/,
  // lib/, test/ — the plan's change map) and the bin member (WP-03); every
  // other member remains exactly the stub pair. No member carries managed/
  // or seed/ directories yet (Phase 5 moves content).
  const isCli = memberDirName === "roundhouse-cli";
  assert.deepStrictEqual(
    fs.readdirSync(memberPath).sort(),
    isCli ? ["bin", "lib", "package.json", "roundhouse.json", "test"] : ["package.json", "roundhouse.json"],
    isCli
      ? "member roundhouse-cli carries the stub pair plus the Phase 3 bin/lib/test tooling (no managed/ or seed/ directories)"
      : `member ${memberDirName} carries exactly the stub pair (no managed/ or seed/ directories)`
  );
  const stub = JSON.parse(fs.readFileSync(path.join(memberPath, "package.json"), "utf8"));
  assert.strictEqual(stub.name, memberName, `member ${memberDirName} name equals its fixture owner value`);
  assert.strictEqual(stub.version, "0.0.0", `member ${memberDirName} version is 0.0.0`);
  assert.strictEqual(stub.private, true, `member ${memberDirName} is private`);
  assert(
    typeof stub.description === "string" && stub.description.length > 0 && !stub.description.includes("\n"),
    `member ${memberDirName} description is a non-empty single line`
  );
  assert.deepStrictEqual(stub.engines, { "node": ">= 24.0.0" }, `member ${memberDirName} engines matches the root's`);
  assert.deepStrictEqual(
    Object.keys(stub).sort(),
    isCli ? ["bin", "description", "engines", "name", "private", "version"] : ["description", "engines", "name", "private", "version"],
    isCli
      ? "member roundhouse-cli package.json carries the five stub members plus bin (WP-03)"
      : `member ${memberDirName} package.json carries no other members`
  );
  const envelope = JSON.parse(fs.readFileSync(path.join(memberPath, "roundhouse.json"), "utf8"));
  assert.strictEqual(envelope.contractVersion, 1, `member ${memberDirName} contractVersion is 1`);
  assert.deepStrictEqual(envelope.skills, [], `member ${memberDirName} skills are empty`);
  assert.deepStrictEqual(envelope.bash, [], `member ${memberDirName} bash is empty`);
  const expectedRequires = memberDirName === "roundhouse-core" || memberDirName === "roundhouse-cli"
    ? []
    : frameworkCmsMembers.has(memberDirName)
      ? ["@backshop/roundhouse-core", "@backshop/roundhouse-lang-javascript"]
      : ["@backshop/roundhouse-core"];
  assert.deepStrictEqual(envelope.requires, expectedRequires, `member ${memberDirName} requires match the migrated mapping`);
  if (memberDirName === "roundhouse-core") {
    assert.strictEqual(envelope.kind, "core", `member ${memberDirName} kind is core`);
    assert.deepStrictEqual(Object.keys(envelope).sort(), ["bash", "contractVersion", "kind", "requires", "skills"], `member ${memberDirName} roundhouse.json carries no other members`);
  } else if (memberDirName === "roundhouse-cli") {
    assert(!("kind" in envelope), `member ${memberDirName} declares no kind`);
    assert.deepStrictEqual(Object.keys(envelope).sort(), ["bash", "contractVersion", "requires", "skills"], `member ${memberDirName} roundhouse.json carries no other members`);
  } else {
    assert.strictEqual(envelope.kind, "capability", `member ${memberDirName} kind is capability`);
    assert.deepStrictEqual(Object.keys(envelope).sort(), ["bash", "contractVersion", "kind", "requires", "skills"], `member ${memberDirName} roundhouse.json carries no other members`);
  }
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

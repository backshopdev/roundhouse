#!/usr/bin/env node
"use strict";

/**
 * composition-matrix.test.js
 *
 * The Phase 7 composition matrix (PLAN-20261019-05 WP-01): the seven
 * representative installations composed through the composer's bin (init,
 * compose twice, verify), each asserting the DR-03 invariant mapping's six
 * rows, plus the two negative dependency installations (framework-react
 * alone; cms-apostrophe alone) asserted to fail init with the
 * dependency-rule rejection.
 *
 * Harness (the composer-suite precedent): temp consumers under os.tmpdir();
 * the selected workspace packages declared in the consumer's package.json
 * and junctioned from the real packages/ tree into the consumer's
 * node_modules/ (read-only source; the real tree is never mutated — the
 * temp dirs and the gitignored scratch capture are the only writes).
 *
 * The invariant assertions are derived, not hand-listed: the expected skill
 * union is computed from the installed packages' roundhouse.json files, and
 * the bash expectation from the Core template — so the matrix stays
 * truthful as the taxonomy evolves.
 *
 * The full-matrix group cross-checks its temp render byte-identical to the
 * root's committed composed opencode.json (the plan's free cross-check) and
 * captures the render to scratch/phase7-full-set-render.json — WP-02's
 * comparison input.
 *
 * Usage:
 *   node packages/roundhouse-cli/test/composition-matrix.test.js
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

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const packagesDir = path.join(repoRoot, "packages");
const coreDir = path.join(packagesDir, "roundhouse-core");
const coreSeedDir = path.join(coreDir, "seed");
const BIN = path.join(repoRoot, "packages", "roundhouse-cli", "bin", "roundhouse.js");
const rootComposedRender = path.join(repoRoot, "opencode.json");
const capturePath = path.join(repoRoot, "scratch", "phase7-full-set-render.json");

const CORE_AGENTS = ["orchestrator", "document-author", "implementor", "reviewer"];

// ─── Helpers ────────────────────────────────────────────────────────────────

const tempDirs = [];

function makeTempDir(name) {
  fs.mkdirSync(path.join(os.tmpdir(), "opencode"), { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opencode", `roundhouse-matrix-${name}-`));
  tempDirs.push(dir);
  return dir;
}

// Safety net: remove temp consumers even if a test throws past its own
// cleanup (the composer-suite precedent; junctions are unlinked, their
// targets untouched).
process.on("exit", () => {
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

function sha256File(absolutePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(absolutePath)).digest("hex");
}

/**
 * The workspace member directory names (roundhouse-*), derived read-only
 * from the real packages/ tree.
 */
function allMemberDirs() {
  return fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("roundhouse-"))
    .map((entry) => entry.name)
    .sort();
}

/**
 * Build a temp consumer declaring the given member directory names as
 * dependencies, with node_modules junctions to the real workspace packages.
 */
function buildConsumer(name, memberDirs) {
  const dir = makeTempDir(name);
  const dependencies = Object.fromEntries(
    memberDirs.map((memberDir) => [`@backshop/${memberDir}`, "0.0.0"])
  );
  fs.writeFileSync(
    path.join(dir, "package.json"),
    `${JSON.stringify({ name: `matrix-${name}`, version: "0.0.0", private: true, dependencies }, null, 2)}\n`,
    "utf8"
  );
  const scopeDir = path.join(dir, "node_modules", "@backshop");
  fs.mkdirSync(scopeDir, { recursive: true });
  for (const memberDir of memberDirs) {
    fs.symlinkSync(path.join(packagesDir, memberDir), path.join(scopeDir, memberDir), "junction");
  }
  return dir;
}

function runBin(args, cwd) {
  const result = spawnSync(process.execPath, [BIN, ...args], { cwd, encoding: "utf8" });
  return { code: result.status, stdout: result.stdout || "", stderr: result.stderr || "" };
}

/**
 * The expected skill union: the byte-wise-sorted union of the installed
 * packages' skills arrays, derived from the real packages' envelopes.
 */
function expectedSkillUnion(memberDirs) {
  const skills = new Set();
  for (const memberDir of memberDirs) {
    const envelope = JSON.parse(fs.readFileSync(path.join(packagesDir, memberDir, "roundhouse.json"), "utf8"));
    for (const skill of envelope.skills) skills.add(skill);
  }
  return [...skills].sort();
}

/**
 * The six invariant assertions over one composed consumer (the DR-03
 * invariant mapping's rows 1, 3, 4, and 5; rows 2 and 6 are asserted by the
 * negative tests and the compose-twice flow respectively).
 */
function assertRenderInvariants(consumerDir, memberDirs) {
  const rendered = JSON.parse(fs.readFileSync(path.join(consumerDir, "opencode.json"), "utf8"));
  const union = expectedSkillUnion(memberDirs);

  // Invariant 1 + 3: only installed skills exist and are allowed — each Core
  // agent's rendered skill map is exactly the deny-all wildcard followed by
  // the byte-wise-sorted union (no extra, none missing — a dead skill name
  // from an absent package cannot appear in an exactly-equal map).
  const expectedMap = { "*": "deny" };
  for (const skill of union) expectedMap[skill] = "allow";
  const maps = CORE_AGENTS.map((agentName) => rendered.agent[agentName].permission.skill);
  for (const map of maps) {
    assert.deepEqual(map, expectedMap, "the rendered skill map equals the deny-all wildcard plus the sorted installed-skill union");
  }
  assert.equal(new Set(maps.map((map) => JSON.stringify(map))).size, 1, "the skill map is identical across the four Core agents");

  // Invariant 4: the Core agents remain loadable — the four agent entries
  // render with their scaffolding (mode, tuning member, permission block).
  for (const agentName of CORE_AGENTS) {
    const agent = rendered.agent[agentName];
    assert.equal(typeof agent.mode, "string", `agent ${agentName} renders its mode`);
    const tuning = agentName === "orchestrator" ? agent.steps : agent.temperature;
    assert.equal(typeof tuning, "number", `agent ${agentName} renders its tuning member`);
    assert.ok(agent.permission !== null && typeof agent.permission === "object", `agent ${agentName} renders its permission block`);
  }

  // Invariant 5: the reviewer's rendered block is coherent — the bash map is
  // the deny wildcard plus the union block (the union is empty post-cutover:
  // no package declares bash patterns), and the skill map is uniform.
  const reviewerBash = rendered.agent.reviewer.permission.bash;
  assert.equal(reviewerBash["*"], "deny", "the reviewer's bash map carries the deny wildcard");
  const template = JSON.parse(fs.readFileSync(path.join(coreDir, "opencode-template.json"), "utf8"));
  for (const agentName of CORE_AGENTS) {
    const templateBash = template.agent[agentName].permission.bash ?? {};
    const renderedBash = rendered.agent[agentName].permission.bash ?? {};
    assert.deepEqual(renderedBash, templateBash, `agent ${agentName}'s rendered bash map equals the template's role-driven entries (the package bash union is empty)`);
  }

  return rendered;
}

/**
 * The Core seed set's consumer-relative paths (the seed instances init
 * creates).
 */
function coreSeedPaths() {
  const result = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), relative);
      else result.push(relative);
    }
  };
  walk(coreSeedDir, "");
  return result.sort();
}

function seedHashes(consumerDir) {
  return coreSeedPaths().map((relative) => [
    relative,
    sha256File(path.join(consumerDir, ...relative.split("/"))),
  ]);
}

/**
 * One installation's full flow: init, compose twice (the seed invariant),
 * verify — with the invariant assertions and the byte-stability checks.
 */
function runInstallation(name, memberDirs) {
  const consumerDir = buildConsumer(name, memberDirs);

  const init = runBin(["init"], consumerDir);
  assert.equal(init.code, 0, `installation ${name}: init exits 0 (stderr: ${init.stderr})`);

  const renderHashAfterInit = sha256File(path.join(consumerDir, "opencode.json"));
  const seedsAfterInit = seedHashes(consumerDir);
  assertRenderInvariants(consumerDir, memberDirs);

  const compose1 = runBin(["compose"], consumerDir);
  assert.equal(compose1.code, 0, `installation ${name}: compose exits 0 (stderr: ${compose1.stderr})`);
  const renderHashAfterCompose1 = sha256File(path.join(consumerDir, "opencode.json"));
  const seedsAfterCompose1 = seedHashes(consumerDir);

  const compose2 = runBin(["compose"], consumerDir);
  assert.equal(compose2.code, 0, `installation ${name}: second compose exits 0 (stderr: ${compose2.stderr})`);
  const renderHashAfterCompose2 = sha256File(path.join(consumerDir, "opencode.json"));
  const seedsAfterCompose2 = seedHashes(consumerDir);

  // Invariant 6: seeds are not overwritten on recomposition — the seed
  // instances are byte-stable and the render is byte-identical.
  assert.deepEqual(seedsAfterCompose1, seedsAfterInit, `installation ${name}: the seed instances are byte-stable across the first compose`);
  assert.deepEqual(seedsAfterCompose2, seedsAfterInit, `installation ${name}: the seed instances are byte-stable across the second compose`);
  assert.equal(renderHashAfterCompose1, renderHashAfterInit, `installation ${name}: the render is byte-identical across the first compose`);
  assert.equal(renderHashAfterCompose2, renderHashAfterCompose1, `installation ${name}: the render is byte-identical across the second compose`);

  const verify = runBin(["verify"], consumerDir);
  assert.equal(verify.code, 0, `installation ${name}: verify exits 0 (stderr: ${verify.stderr})`);

  return { consumerDir, rendered: JSON.parse(fs.readFileSync(path.join(consumerDir, "opencode.json"), "utf8")) };
}

// ─── The seven installations ────────────────────────────────────────────────

test("installation 1: core only", () => {
  runInstallation("core-only", ["roundhouse-core"]);
});

test("installation 2: core + documentation + spec workflow", () => {
  runInstallation("docs", ["roundhouse-core", "roundhouse-docs-general", "roundhouse-docs-spec"]);
  // The docs-* skills present; the dependency rules satisfied (docs-* requires core).
  const union = expectedSkillUnion(["roundhouse-core", "roundhouse-docs-general", "roundhouse-docs-spec"]);
  assert.deepEqual(union, ["docs-general", "docs-general-accuracy", "docs-general-traceability", "docs-spec"].concat(
    expectedSkillUnion(["roundhouse-core"])
  ).sort(), "the docs-* skills join the core union");
});

test("installation 3: core + JavaScript", () => {
  const { rendered } = runInstallation("javascript", ["roundhouse-core", "roundhouse-lang-javascript"]);
  const map = rendered.agent.orchestrator.permission.skill;
  assert(map["lang-javascript"] === "allow", "lang-javascript is present and allowed");
  assert(map["framework-react"] === undefined && map["cms-apostrophe"] === undefined, "no framework or CMS skills appear");
});

test("installation 4: core + JavaScript + React", () => {
  const { rendered } = runInstallation("react", ["roundhouse-core", "roundhouse-lang-javascript", "roundhouse-framework-react"]);
  const map = rendered.agent.orchestrator.permission.skill;
  assert(map["framework-react"] === "allow", "framework-react is present and allowed");
  assert(map["lang-javascript"] === "allow", "its lang-javascript dependency is present");
});

test("installation 5: core + JavaScript + domain-web successors + React", () => {
  const members = [
    "roundhouse-core",
    "roundhouse-lang-javascript",
    "roundhouse-framework-react",
    "roundhouse-format-html",
    "roundhouse-lang-css",
    "roundhouse-software-accessibility",
    "roundhouse-software-performance",
    "roundhouse-software-discoverability",
  ];
  const { rendered } = runInstallation("domain-web", members);
  const map = rendered.agent.orchestrator.permission.skill;
  for (const skill of ["format-html-semantic", "lang-css", "lang-css-sass", "software-accessibility", "software-accessibility-web", "software-performance", "software-performance-web", "software-discoverability-seo"]) {
    assert(map[skill] === "allow", `the domain-web successor skill ${skill} is present and allowed`);
  }
  assert(map["framework-react"] === "allow", "React's dependency chain is enforced (React present with its requires)");
});

test("installation 6: core + JavaScript + Astro + Apostrophe", () => {
  const { rendered } = runInstallation("astro-apostrophe", [
    "roundhouse-core",
    "roundhouse-lang-javascript",
    "roundhouse-framework-astro",
    "roundhouse-cms-apostrophe",
  ]);
  const map = rendered.agent.orchestrator.permission.skill;
  assert(map["framework-astro"] === "allow" && map["cms-apostrophe"] === "allow", "framework-astro and cms-apostrophe are present and allowed");
  assert(map["lang-javascript"] === "allow", "their shared language dependency is present");
});

test("installation 7: the full current capability set (all 33 members)", () => {
  const members = allMemberDirs();
  assert.equal(members.length, 33, "the full set is the 33 workspace members");
  const { consumerDir, rendered } = runInstallation("full-set", members);
  const union = expectedSkillUnion(members);
  assert.equal(union.length, 52, "the full-set union is the 52 destination skill IDs");

  // The free cross-check: the temp render is byte-identical to the root's
  // committed composed opencode.json (the root is composed from the whole
  // workspace — the same discovered set).
  assert.equal(
    sha256File(path.join(consumerDir, "opencode.json")),
    sha256File(rootComposedRender),
    "the full-matrix temp render is byte-identical to the root's committed composed opencode.json"
  );

  // WP-02's comparison input: capture the full-set render to the gitignored
  // scratch path.
  fs.mkdirSync(path.dirname(capturePath), { recursive: true });
  fs.copyFileSync(path.join(consumerDir, "opencode.json"), capturePath);
  assert(fs.existsSync(capturePath), "the full-set render is captured for the pre-migration comparison");
});

// ─── The negative dependency installations ──────────────────────────────────

test("negative: framework-react alone fails init with the dependency-rule rejection", () => {
  const consumerDir = buildConsumer("neg-react", ["roundhouse-framework-react"]);
  const run = runBin(["init"], consumerDir);
  assert.equal(run.code, 1, "init exits 1");
  assert(
    run.stderr.includes("resolves to no discovered package"),
    `the dependency-rule rejection is named on stderr (stderr: ${run.stderr})`
  );
  assert(!fs.existsSync(path.join(consumerDir, ".roundhouse")), "nothing is written");
});

test("negative: cms-apostrophe alone fails init with the dependency-rule rejection", () => {
  const consumerDir = buildConsumer("neg-apostrophe", ["roundhouse-cms-apostrophe"]);
  const run = runBin(["init"], consumerDir);
  assert.equal(run.code, 1, "init exits 1");
  assert(
    run.stderr.includes("resolves to no discovered package"),
    `the dependency-rule rejection is named on stderr (stderr: ${run.stderr})`
  );
  assert(!fs.existsSync(path.join(consumerDir, ".roundhouse")), "nothing is written");
});

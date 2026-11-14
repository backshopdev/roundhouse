#!/usr/bin/env node
"use strict";

/**
 * check-deps.js — the workspace dependency validity (PLAN-20261019-06
 * WP-02, T-06).
 *
 * The composer's committed graph validation over the real workspace: every
 * `requires` entry resolves within the discovered set, the DEC-20261017-02
 * dependency rules hold (every capability requires core; framework/CMS
 * packages require their language), no requires cycles, and no ownership
 * conflicts (the duplicate skill/managed-path/seed checks) — the nine
 * set-level checks, gated by the Core template's six invariants. No rule
 * logic is reimplemented here.
 *
 * Exit 0 clean; exit 1 with the violations on stderr. Runtime: Node 24,
 * built-in modules only.
 */

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const lib = path.join(repoRoot, "packages", "roundhouse-cli", "lib");
const discovery = require(path.join(lib, "discovery.js"));
const model = require(path.join(lib, "model.js"));
const templateLib = require(path.join(lib, "template.js"));
const graph = require(path.join(lib, "graph.js"));

const EXPECTED_MEMBERS = 33;
const messages = [];
let failed = false;

const discoveryResult = discovery.discoverPackages(repoRoot);
messages.push(...discoveryResult.warnings);
if (discoveryResult.failures.length > 0) {
  failed = true;
  messages.push(...discoveryResult.failures);
} else if (discoveryResult.discovered.length !== EXPECTED_MEMBERS) {
  failed = true;
  messages.push(`Error: expected ${EXPECTED_MEMBERS} workspace members, discovered ${discoveryResult.discovered.length}`);
} else {
  const modelResult = model.run({ candidates: discoveryResult.discovered });
  if (modelResult.failures.length > 0) {
    failed = true;
    messages.push(...modelResult.failures);
  } else {
    const models = modelResult.models;
    const cores = models.filter((candidate) => candidate.kind === "core");
    if (cores.length !== 1) {
      failed = true;
      messages.push(`Error: expected exactly one core-kind package, found ${cores.length}`);
    } else {
      const templatePath = path.join(cores[0].root, "opencode-template.json");
      const templateViolations = templateLib.validateTemplateSource(fs.readFileSync(templatePath, "utf8"));
      if (templateViolations.length > 0) {
        failed = true;
        messages.push(...templateViolations.map((violation) => `Error: ${cores[0].name}: ${violation}`));
      } else {
        const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));
        const graphViolations = graph.validateGraph(models, template);
        if (graphViolations.length > 0) {
          failed = true;
          messages.push(...graphViolations.map((violation) => `Error: ${violation}`));
        }
      }
    }
  }
}

for (const message of messages) {
  console.error(message);
}
if (!failed) {
  console.log(`check-deps: PASS — the workspace dependency graph is valid across ${EXPECTED_MEMBERS} members.`);
}
process.exit(failed ? 1 : 0);

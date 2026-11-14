#!/usr/bin/env node
"use strict";

/**
 * check-contracts.js — the package-contract validation (PLAN-20261019-06
 * WP-02, T-05).
 *
 * The composer's committed validation over the real workspace members:
 * discovery (whose fail-closed triage runs the vocabulary validation — the
 * member set, the kind enum, `contractVersion`, the three arrays — per
 * package) plus model assembly (the bidirectional declared-versus-actual
 * skill-content check against each package's `managed/skills/` tree). No
 * rule logic is reimplemented here.
 *
 * Exit 0 clean; exit 1 with the violations on stderr. Runtime: Node 24,
 * built-in modules only.
 */

const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const lib = path.join(repoRoot, "packages", "roundhouse-cli", "lib");
const discovery = require(path.join(lib, "discovery.js"));
const model = require(path.join(lib, "model.js"));

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
  }
}

for (const message of messages) {
  console.error(message);
}
if (!failed) {
  console.log(`check-contracts: PASS — ${EXPECTED_MEMBERS} members conform to the vocabulary and the bidirectional skill-content check.`);
}
process.exit(failed ? 1 : 0);

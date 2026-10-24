#!/usr/bin/env node
"use strict";

/**
 * check-all.js — the aggregate check (PLAN-20261019-06 WP-02, T-09).
 *
 * Runs the five checks in sequence, collects each outcome, and reports every
 * check's result (never fail-fast — CI wants the full picture); exits 0 only
 * when all five pass. Each check is the npm script's engine invoked directly
 * (the npm scripts are thin wrappers over these same commands — the scripts
 * remain the single source of the check behavior, locally and in CI).
 *
 * Runtime: Node 24, built-in modules only.
 */

const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");

const CHECKS = [
  ["check-contracts", ["scripts/check-contracts.js"]],
  ["check-deps", ["scripts/check-deps.js"]],
  ["check-matrix", ["packages/roundhouse-cli/test/composition-matrix.test.js"]],
  ["check-drift", ["scripts/sync-roundhouse.js", "--mode", "verify"]],
  ["check-pack", ["scripts/check-pack.js"]],
];

const outcomes = [];
for (const [name, args] of CHECKS) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
  });
  const code = result.status === null ? 1 : result.status;
  outcomes.push([name, code]);
}

console.log("\n" + "=".repeat(60));
let failed = false;
for (const [name, code] of outcomes) {
  const verdict = code === 0 ? "PASS" : `FAIL (exit ${code})`;
  if (code !== 0) failed = true;
  console.log(`${verdict}: ${name}`);
}
console.log("=".repeat(60));

if (failed) {
  console.error("\ncheck-all: FAIL — one or more checks failed.");
  process.exit(1);
}
console.log("\ncheck-all: PASS — all five checks green.");
process.exit(0);

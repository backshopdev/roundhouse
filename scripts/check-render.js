#!/usr/bin/env node
"use strict";

/**
 * check-render.js — the committed-artifact drift check (PLAN-20261021-01
 * WP-01, T-01; PR #4 review finding F1).
 *
 * Runs `git diff --exit-code -- opencode.json .roundhouse/manifest.json`
 * from the repo root: exit 0 when the committed composed artifacts match
 * what the packages render, exit 1 naming the drifted committed artifacts
 * on stderr.
 *
 * Execution-time-state framing (what state each check sees): verify
 * (`check-drift`) catches working-tree drift locally and also catches
 * committed-artifact staleness in a developer's normal pre-commit flow —
 * a meaningful local catch. The CI defect is that CI composes before
 * running check-all, so post-compose verify sees a freshly rendered,
 * self-consistent tree and is vacuous there: it can never catch drift
 * between the COMMITTED composed artifacts and what the packages would
 * render. This check closes that gap: after compose, a diff of the
 * committed files isolates exactly the compose-induced changes.
 *
 * Clean-tree precondition: the diff is valid in CI because the
 * post-checkout tree is clean, so any diff isolates exactly the
 * compose-induced changes. It is noisy on a dirty local tree — a
 * developer's uncommitted work on these files would fail the check
 * spuriously — so the check is CI-invoked only and is deliberately
 * excluded from `check-all` (whose four checks run locally and in CI
 * alike; check-pack's deferral from that aggregate is PLAN-20261023-01
 * T-15).
 *
 * Runtime: Node 24, built-in modules only.
 */

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

const result = spawnSync(
  "git",
  ["diff", "--exit-code", "--", "opencode.json", ".roundhouse/manifest.json"],
  { cwd: repoRoot, encoding: "utf8" }
);

if (result.status === 0) {
  console.log("check-render: PASS — the committed composed artifacts match the composed tree.");
  process.exit(0);
}

// Git-spawn failure (git absent, not a repository, or another spawn-level
// error) is not drift — report it explicitly rather than misattributing it
// to committed-artifact drift. Still fail closed (exit 1): the check could
// not establish the invariant.
if (result.error || result.status === null) {
  const reason = result.error ? result.error.message : "git exited without a status (killed or failed to start)";
  console.error(`check-render: FAIL — git could not be run: ${reason}`);
  if (result.stderr) {
    console.error(result.stderr);
  }
  process.exit(1);
}

const drifted = [];
if (result.stdout && result.stdout.includes("diff --git a/opencode.json")) {
  drifted.push("opencode.json");
}
if (result.stdout && result.stdout.includes("diff --git a/.roundhouse/manifest.json")) {
  drifted.push(".roundhouse/manifest.json");
}
const named = drifted.length > 0 ? drifted.join(", ") : "the committed composed artifacts";
console.error(`check-render: FAIL — committed-artifact drift detected (the committed ${named} differ from what the packages render).`);
console.error("check-render: recompose the root (npm run sync-roundhouse -- --mode sync) and commit the refreshed composed artifacts.");
if (result.stderr) {
  console.error(result.stderr);
}
if (result.stdout) {
  console.error(result.stdout);
}
process.exit(1);

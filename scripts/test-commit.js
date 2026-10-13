#!/usr/bin/env node
"use strict";

/**
 * test-commit.js
 *
 * Verifies DEC-20260906-01's exit criterion: scripts/commit.js produces
 * byte-clean output for representative inputs. No test framework — plain
 * child_process.spawnSync + Buffer assertions. process.exit(1) on failure,
 * with a clear PASS/FAIL summary.
 *
 * Cases (each in mode a and mode b):
 *   - ASCII baseline
 *   - Em-dash U+2014 in subject and body
 *   - Arrow U+2192 in body
 *   - Smart quotes (" " ' ') in body
 *   - Non-ASCII names (Zoë, Håkon, José)
 *   - Mixed case covering all of the above in one message
 *
 * Plus:
 *   - Mode (b) CRLF-valued message file round-trips byte-exactly (Buffer
 *     pass-through preserves CRLF).
 *   - Guard tests: combined modes, missing mode, --body + --body-file,
 *     --dry-run-output without --dry-run.
 *
 * Usage:
 *   node scripts/test-commit.js
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const commitScript = path.join(repoRoot, "scripts", "commit.js");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "commit-test-"));

function cleanupTemp() {
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
}
process.on("exit", cleanupTemp);
process.on("beforeExit", cleanupTemp);

let passCount = 0;
let failCount = 0;

function report(name, pass, detail) {
  if (pass) {
    passCount++;
    console.log(`PASS ${name}`);
  } else {
    failCount++;
    console.log(`FAIL ${name}${detail ? ` ${detail}` : ""}`);
  }
}

function run(args) {
  const result = spawnSync(process.execPath, [commitScript, ...args], {
    cwd: repoRoot,
    encoding: "buffer",
  });
  return result;
}

function describeResult(res) {
  if (res.error) return `spawn error: ${res.error.message}`;
  if (res.status !== 0) {
    const stderr = (res.stderr || Buffer.alloc(0)).toString("utf8").trim();
    return `exit ${res.status}${stderr ? ` stderr=${stderr}` : ""}`;
  }
  return "";
}

function diffDetail(actual, expected) {
  if (actual.equals(expected)) return "";
  const common = Math.min(actual.length, expected.length);
  let index = 0;
  while (index < common && actual[index] === expected[index]) index++;
  const byteAt = (buf, i) => (i < buf.length ? `0x${buf[i].toString(16).padStart(2, "0")}` : "(end)");
  return `byte-mismatch at offset ${index}: actual=${byteAt(actual, index)} expected=${byteAt(expected, index)}`;
}

// ─── Mode (a): composed ──────────────────────────────────────────────────────
function testModeA(c) {
  const out = path.join(tempRoot, `a-${c.name}.txt`);
  const res = run(["--subject", c.subject, "--body", c.body, "--dry-run", "--dry-run-output", out]);
  if (res.status !== 0) {
    report(`mode-a ${c.name}`, false, describeResult(res));
    return;
  }
  const expected = Buffer.from(`${c.subject}\n\n${c.body}\n`, "utf8");
  const actual = fs.readFileSync(out);
  report(`mode-a ${c.name}`, actual.equals(expected), diffDetail(actual, expected));
}

// ─── Mode (b): pass-through ──────────────────────────────────────────────────
function testModeB(c) {
  const src = path.join(tempRoot, `b-${c.name}-src.txt`);
  const out = path.join(tempRoot, `b-${c.name}.txt`);
  const message = `${c.subject}\n\n${c.body}\n`;
  fs.writeFileSync(src, Buffer.from(message, "utf8"));
  const res = run(["--message-file", src, "--dry-run", "--dry-run-output", out]);
  if (res.status !== 0) {
    report(`mode-b ${c.name}`, false, describeResult(res));
    return;
  }
  const original = fs.readFileSync(src);
  const actual = fs.readFileSync(out);
  report(`mode-b ${c.name}`, actual.equals(original), diffDetail(actual, original));
}

// ─── Mode (b) CRLF pass-through ──────────────────────────────────────────────
function testModeBCrlf() {
  const src = path.join(tempRoot, "b-crlf-src.txt");
  const out = path.join(tempRoot, "b-crlf-out.txt");
  const message = "docs(x): crlf round-trip\r\n\r\nBody line one.\r\nBody with em-dash — and arrow →.\r\n";
  fs.writeFileSync(src, Buffer.from(message, "utf8"));
  const res = run(["--message-file", src, "--dry-run", "--dry-run-output", out]);
  if (res.status !== 0) {
    report("mode-b crlf-roundtrip", false, describeResult(res));
    return;
  }
  const original = fs.readFileSync(src);
  const actual = fs.readFileSync(out);
  const crlfBytes = Buffer.from([0x0d, 0x0a]);
  const pass =
    actual.equals(original) &&
    actual.includes(crlfBytes) &&
    actual.includes(Buffer.from("—", "utf8")) &&
    actual.includes(Buffer.from("→", "utf8"));
  const detail = actual.equals(original)
    ? !actual.includes(crlfBytes)
      ? "CRLF sequence missing in output"
      : "non-ASCII bytes missing in output"
    : diffDetail(actual, original);
  report("mode-b crlf-roundtrip", pass, detail);
}

// ─── F1: post-commit trailing-newline tolerance ──────────────────────────────
// A true end-to-end commit test would require staging files and creating real
// commits (mutating repository history), which is impractical for this suite.
// Instead we unit-test the exported normalization helper directly: any number
// of trailing newlines must be accepted as a trailing-newline-only difference
// (WARN/PASS), while any other difference must not be.
function testF1TrailingNewlineTolerance() {
  let helpers;
  try {
    helpers = require("./commit.js");
  } catch (err) {
    report("f1 trailing-newline tolerance", false, `cannot require commit.js: ${err.message}`);
    return;
  }
  const { stripTrailingNewlines, onlyTrailingNewlineDifference } = helpers;
  if (typeof onlyTrailingNewlineDifference !== "function" || typeof stripTrailingNewlines !== "function") {
    report("f1 trailing-newline tolerance", false, "normalization helpers are not exported");
    return;
  }

  const noTrailing = Buffer.from("docs(x): subject\n\nBody — →.", "utf8");
  const oneTrailing = Buffer.concat([noTrailing, Buffer.from("\n")]);
  const twoTrailing = Buffer.concat([noTrailing, Buffer.from("\n\n")]);
  const mutated = Buffer.from("docs(x): subject\n\nBody — →?", "utf8");

  const checks = [
    // [name, actual, intended, expectedTrailingOnly]
    ["exact match", noTrailing, noTrailing, true],
    ["mode-b no trailing newline vs git-added newlines", twoTrailing, noTrailing, true],
    ["one extra trailing newline", oneTrailing, noTrailing, true],
    ["intended carries the extra trailing newline", noTrailing, oneTrailing, true],
    ["real content difference", oneTrailing, mutated, false],
  ];

  let ok = true;
  let detail = "";
  for (const [name, actual, intended, expected] of checks) {
    const got = onlyTrailingNewlineDifference(actual, intended);
    if (got !== expected) {
      ok = false;
      detail = `${name}: expected ${expected}, got ${got}`;
      break;
    }
  }
  if (ok && stripTrailingNewlines(twoTrailing).length !== noTrailing.length) {
    ok = false;
    detail = "stripTrailingNewlines did not trim all trailing newlines";
  }
  report("f1 trailing-newline tolerance", ok, detail);
}

// ─── Guard tests ─────────────────────────────────────────────────────────────
function guard(name, args) {
  const res = run(args);
  const detail = `expected non-zero exit, got: ${describeResult(res) || "0"}`;
  report(`guard ${name}`, res.status !== 0, detail);
}

// ─── Main ────────────────────────────────────────────────────────────────────
const CASES = [
  { name: "ascii-baseline", subject: "docs(x): baseline", body: "Plain ASCII body." },
  { name: "em-dash", subject: "docs(x): em-dash — in subject", body: "Body with em-dash — inside." },
  { name: "arrow", subject: "docs(x): arrow", body: "Flow → continues." },
  { name: "smart-quotes", subject: "docs(x): quotes", body: "“Smart” quotes ‘here’." },
  { name: "non-ascii-names", subject: "docs(x): names", body: "Zoë, Håkon, José." },
  {
    name: "mixed",
    subject: "docs(x): mixed — “all” → done",
    body: "Zoë said “hi” → Håkon — José ’em all.",
  },
];

for (const c of CASES) {
  testModeA(c);
  testModeB(c);
}
testModeBCrlf();
testF1TrailingNewlineTolerance();

guard("combined-modes", ["--subject", "s", "--body", "b", "--message-file", "x"]);
guard("missing-mode", []);
guard("body-plus-body-file", ["--subject", "s", "--body", "b", "--body-file", "x"]);
guard("dry-run-output-without-dry-run", [
  "--subject",
  "s",
  "--body",
  "b",
  "--dry-run-output",
  path.join(tempRoot, "guard-out.txt"),
]);

const total = passCount + failCount;
console.log(`\n${passCount}/${total} checks passed, ${failCount} failed`);
if (failCount > 0) process.exit(1);
console.log("All commit byte-clean tests passed.");
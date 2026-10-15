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
 * Regression coverage for the supported npm transport:
 *   The agent workflow's supported commit procedure is `npm run commit -- ...`
 *   invoked from a shell. The direct `node scripts/commit.js` invocation
 *   above bypasses that shell layer. To exercise the actual transport the
 *   harness uses, additional cases run `npm run commit -- ...` via
 *   child_process.spawnSync with shell:true. The two-mode difference:
 *     - npm-mode-a: every argument (subject, body, dry-run-output path)
 *       travels through the shell to npm and then to commit.js.
 *     - npm-mode-b: only the `--message-file` path travels through the
 *       shell; the message-file content itself is read from disk as a
 *       Buffer (unchanged by any shell layer).
 *   All cases use --dry-run, so the repository is never mutated. Each case
 *   reports PASS/FAIL honestly: a PASS means the shell layer did not corrupt
 *   the approved bytes, a FAIL is evidence of transport truncation/mangling.
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

// Exercise the actual transport the harness uses: `npm run commit -- ...`
// invoked through a shell. On Windows, shell:true routes the command through
// cmd.exe; on POSIX, through /bin/sh. The agent's bash tool is itself a shell,
// so this call mirrors that path. Using --dry-run ensures no commit is
// written. The npm CLI itself parses argv in addition to the shell layer.
//
// We construct the command line manually with shell-safe quoting rather than
// relying on Node's automatic array-args quoting. Node's spawnSync shell-mode
// quoting on Windows does not consistently wrap args with internal
// whitespace, so cmd.exe would otherwise split multi-word subjects like
// `docs(x): baseline` into separate tokens. The agent's bash tool, in
// contrast, hands a single already-quoted command string to the shell; this
// function reproduces that transport.
function shellQuote(s) {
  // Wrap in double quotes; escape internal double quotes, backslashes, and
  // shell metacharacters that are special even inside double quotes on the
  // relevant platforms (`$`, backtick). This is sufficient for the test
  // inputs (subjects/bodies/paths) which do not contain newlines or other
  // unprintable characters.
  return `"${s.replace(/(["\\$`])/g, "\\$1")}"`;
}

function runNpm(args) {
  // On Windows, Node's spawnSync with shell:true wraps the command line in
  // a single outer pair of double quotes (cmd.exe /d /s /c "<line>"), and
  // cmd.exe strips that outer pair before parsing. If our first token is
  // itself quoted, cmd.exe will see a token ending in a stray `"` after the
  // outer pair is removed (e.g. `npm" "run" ...`), so it cannot locate the
  // executable. Therefore: never quote the literal command tokens
  // ("npm", "run", "commit", "--") and only double-quote user-supplied args
  // that contain whitespace, quotes, or shell metacharacters.
  const head = ["npm", "run", "commit", "--"];
  const needsQuoting = /[\s()"'`$\\;|&<>*?#~!{}[\]]/;
  const tail = args.map((a) => (needsQuoting.test(a) ? shellQuote(a) : a));
  const cmdline = [...head, ...tail].join(" ");
  const result = spawnSync(cmdline, {
    cwd: repoRoot,
    encoding: "buffer",
    shell: true,
  });
  return result;
}

function describeResult(res) {
  if (res.error) return `spawn error: ${res.error.message}`;
  if (res.status !== 0) {
    const stderr = (res.stderr || Buffer.alloc(0)).toString("utf8").trim();
    const stdout = (res.stdout || Buffer.alloc(0)).toString("utf8").trim();
    const parts = [`exit ${res.status}`];
    if (stderr) parts.push(`stderr=${stderr}`);
    if (stdout) parts.push(`stdout=${stdout}`);
    return parts.join(" ");
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

// ─── npm transport: mode (a) — every argument goes through the shell ────────
// The shell layer (cmd.exe / sh) re-tokenizes the command line before npm
// receives the argv. Non-ASCII bytes can be lost or replaced if the shell's
// codepage/quoting misinterprets them. Independent expected bytes are computed
// from the original JS string via Buffer.from(..., "utf8"), then compared
// against the bytes that `commit.js` actually wrote.
function testNpmModeA(c) {
  const out = path.join(tempRoot, `npm-a-${c.name}.txt`);
  const res = runNpm(["--subject", c.subject, "--body", c.body, "--dry-run", "--dry-run-output", out]);
  if (res.status !== 0) {
    report(`npm-mode-a ${c.name}`, false, describeResult(res));
    return;
  }
  const expected = Buffer.from(`${c.subject}\n\n${c.body}\n`, "utf8");
  let actual;
  try {
    actual = fs.readFileSync(out);
  } catch (err) {
    report(`npm-mode-a ${c.name}`, false, `cannot read output: ${err.message}`);
    return;
  }
  report(`npm-mode-a ${c.name}`, actual.equals(expected), diffDetail(actual, expected));
}

// ─── npm transport: mode (b) — only the path argument travels through the shell ─
// The approved message is written as raw UTF-8 bytes to a file. The file
// PATH still travels through the shell as an inline argv argument, but the
// file CONTENT is read by the script via fs.readFileSync (Buffer), so the
// shell layer cannot corrupt the approved bytes.
function testNpmModeB(c) {
  const src = path.join(tempRoot, `npm-b-${c.name}-src.txt`);
  const out = path.join(tempRoot, `npm-b-${c.name}.txt`);
  const message = `${c.subject}\n\n${c.body}\n`;
  fs.writeFileSync(src, Buffer.from(message, "utf8"));
  const res = runNpm(["--message-file", src, "--dry-run", "--dry-run-output", out]);
  if (res.status !== 0) {
    report(`npm-mode-b ${c.name}`, false, describeResult(res));
    return;
  }
  let original;
  let actual;
  try {
    original = fs.readFileSync(src);
    actual = fs.readFileSync(out);
  } catch (err) {
    report(`npm-mode-b ${c.name}`, false, `cannot read files: ${err.message}`);
    return;
  }
  report(`npm-mode-b ${c.name}`, actual.equals(original), diffDetail(actual, original));
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
  {
    // Multi-line body carrying both non-ASCII and footer lines. Exercises
    // newline preservation across the shell transport for mode-a and across
    // the Buffer pass-through for mode-b.
    name: "long-body-with-footers",
    subject: "docs(x): long body — em-dash",
    body: "Body line one — em-dash → arrow.\n\nBody line two: “smart quotes” and names Zoë, Håkon, José.\n\nRefs: #123\nreview-skills: peer, harness\nagents: document-author\nmodels: document-author=opencode-go\\minimax-m3",
  },
];

for (const c of CASES) {
  testModeA(c);
  testModeB(c);
  testNpmModeA(c);
  testNpmModeB(c);
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
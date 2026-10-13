#!/usr/bin/env node
"use strict";

/**
 * commit.js
 *
 * Byte-clean commit-message writer (DEC-20260906-01).
 *
 * Writes a commit message byte-exactly (UTF-8, no BOM) to a temp file and
 * runs `git commit -F <tmpfile>` (or `git commit --amend -F <tmpfile>`),
 * eliminating PowerShell encoding corruption.
 *
 * Modes (mutually exclusive):
 *   (a) composed:     --subject <string> with --body <string>
 *                     OR --body-file <path>
 *   (b) pass-through: --message-file <path>
 *                     (read as a Buffer and written verbatim — zero
 *                     re-encode risk)
 *
 * Assembly rule (mode a): subject + '\n\n' + body + '\n'.
 * Byte-exact write (mode a): fs.writeFileSync(tmp, Buffer.from(message, 'utf8')).
 * Byte-exact write (mode b): fs.writeFileSync(tmp, messageBuffer).
 *
 * Other flags:
 *   --amend          pass through to git as `git commit --amend -F <tmp>`
 *   --dry-run                write the message file (to the temp dir, or to
 *                            --dry-run-output <path> if given), print the
 *                            path, and exit WITHOUT calling git. Used by
 *                            test-commit.js.
 *   --dry-run-output <path>  dry-run destination (requires --dry-run)
 *
 * This script does NOT stage files — staging is the caller's job. It only
 * writes the message file and calls git commit. The repository root is
 * resolved via `git rev-parse --show-toplevel` so the script works from any
 * CWD.
 *
 * Exit codes:
 *   2  usage error (missing required flags, both modes combined,
 *      --body with --body-file, unknown flag, missing flag value)
 *   6  post-commit byte verification mismatch (FATAL — no recovery)
 *   1  other errors (unreadable message/body file, git not spawnable)
 *   otherwise, the git exit status is propagated
 *
 * Node built-ins only (fs, os, path, child_process); no external deps.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const USAGE = [
  "Usage:",
  '  node scripts/commit.js --subject "<subject>" --body "<body>" [--amend] [--dry-run] [--dry-run-output <path>]',
  "  node scripts/commit.js --subject \"<subject>\" --body-file <path> [--amend] [--dry-run] [--dry-run-output <path>]",
  "  node scripts/commit.js --message-file <path> [--amend] [--dry-run] [--dry-run-output <path>]",
].join("\n");

function fail(message, code) {
  console.error(message);
  console.error(USAGE);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    subject: undefined,
    body: undefined,
    bodyFile: undefined,
    messageFile: undefined,
    amend: false,
    dryRun: false,
    dryRunOutput: undefined,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const requireValue = (f) => {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) fail(`Error: ${f} requires a value`, 2);
      i++;
      return value;
    };
    switch (flag) {
      case "--subject":
        args.subject = requireValue(flag);
        break;
      case "--body":
        args.body = requireValue(flag);
        break;
      case "--body-file":
        args.bodyFile = requireValue(flag);
        break;
      case "--message-file":
        args.messageFile = requireValue(flag);
        break;
      case "--amend":
        args.amend = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--dry-run-output":
        args.dryRunOutput = requireValue(flag);
        break;
      default:
        fail(`Error: unknown flag: ${flag}`, 2);
    }
  }
  return args;
}

function validate(args) {
  if (args.dryRunOutput !== undefined && !args.dryRun) fail("Error: --dry-run-output requires --dry-run", 2);
  const hasModeA = args.subject !== undefined || args.body !== undefined || args.bodyFile !== undefined;
  const hasModeB = args.messageFile !== undefined;
  if (hasModeA && hasModeB) fail("Error: --message-file cannot be combined with --subject/--body/--body-file", 2);
  if (args.body !== undefined && args.bodyFile !== undefined) fail("Error: --body and --body-file are mutually exclusive", 2);
  if (!hasModeA && !hasModeB) fail("Error: missing required flags — use --subject with --body/--body-file, or --message-file", 2);
  if (hasModeA && !hasModeB) {
    if (args.subject === undefined) fail("Error: --subject is required with --body/--body-file", 2);
    if (args.body === undefined && args.bodyFile === undefined) fail("Error: --subject requires --body or --body-file", 2);
  }
}

function resolveRepoRoot() {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
  if (result.error) {
    console.error(`Error: failed to spawn git: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error("Error: could not determine the repository root (git rev-parse --show-toplevel failed):");
    console.error((result.stderr || result.stdout || "").trim());
    process.exit(result.status || 1);
  }
  return result.stdout.trim();
}

// F1: git stores the message with a terminating newline and
// `git log --format=%B` re-emits it, so the committed buffer may carry ANY
// number of trailing newlines beyond the intended buffer (a mode-(b) message
// file that does not itself end in a newline yields a two-newline delta).
// Normalize by trimming trailing newlines from both sides before comparing.
function stripTrailingNewlines(buf) {
  let end = buf.length;
  while (end > 0 && buf[end - 1] === 0x0a) end--;
  return buf.subarray(0, end);
}

function onlyTrailingNewlineDifference(a, b) {
  return stripTrailingNewlines(a).equals(stripTrailingNewlines(b));
}

function describeByte(buf, index) {
  if (index < 0 || index >= buf.length) return "(end)";
  return `0x${buf[index].toString(16).padStart(2, "0")}`;
}

function firstDiff(actual, intended) {
  const common = Math.min(actual.length, intended.length);
  let index = 0;
  while (index < common && actual[index] === intended[index]) index++;
  return {
    index,
    actualByte: describeByte(actual, index),
    intendedByte: describeByte(intended, index),
  };
}

function verifyPostCommit(intended, repoRoot) {
  const log = spawnSync("git", ["log", "-1", "--format=%B"], { cwd: repoRoot, encoding: "buffer" });
  if (log.error) {
    console.error(`Error: failed to spawn git: ${log.error.message}`);
    process.exit(1);
  }
  if (log.status !== 0) {
    console.error("Error: could not read back the committed message (git log -1 --format=%B failed):");
    console.error((log.stderr || "").toString("utf8").trim());
    process.exit(log.status || 1);
  }
  const actual = log.stdout;
  if (actual.equals(intended)) {
    console.log("Verification: committed message bytes match the intended message exactly.");
    return;
  }
  if (onlyTrailingNewlineDifference(actual, intended)) {
    console.warn("Verification: committed message differs only by trailing newline(s) (git normalization) — PASS.");
    return;
  }
  const diff = firstDiff(stripTrailingNewlines(actual), stripTrailingNewlines(intended));
  console.error("FATAL: committed message bytes do not match the intended message (exit 6).");
  console.error(`  first difference at byte offset ${diff.index}:`);
  console.error(`    intended: ${diff.intendedByte}`);
  console.error(`    actual:   ${diff.actualByte}`);
  process.exit(6);
}

// F3: create the temp message in a unique directory with O_EXCL (flag "wx")
// and owner-only mode, so a guessable path cannot be symlink-hijacked or
// silently clobbered.
function createTempMessageFile(messageBuffer) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "commit-"));
  try {
    const file = path.join(dir, "message.txt");
    fs.writeFileSync(file, messageBuffer, { flag: "wx", mode: 0o600 });
    return { dir, file };
  } catch (err) {
    removeTempMessageFile({ dir });
    throw err;
  }
}

// F2/F3: the single cleanup helper for every temp artifact this script
// creates. Best-effort so it never masks the primary result.
function removeTempMessageFile(temp) {
  if (!temp || !temp.dir) return;
  try {
    fs.rmSync(temp.dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  validate(args);

  let messageBuffer;
  let intended;

  if (args.messageFile !== undefined) {
    // Mode (b): pass-through. Read as a Buffer; never re-encode through a string.
    try {
      messageBuffer = fs.readFileSync(args.messageFile);
    } catch (err) {
      console.error(`Error: cannot read message file: ${err.message}`);
      process.exit(1);
    }
    intended = messageBuffer;
  } else {
    // Mode (a): composed.
    let body;
    try {
      body = args.bodyFile !== undefined ? fs.readFileSync(args.bodyFile, "utf8") : args.body;
    } catch (err) {
      console.error(`Error: cannot read body file: ${err.message}`);
      process.exit(1);
    }
    const message = `${args.subject}\n\n${body}\n`;
    messageBuffer = Buffer.from(message, "utf8");
    intended = messageBuffer;
  }

  if (args.dryRun) {
    if (args.dryRunOutput !== undefined) {
      // Explicit output path: a user-directed artifact, left in place.
      fs.writeFileSync(args.dryRunOutput, messageBuffer);
      console.log(args.dryRunOutput);
      process.exit(0);
    }
    // Auto temp file: hardened (unique dir + O_EXCL). Intentionally left in
    // place because the path is printed for the caller.
    let dryTemp;
    try {
      dryTemp = createTempMessageFile(messageBuffer);
    } catch (err) {
      console.error(`Error: cannot write temp message file: ${err.message}`);
      process.exit(1);
    }
    console.log(dryTemp.file);
    process.exit(0);
  }

  // F2: resolve the repo root BEFORE creating any temp file, so a failure
  // here cannot leak one.
  const repoRoot = resolveRepoRoot();

  let temp;
  try {
    temp = createTempMessageFile(messageBuffer);
  } catch (err) {
    console.error(`Error: cannot write temp message file: ${err.message}`);
    process.exit(1);
  }

  const gitArgs = ["commit"];
  if (args.amend) gitArgs.push("--amend");
  gitArgs.push("-F", temp.file);

  let gitStatus = 1;
  let spawnErrorMessage = null;
  try {
    const result = spawnSync("git", gitArgs, { cwd: repoRoot, stdio: "inherit" });
    if (result.error) {
      spawnErrorMessage = result.error.message;
    } else {
      gitStatus = result.status === null ? 1 : result.status;
    }
  } finally {
    // F2: cleanup runs before every process.exit below, and as a safety net
    // for unexpected throws.
    removeTempMessageFile(temp);
  }

  if (spawnErrorMessage !== null) {
    console.error(`Error: failed to spawn git: ${spawnErrorMessage}`);
    process.exit(gitStatus);
  }
  if (gitStatus !== 0) process.exit(gitStatus);
  verifyPostCommit(intended, repoRoot);
}

if (require.main === module) {
  main();
}

module.exports = {
  stripTrailingNewlines,
  onlyTrailingNewlineDifference,
};
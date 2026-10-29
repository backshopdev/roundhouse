#!/usr/bin/env node
"use strict";

/**
 * sync-roundhouse.js — the composer adapter (PLAN-20261019-04 T-09).
 *
 * The legacy src/-tree deployment retired to git history; the composer
 * library (packages/roundhouse-cli/lib) is the engine. The observable CLI
 * surface is preserved:
 *
 *   --mode sync    The self-hosting composition: the composer's init when
 *                  the consumer carries no .roundhouse/manifest.json,
 *                  compose otherwise. The discovered set is this
 *                  repository's workspace members (the packages are the
 *                  single authoritative source); managed artifacts are
 *                  updated, stale managed files are removed by recorded
 *                  ownership, opencode.json is regenerated, newly
 *                  applicable seeds are created only when missing, and the
 *                  manifest is created or refreshed.
 *   --mode verify  The composer's verify against the consumer, read-only.
 *
 *   --src <path>       Accepted and ignored (inert compatibility surface:
 *                      the src/-based source parameter post-cutover; the
 *                      effective source is the workspace package set).
 *   --consumer <path>  Override the consumer root (default: the repo root).
 *                      Temp-consumer isolation for the test suites.
 *
 * Strict argument parsing: any unknown flag or positional argument is a
 * usage error (exit 2, usage text on stderr). Exit codes 0/1/2 are relayed
 * from the composer. Every composer message (creation, removal, finding,
 * warning) is listed on stderr; a one-line summary goes to stdout on
 * success. Runtime: Node 24, built-in modules only.
 */

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const commands = require(path.join(repoRoot, "packages", "roundhouse-cli", "lib", "commands.js"));
const discovery = require(path.join(repoRoot, "packages", "roundhouse-cli", "lib", "discovery.js"));

const USAGE = `Usage: node scripts/sync-roundhouse.js --mode <sync|verify> [--src <path>] [--consumer <path>]

Modes:
  sync    Run the self-hosting composition against the consumer root:
          the composer's init when no .roundhouse/manifest.json exists,
          compose otherwise. The discovered set is this repository's
          workspace members.
  verify  Read-only: run the composer's verify against the consumer root.

Options:
  --src <path>       Accepted and ignored (inert compatibility surface; the
                     effective source is the workspace package set).
  --consumer <path>  Override the consumer root (default: the repo root).

Examples:
  node scripts/sync-roundhouse.js --mode sync
  node scripts/sync-roundhouse.js --mode verify
`;

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = { mode: undefined, src: undefined, consumer: undefined };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--mode") {
      if (!args[i + 1] || args[i + 1].startsWith("--")) usageError("Error: --mode requires a value (sync or verify).");
      flags.mode = args[++i];
    } else if (args[i] === "--src") {
      // Inert compatibility surface: accepted, validated as a flag with a
      // value, then ignored — the src/-based source retired with the tree.
      if (!args[i + 1] || args[i + 1].startsWith("--")) usageError("Error: --src requires a path argument.");
      flags.src = args[++i];
    } else if (args[i] === "--consumer") {
      if (!args[i + 1] || args[i + 1].startsWith("--")) usageError("Error: --consumer requires a path argument.");
      flags.consumer = args[++i];
    } else if (args[i].startsWith("--")) {
      usageError(`Error: unknown flag: ${args[i]}`);
    } else {
      usageError(`Error: unexpected positional argument: ${args[i]}`);
    }
  }
  if (!flags.mode) usageError("Error: --mode is required (sync or verify).");
  if (flags.mode !== "sync" && flags.mode !== "verify") {
    usageError(`Error: invalid --mode value: ${flags.mode} (must be sync or verify).`);
  }
  return flags;
}

function usageError(message) {
  console.error(message);
  console.error("");
  console.error(USAGE);
  process.exit(2);
}

/**
 * The discovered set is this repository's workspace members — the packages
 * are the single authoritative source post-cutover, regardless of which
 * consumer root the composition writes into (the --consumer override keeps
 * its temp-consumer isolation meaning).
 */
function discoverWorkspace() {
  return discovery.discoverPackages(repoRoot);
}

function main() {
  const flags = parseArgs();
  const consumerRoot = flags.consumer ? path.resolve(flags.consumer) : repoRoot;
  let result;
  let summary;
  if (flags.mode === "verify") {
    result = commands.runVerify({ consumerRoot, discoverPackages: discoverWorkspace });
    summary = `Sync (--mode verify): no findings.`;
  } else {
    const manifestExists = fs.existsSync(path.join(consumerRoot, ".roundhouse", "manifest.json"));
    const run = manifestExists ? commands.runCompose : commands.runInit;
    result = run({ consumerRoot, discoverPackages: discoverWorkspace });
    summary = manifestExists
      ? `Sync (--mode sync): composed ${consumerRoot}.`
      : `Sync (--mode sync): initialized ${consumerRoot}.`;
  }
  for (const message of result.messages) {
    console.error(message);
  }
  if (result.code === 0) {
    console.log(summary);
  }
  process.exit(result.code);
}

main();

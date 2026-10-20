#!/usr/bin/env node
"use strict";

/**
 * bin/roundhouse.js
 *
 * The `roundhouse` bin entry (the plan's WP-03, T-14): strict argv parsing,
 * dispatch to the three command implementations, message routing to stderr,
 * and exit-code mapping.
 *
 * Invocation: `roundhouse <command>` with exactly one of init, compose,
 * verify. Any unknown command or unexpected argument — including no
 * arguments and option-like arguments — is a usage error: exit 2, usage
 * text on stderr, nothing written (SCEN-064), mirroring the fixture
 * generator's and sync script's strict argument parsing.
 *
 * The command implementations (lib/commands.js) return
 * { code, messages } without exiting: every rejection, removal, creation,
 * and warning is routed to stderr; a success summary goes to stdout (the
 * generator precedent). Exit codes mirror the fixture generator: 0 success,
 * 1 failure, 2 usage error. The consumer root is the process's working
 * directory; the CLI accepts no options, wraps no package manager, and
 * performs no network access.
 *
 * Runtime: Node 24, built-in modules only.
 */

const commands = require("../lib/commands.js");

const COMMAND_NAMES = Object.freeze(["init", "compose", "verify"]);

const USAGE = `Usage: roundhouse <command>

Commands:
  init     Discover Roundhouse packages, validate them, and compose a fresh
           consumer (creates .roundhouse/manifest.json, the managed artifacts,
           the rendered opencode.json, and missing seed artifacts).
  compose  Recompute the composition, update managed artifacts, remove stale
           managed files by recorded ownership, regenerate opencode.json,
           create newly applicable seeds, and refresh the manifest.
  verify   Read-only verification of the consumer tree against the recomputed
           composition; reports every finding on stderr.

The consumer root is the current working directory. The CLI accepts no
options; any unknown command or unexpected argument is a usage error
(exit 2). Exit codes: 0 success, 1 failure, 2 usage error.
`;

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !COMMAND_NAMES.includes(args[0])) {
    if (args.length === 0) {
      console.error("Error: missing command.");
    } else {
      console.error(`Error: unexpected argument(s): ${args.join(" ")}`);
    }
    console.error("");
    console.error(USAGE);
    process.exit(2);
  }
  const commandName = args[0];
  const consumerRoot = process.cwd();
  const run = { init: commands.runInit, compose: commands.runCompose, verify: commands.runVerify }[commandName];
  const result = run({ consumerRoot });
  for (const message of result.messages) {
    console.error(message);
  }
  if (result.code === 0) {
    const summary = commandName === "init"
      ? `Initialized ${consumerRoot}.`
      : commandName === "compose"
        ? `Composed ${consumerRoot}.`
        : `Verified ${consumerRoot}: no findings.`;
    console.log(summary);
  }
  process.exit(result.code);
}

if (require.main === module) {
  main();
}

module.exports = { COMMAND_NAMES, USAGE, main };

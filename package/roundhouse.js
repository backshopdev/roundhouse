#!/usr/bin/env node
"use strict";

// The roundhouse bin adapter (PLAN-20261019-04 T-10): the init/update
// surface with --dry-run preserved, dispatched to the composer-backed
// deploy adapter. The effective content source is the local workspace
// package set; the src/-based template parameter retired with the tree.

const { init, update } = require("./deploy-roundhouse");
const packageJson = require("../package.json");

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("-")) || "init";
const dryRun = args.includes("--dry-run");
const cwd = process.cwd();

console.log(`Roundhouse v${packageJson.version}`);
console.log(`Target: ${cwd}`);
console.log(`Command: ${command}`);
console.log(`Source: the workspace package set`);
if (dryRun) console.log("Dry run: no files will be changed.");

try {
  if (!new Set(["init", "update"]).has(command)) throw new Error(`Unknown command '${command}'. Use init or update.`);
  const operation = command === "init" ? init : update;
  operation({ destinationDir: cwd, dryRun });
  console.log(dryRun ? "Dry run complete." : `${command} complete.`);
} catch (error) {
  console.error(`Deployment failed: ${error.message}`);
  process.exitCode = 1;
}

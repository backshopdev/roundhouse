#!/usr/bin/env node
"use strict";

/**
 * sync-roundhouse.js
 *
 * Mirrors the package's consumer-side `update()` behavior for the source
 * repo's development environment:
 *
 *   Mode 1 (replace): src/.opencode/ → root .opencode/ and
 *                      src/opencode.json → root/opencode.json. Always
 *                      overwrites; stale files in .opencode/ are removed.
 *   Mode 2 (create-if-missing): for every other file in src/, copy to root
 *                      if the destination doesn't exist. Files already at
 *                      root are left untouched — once present, they're
 *                      consumer-owned.
 *
 * `--verify-only` and `--verify` exit non-zero when either mode has drift.
 *
 * Path overrides (used by tests to operate in an isolated temp directory):
 *   --src <path>      Override source root (default: <consumerRoot>/src)
 *   --consumer <path> Override destination root (default: this script's
 *                     parent directory's parent, i.e. the repo root)
 */

const fs = require("fs");
const path = require("path");
const { ROOT_ONLY, collectRelativePaths, copyMissing, deploy } = require("../package/deploy-roundhouse");

const defaultConsumerRoot = path.resolve(__dirname, "..");

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {
    verify: args.includes("--verify"),
    verifyOnly: args.includes("--verify-only"),
    src: undefined,
    consumer: undefined,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--src") {
      if (!args[i + 1] || args[i + 1].startsWith("--")) fail("Error: --src requires a path argument");
      flags.src = args[++i];
    } else if (args[i] === "--consumer") {
      if (!args[i + 1] || args[i + 1].startsWith("--")) fail("Error: --consumer requires a path argument");
      flags.consumer = args[++i];
    }
  }
  return flags;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function verifyOpenCodeJson(srcOpenCodeJson, destOpenCodeJson) {
  if (!fs.existsSync(srcOpenCodeJson)) fail(`Error: source file not found: ${srcOpenCodeJson}`);
  if (!fs.existsSync(destOpenCodeJson)) fail("Integrity verification FAILED:\n  Missing: root opencode.json does not exist");
  if (fs.readFileSync(srcOpenCodeJson, "utf8") !== fs.readFileSync(destOpenCodeJson, "utf8")) {
    fail("Integrity verification FAILED:\n  root opencode.json does not match src/opencode.json");
  }
  console.log("Integrity verification passed: root opencode.json matches src/opencode.json.");
}

function verifyIntegrity(srcRoot, consumerRoot, srcDir, destDir) {
  const source = collectRelativePaths(srcDir, srcDir);
  const destination = collectRelativePaths(destDir, destDir);
  const preserved = new Set(ROOT_ONLY);
  const synced = new Set([...destination].filter((relative) => !preserved.has(relative.split("/")[0])));
  const missing = [...source].filter((relative) => !synced.has(relative));
  const extra = [...synced].filter((relative) => !source.has(relative));
  if (missing.length || extra.length) {
    let message = "Integrity verification FAILED:";
    if (missing.length) message += `\n  Missing in root .opencode/ (${missing.length}):\n${missing.map((item) => `    - ${item}`).join("\n")}`;
    if (extra.length) message += `\n  Extra in root .opencode/ (${extra.length}):\n${extra.map((item) => `    - ${item}`).join("\n")}`;
    fail(message);
  }
  console.log(`Integrity verification passed: ${source.size} src entr${source.size === 1 ? "y" : "ies"} match root .opencode/.`);

  // Mode 2 drift: any non-.opencode file under src/ that's missing at the consumer root.
  const seedExcluded = new Set([".opencode", "opencode.json"]);
  const seedEntries = [...collectRelativePaths(srcRoot, srcRoot)].filter(
    (relative) => !seedExcluded.has(relative.split("/")[0])
  );
  const missingSeed = seedEntries.filter(
    (relative) => !fs.existsSync(path.join(consumerRoot, relative.split("/").join(path.sep)))
  );
  if (missingSeed.length) {
    fail(`Integrity verification FAILED:\n  Mode 2 drift — files in src/ missing from root (${missingSeed.length}):\n${missingSeed.map((item) => `    - ${item}`).join("\n")}`);
  }
  console.log("Mode 2 integrity verification passed: no seed files missing from root.");
}

function main() {
  const flags = parseArgs();
  if (flags.verifyOnly && flags.verify) console.log("Note: --verify is redundant with --verify-only; ignoring --verify.");

  const consumerRoot = flags.consumer ? path.resolve(flags.consumer) : defaultConsumerRoot;
  const srcRoot = flags.src ? path.resolve(flags.src) : path.join(consumerRoot, "src");

  if (flags.src && !fs.existsSync(srcRoot)) {
    fail(`Error: --src path not found: ${srcRoot}`);
  }

  const srcDir = path.join(srcRoot, ".opencode");
  const destDir = path.join(consumerRoot, ".opencode");
  const srcOpenCodeJson = path.join(srcRoot, "opencode.json");
  const destOpenCodeJson = path.join(consumerRoot, "opencode.json");

  if (!fs.existsSync(srcDir)) fail(`Error: source directory not found: ${srcDir}`);
  if (flags.verifyOnly) {
    verifyIntegrity(srcRoot, consumerRoot, srcDir, destDir);
    verifyOpenCodeJson(srcOpenCodeJson, destOpenCodeJson);
    return;
  }
  deploy({ sourceDir: srcDir, destinationDir: destDir, sourceJson: srcOpenCodeJson, destinationJson: destOpenCodeJson });
  console.log("Root .opencode/ and opencode.json are now up to date with src/.");
  for (const entry of fs.readdirSync(srcRoot)) {
    if (entry === ".opencode" || entry === "opencode.json") continue;
    copyMissing(path.join(srcRoot, entry), path.join(consumerRoot, entry), false, console.log, consumerRoot);
  }
  console.log("Seed files are never overwritten; managed .opencode/ and opencode.json are overwritten.");
  if (flags.verify) {
    verifyIntegrity(srcRoot, consumerRoot, srcDir, destDir);
    verifyOpenCodeJson(srcOpenCodeJson, destOpenCodeJson);
  }
}

main();

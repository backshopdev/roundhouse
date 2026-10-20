#!/usr/bin/env node
"use strict";

/**
 * check-pack.js — the pack/files-list check (PLAN-20261019-06 WP-02, T-08).
 *
 * Per workspace member: `npm pack --dry-run --json` (private packages pack;
 * only publish refuses), asserting that every packed file path is within the
 * package's declared `files` allowlist plus npm's mandatory inclusions
 * (`package.json`), and that the contract-required content is present —
 * `roundhouse.json` and `managed/` for the content packages; core
 * additionally `seed/` and `opencode-template.json`; the CLI `bin/`, `lib/`,
 * and `roundhouse.json` (and its tarball excludes the repo-only test area).
 * The composed root artifacts are the drift check's domain, not package
 * payload.
 *
 * Exit 0 clean; exit 1 listing each violation. Runtime: Node 24, built-in
 * modules only.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const packagesDir = path.join(repoRoot, "packages");

const EXPECTED_MEMBERS = 33;

/**
 * The declared `files` allowlist plus the required-content enumeration per
 * member class (the plan's T-04/T-08 shape).
 */
function memberContract(memberDir) {
  if (memberDir === "roundhouse-cli") {
    return { allowlist: ["bin", "lib", "roundhouse.json"], required: ["roundhouse.json", "bin/", "lib/"], forbidden: ["test/"] };
  }
  if (memberDir === "roundhouse-core") {
    return { allowlist: ["roundhouse.json", "managed", "seed", "opencode-template.json"], required: ["roundhouse.json", "managed/", "seed/", "opencode-template.json"], forbidden: [] };
  }
  return { allowlist: ["roundhouse.json", "managed"], required: ["roundhouse.json", "managed/"], forbidden: [] };
}

function isAllowed(packedPath, allowlist) {
  if (packedPath === "package.json") return true; // npm's mandatory inclusion
  return allowlist.some((entry) => packedPath === entry || packedPath.startsWith(`${entry}/`));
}

const memberDirs = fs.readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("roundhouse-"))
  .map((entry) => entry.name)
  .sort();
const violations = [];
let checked = 0;

if (memberDirs.length !== EXPECTED_MEMBERS) {
  violations.push(`expected ${EXPECTED_MEMBERS} workspace members, found ${memberDirs.length}`);
}

for (const memberDir of memberDirs) {
  const memberPath = path.join(packagesDir, memberDir);
  const contract = memberContract(memberDir);
  const declared = JSON.parse(fs.readFileSync(path.join(memberPath, "package.json"), "utf8")).files;
  if (JSON.stringify(declared) !== JSON.stringify(contract.allowlist)) {
    violations.push(`${memberDir}: declared files ${JSON.stringify(declared)} != the contract allowlist ${JSON.stringify(contract.allowlist)}`);
    continue;
  }
  let packed;
  try {
    const output = execSync("npm pack --dry-run --json", {
      cwd: memberPath,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
    packed = JSON.parse(output);
  } catch (error) {
    violations.push(`${memberDir}: npm pack failed: ${error.message}`);
    continue;
  }
  const entry = Array.isArray(packed) ? packed[0] : packed;
  const packedPaths = (entry.files ?? []).map((file) => file.path.replace(/^\.\//, ""));
  for (const packedPath of packedPaths) {
    if (!isAllowed(packedPath, contract.allowlist)) {
      violations.push(`${memberDir}: packed path "${packedPath}" is outside the declared files allowlist`);
    }
  }
  for (const requiredPrefix of contract.required) {
    const present = requiredPrefix.endsWith("/")
      ? packedPaths.some((packedPath) => packedPath.startsWith(requiredPrefix))
      : packedPaths.includes(requiredPrefix);
    if (!present) {
      violations.push(`${memberDir}: contract-required content "${requiredPrefix}" is missing from the tarball`);
    }
  }
  for (const forbiddenPrefix of contract.forbidden) {
    const leaked = packedPaths.filter((packedPath) => packedPath.startsWith(forbiddenPrefix));
    if (leaked.length > 0) {
      violations.push(`${memberDir}: the tarball leaks repo-only content: ${leaked.join(", ")}`);
    }
  }
  checked++;
}

for (const violation of violations) {
  console.error(`Error: ${violation}`);
}
if (violations.length === 0) {
  console.log(`check-pack: PASS — ${checked} members' tarballs match their declared files allowlists and the contract-required content.`);
}
process.exit(violations.length > 0 ? 1 : 0);

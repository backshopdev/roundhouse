"use strict";

/**
 * deploy-roundhouse.js — the composer adapter (PLAN-20261019-04 T-10).
 *
 * The legacy src/-tree deployment retired to git history; the composer
 * library (packages/roundhouse-cli/lib) is the engine. The exported API is
 * preserved as thin adapters:
 *
 *   ROOT_ONLY             The preserved root-only-artifact list (constant).
 *   collectRelativePaths  Re-exported from the composer's safe-fs module
 *                         (the ported primitive this module originally
 *                         contributed).
 *   copyMissing           The seed-create-if-missing primitive over the
 *                         composer's safe-fs primitives — identical
 *                         semantics to the legacy body (skip existing,
 *                         never overwrite, escape/symlink rejection).
 *   init                  The composer's init when the consumer carries no
 *                         .roundhouse/manifest.json, compose otherwise
 *                         (the sync-style dispatch); the discovered set is
 *                         this repository's workspace members.
 *   update                The composer's compose against the consumer.
 *   deploy                The composer's compose, with the legacy
 *                         consumer-root derivation (destinationJson's
 *                         directory) and the preserved destination
 *                         escape-rejection contract.
 *
 * The src/-based parameters (sourceDir, sourceJson) are inert
 * compatibility surface: accepted, ignored — the effective content source
 * is the local workspace package set. Errors throw (the legacy contract);
 * the bin catches and reports. `dryRun` is honored at the wrapper level:
 * the composer's pure pipeline (discovery, model, template, graph, render)
 * computes the plan and the would-be writes are logged, with nothing
 * created, overwritten, or removed.
 *
 * Runtime: Node 24, built-in modules only.
 */

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const cliLib = path.join(repoRoot, "packages", "roundhouse-cli", "lib");
const commands = require(path.join(cliLib, "commands.js"));
const discovery = require(path.join(cliLib, "discovery.js"));
const safeFs = require(path.join(cliLib, "safe-fs.js"));
const materialize = require(path.join(cliLib, "materialize.js"));
const render = require(path.join(cliLib, "render.js"));
const manifestLib = require(path.join(cliLib, "manifest.js"));
const templateLib = require(path.join(cliLib, "template.js"));
const graph = require(path.join(cliLib, "graph.js"));
const modelLib = require(path.join(cliLib, "model.js"));

const ROOT_ONLY = ["node_modules", "package.json", "package-lock.json", ".gitignore", "data"];
const collectRelativePaths = safeFs.collectRelativePaths;

/**
 * The discovered set is this repository's workspace members — the packages
 * are the single authoritative source post-cutover.
 */
function discoverWorkspace() {
  return discovery.discoverPackages(repoRoot);
}

/**
 * A file at the managed .opencode root is rejected before any mutation
 * (the preserved type-conflict contract message). A junction at the root
 * falls through to the composer's symlink rejection.
 */
function assertManagedRootType(consumerRoot) {
  const managedRoot = path.join(consumerRoot, ".opencode");
  const stat = safeFs.lstatIfPresent(managedRoot);
  if (stat && stat.isFile()) throw new Error(`managed destination root must be a directory: ${managedRoot}`);
}

function dispatchCompose(consumerRoot, command, log) {
  const result = command({ consumerRoot, discoverPackages: discoverWorkspace });
  for (const message of result.messages) log(message);
  if (result.code !== 0) throw new Error(result.messages.join("\n") || "composition failed");
  return result;
}

function init({ destinationDir, dryRun = false, log = console.log } = {}) {
  const consumerRoot = path.resolve(destinationDir);
  assertManagedRootType(consumerRoot);
  if (dryRun) return dryRunPlan(consumerRoot, "init", log);
  const manifestExists = safeFs.lstatIfPresent(path.join(consumerRoot, ".roundhouse", "manifest.json")) !== null;
  return manifestExists
    ? dispatchCompose(consumerRoot, commands.runCompose, log)
    : dispatchCompose(consumerRoot, commands.runInit, log);
}

function update({ destinationDir, dryRun = false, log = console.log } = {}) {
  const consumerRoot = path.resolve(destinationDir);
  assertManagedRootType(consumerRoot);
  if (dryRun) return dryRunPlan(consumerRoot, "update", log);
  return dispatchCompose(consumerRoot, commands.runCompose, log);
}

function deploy({ destinationDir, destinationJson, dryRun = false, log = console.log } = {}) {
  const consumerRoot = path.resolve(destinationJson ? path.dirname(destinationJson) : destinationDir);
  // The preserved escape contract: an interpreted destination outside the
  // consumer root is rejected before any mutation.
  if (destinationDir) safeFs.assertSafePath(consumerRoot, destinationDir, "destination");
  assertManagedRootType(consumerRoot);
  if (dryRun) return dryRunPlan(consumerRoot, "update", log);
  return dispatchCompose(consumerRoot, commands.runCompose, log);
}

/**
 * The seed-create-if-missing primitive over the composer's safe-fs
 * primitives — the legacy body's semantics preserved verbatim: an existing
 * destination is skipped and logged (never overwritten), a symlinked
 * source or destination is rejected, and every destination is asserted
 * inside the consumer root.
 */
function copyMissing(source, destination, dryRun, log, consumerRoot = path.dirname(destination)) {
  const stat = fs.lstatSync(source);
  safeFs.assertSafePath(consumerRoot, destination, "destination");
  const existing = safeFs.lstatIfPresent(destination);
  if (!safeFs.ensureType(destination, stat, "init", log, dryRun, consumerRoot)) return;
  if (stat.isDirectory()) {
    const currentSource = fs.lstatSync(source);
    if (!currentSource.isDirectory() || currentSource.isSymbolicLink()) throw new Error(`source changed to a symlink or junction: ${source}`);
    if (!existing) { log(`${dryRun ? "Would create" : "Created"}: ${destination}`); if (!dryRun) safeFs.mkdirSafe(consumerRoot, destination, "destination"); }
    for (const entry of fs.readdirSync(source)) copyMissing(path.join(source, entry), path.join(destination, entry), dryRun, log, consumerRoot);
  } else {
    if (existing) { log(`Skipped existing: ${destination}`); return; }
    log(`${dryRun ? "Would create" : "Created"}: ${destination}`);
    if (!dryRun) { safeFs.mkdirSafe(consumerRoot, path.dirname(destination), "destination"); safeFs.copyFileSafe(consumerRoot, source, destination, "destination"); }
  }
}

/**
 * The wrapper-level dry-run: the composer's pure pipeline computes the
 * composition and the plan is logged; nothing is written. The managed
 * plan, the recorded-ownership stale plan (update), the rendered
 * opencode.json, the manifest, and the seed plan are each reported.
 */
function dryRunPlan(consumerRoot, mode, log) {
  const discoveryResult = discoverWorkspace();
  if (discoveryResult.failures.length > 0) throw new Error(discoveryResult.failures.join("\n"));
  const modelResult = modelLib.run({ candidates: discoveryResult.discovered });
  if (modelResult.failures.length > 0) throw new Error(modelResult.failures.join("\n"));
  const models = modelResult.models;
  const cores = models.filter((candidate) => candidate.kind === "core");
  if (cores.length !== 1) throw new Error("dry run requires exactly one core-kind package");
  const templatePath = path.join(cores[0].root, "opencode-template.json");
  const raw = fs.readFileSync(templatePath, "utf8");
  const templateViolations = templateLib.validateTemplateSource(raw);
  if (templateViolations.length > 0) throw new Error(templateViolations.join("\n"));
  const template = JSON.parse(raw);
  const graphViolations = graph.validateGraph(models, template);
  if (graphViolations.length > 0) throw new Error(graphViolations.join("\n"));

  for (const candidate of models) {
    for (const file of candidate.managedFiles) {
      const destination = path.join(consumerRoot, ...file.consumerPath.split("/"));
      log(`${safeFs.lstatIfPresent(destination) ? "Would overwrite" : "Would create"}: ${file.consumerPath}`);
    }
  }
  const manifestPath = path.join(consumerRoot, ".roundhouse", "manifest.json");
  const manifestExists = safeFs.lstatIfPresent(manifestPath) !== null;
  if (mode === "update") {
    if (!manifestExists) throw new Error(`no .roundhouse/manifest.json found; run init to create it.`);
    const recorded = materialize.collectRecordedManagedPaths(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
    const owned = materialize.collectOwnedManagedPaths(models);
    for (const stalePath of materialize.computeStaleManaged(recorded, owned)) {
      log(`Would remove stale: ${stalePath}`);
    }
  }
  log(`Would write: opencode.json`);
  log(`${manifestExists ? "Would refresh" : "Would create"} manifest: .roundhouse/manifest.json`);
  for (const candidate of models) {
    for (const seed of candidate.seedFiles) {
      const destination = path.join(consumerRoot, ...seed.consumerPath.split("/"));
      log(`${safeFs.lstatIfPresent(destination) ? "Skipped existing" : "Would create"}: ${seed.consumerPath}`);
    }
  }
  return { code: 0, messages: [] };
}

module.exports = { ROOT_ONLY, collectRelativePaths, copyMissing, deploy, init, update };

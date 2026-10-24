"use strict";

/**
 * materialize.js
 *
 * Managed/seed composition (the plan's T-11): copy managed content into
 * the consumer's `.opencode/` per the model's consumerPath mappings, create
 * missing seed files at the consumer root, and remove stale managed files
 * strictly by recorded ownership.
 *
 * Semantics (SPEC-20261019-02, Command semantics; DEC-20261017-02,
 * Artifact classes):
 *   - Managed copy uses update semantics: existing managed files are
 *     overwritten; an existing entry of an incompatible type at a managed
 *     path is removed first (the ported ensureType, "update" mode), with
 *     the removal logged.
 *   - Stale removal is strictly by recorded ownership: only paths recorded
 *     in the prior manifest that the recomputed composition no longer owns
 *     are removed; never-recorded files are never removed; every removal
 *     is logged.
 *   - Seeds are created only when missing and never overwritten (sync
 *     Mode 2 semantics): an existing seed instance is consumer-editable
 *     and stands.
 *   - Every write passes through the safe-fs primitives (path confinement
 *     is this module's family, shared with safe-fs.js): destinations are
 *     asserted inside the consumer root, symlinked destinations and
 *     sources are rejected, and checks sit immediately adjacent to
 *     mutations. The documented check-then-use race for an untrusted
 *     process concurrently mutating the tree remains an unavoidable
 *     limitation, as in the legacy module.
 *
 * Pure helpers (stale computation, recorded/owned path collection) are
 * separated from the I/O operations. Every operation requires a `log`
 * collector — zero silent mutations.
 *
 * Runtime: Node 24, built-in modules only.
 */

const fs = require("node:fs");
const path = require("node:path");

const {
  lstatIfPresent,
  assertSafePath,
  revalidateMutationPath,
  mkdirSafe,
  copyFileSafe,
  ensureType,
} = require("./safe-fs");

// ─── Pure helpers ───────────────────────────────────────────────────────────

function comparePaths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The stale managed set: recorded in the prior manifest but no longer
 * owned by the recomputed composition. Sorted byte-wise; never-recorded
 * paths can never appear here.
 */
function computeStaleManaged(recordedPaths, ownedPaths) {
  const owned = new Set(ownedPaths);
  return [...recordedPaths].filter((recordedPath) => !owned.has(recordedPath)).sort(comparePaths);
}

/**
 * The managed paths recorded in a parsed manifest (consumer-root-relative
 * POSIX paths), sorted, deduplicated.
 */
function collectRecordedManagedPaths(existingManifest) {
  const paths = new Set();
  for (const pkg of existingManifest.packages ?? []) {
    for (const entry of pkg.managed ?? []) paths.add(entry.path);
  }
  return [...paths].sort(comparePaths);
}

/**
 * The managed paths the recomputed composition owns (consumer-root-relative
 * POSIX paths from the models), sorted, deduplicated. Includes skill-entry
 * convention paths: the manifest records every managed file, and a dropped
 * skill's SKILL.md must become removable stale state.
 */
function collectOwnedManagedPaths(models) {
  const paths = new Set();
  for (const model of models) {
    for (const file of model.managedFiles) paths.add(file.consumerPath);
  }
  return [...paths].sort(comparePaths);
}

// ─── Ancestor type-compatibility (the SCEN-072 repair/skip contracts) ───────

/**
 * Walk the destination's ancestor chain (within the consumer root) and
 * return the first existing entry that is neither a directory nor a
 * symlink, as its consumer-root-relative POSIX path — a consumer file at a
 * directory path the composition needs. Symlinks are NOT type conflicts:
 * they are left for the confinement primitives' rejection. Returns null
 * when every ancestor is a directory or absent.
 */
function findAncestorTypeConflict(consumerRoot, destination) {
  const root = path.resolve(consumerRoot);
  const absolute = path.resolve(destination);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`destination escapes consumer cwd: ${destination}`);
  }
  const segments = relative.split(path.sep).slice(0, -1); // ancestors only
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const stat = lstatIfPresent(current);
    if (stat && !stat.isDirectory() && !stat.isSymbolicLink()) {
      return path.relative(root, current).split(path.sep).join("/");
    }
  }
  return null;
}

/**
 * Repair the ancestor chain for a managed write (the managed-update repair
 * semantics): a consumer file at a managed directory path is removed —
 * revalidated immediately before removal — so the directory can be created
 * and repopulated from the package source. Every removal is logged; a
 * symlinked ancestor is never repaired (the confinement primitives reject
 * it).
 */
function repairAncestorDirectories(consumerRoot, destination, label, log) {
  const root = path.resolve(consumerRoot);
  const absolute = path.resolve(destination);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} escapes consumer cwd: ${destination}`);
  }
  const segments = relative.split(path.sep).slice(0, -1);
  let current = root;
  for (const segment of segments) {
    current = path.join(current, segment);
    const stat = lstatIfPresent(current);
    if (stat && !stat.isDirectory() && !stat.isSymbolicLink()) {
      revalidateMutationPath(root, current, label, false);
      fs.rmSync(current, { recursive: true, force: true });
      log(`Removed incompatible existing: ${path.relative(root, current).split(path.sep).join("/")}`);
    }
  }
}

// ─── I/O operations ─────────────────────────────────────────────────────────

function requireLog(log) {
  if (typeof log !== "function") throw new Error("materialize operations require a log collector (zero silent mutations)");
}

/**
 * Copy every model's managed tree into the consumer's `.opencode/` using
 * the models' consumerPath mappings. Update semantics: existing managed
 * files are overwritten; incompatible existing types are removed first
 * (logged). Sources are the packages' managed trees at their discovered
 * roots.
 */
function copyManaged({ consumerRoot, models, log }) {
  requireLog(log);
  const root = path.resolve(consumerRoot);
  const sorted = [...models].sort((a, b) => comparePaths(a.name, b.name));
  for (const model of sorted) {
    for (const file of [...model.managedFiles].sort((a, b) => comparePaths(a.path, b.path))) {
      const source = path.join(model.root, "managed", ...file.path.split("/"));
      const destination = path.join(root, ...file.consumerPath.split("/"));
      assertSafePath(root, destination, "managed destination");
      const sourceStat = fs.lstatSync(source); // throws when a source vanished since assembly: fail closed
      const existing = lstatIfPresent(destination);
      if (existing && !existing.isFile()) {
        ensureType(destination, sourceStat, "update", log, false, root);
        if (lstatIfPresent(destination) === null) log(`Removed incompatible existing: ${file.consumerPath}`);
      }
      repairAncestorDirectories(root, destination, "managed destination", log);
      mkdirSafe(root, path.dirname(destination), "managed destination");
      copyFileSafe(root, source, destination, "managed destination");
      log(`${existing && existing.isFile() ? "Updated" : "Created"} managed file: ${file.consumerPath} (${model.name})`);
    }
  }
}

/**
 * Remove the stale managed paths (consumer-root-relative POSIX paths from
 * computeStaleManaged). Never-recorded files are never passed here; each
 * actual removal is logged. A stale path already absent from the tree is
 * skipped (removing nothing is not a mutation).
 */
function removeStaleManaged({ consumerRoot, stalePaths, log }) {
  requireLog(log);
  const root = path.resolve(consumerRoot);
  for (const stalePath of stalePaths) {
    const absolute = path.join(root, ...stalePath.split("/"));
    assertSafePath(root, absolute, "stale managed path");
    if (!lstatIfPresent(absolute)) continue;
    revalidateMutationPath(root, absolute, "stale managed path", false);
    fs.rmSync(absolute, { recursive: true, force: true });
    log(`Removed stale managed file: ${stalePath}`);
  }
}

/**
 * Create each model's offered seed files at the consumer root, only when
 * missing; an existing seed instance is never overwritten (logged as
 * skipped). Sources are the packages' seed trees at their discovered roots.
 */
function createMissingSeeds({ consumerRoot, models, log }) {
  requireLog(log);
  const root = path.resolve(consumerRoot);
  const sorted = [...models].sort((a, b) => comparePaths(a.name, b.name));
  for (const model of sorted) {
    for (const seed of [...model.seedFiles].sort((a, b) => comparePaths(a.path, b.path))) {
      const source = path.join(model.root, "seed", ...seed.path.split("/"));
      const destination = path.join(root, ...seed.consumerPath.split("/"));
      assertSafePath(root, destination, "seed destination");
      const stat = revalidateMutationPath(root, destination, "seed destination");
      if (stat) {
        log(`Seed already present, skipped: ${seed.consumerPath}`);
        continue;
      }
      // The seed create-if-missing contract: a consumer file at a seed
      // parent-directory path means the seed cannot be created — skip with
      // a report, preserving the never-overwrite rule (the consumer file is
      // never removed). A symlinked ancestor is not a type conflict; it
      // falls through to the confinement primitives' rejection.
      const ancestorConflict = findAncestorTypeConflict(root, destination);
      if (ancestorConflict !== null) {
        log(`Skipped incompatible existing: ${ancestorConflict} (seed not created: ${seed.consumerPath})`);
        continue;
      }
      mkdirSafe(root, path.dirname(destination), "seed destination");
      copyFileSafe(root, source, destination, "seed destination");
      log(`Created seed: ${seed.consumerPath} (${model.name})`);
    }
  }
}

module.exports = {
  computeStaleManaged,
  collectRecordedManagedPaths,
  collectOwnedManagedPaths,
  copyManaged,
  removeStaleManaged,
  createMissingSeeds,
};

"use strict";

/**
 * safe-fs.js
 *
 * The composer's path-confinement primitives, ported from
 * `package/deploy-roundhouse.js` (DEC-20261017-03's porting note: the full
 * primitive set lives there and is ported into the composer in Phase 3).
 * The function bodies are semantics-preserving copies: per-segment
 * symlink/junction rejection, realpath-escape rejection, and checks
 * immediately adjacent to mutations.
 *
 * Path confinement is this module's family (the plan's ownership map):
 * every managed or seed path the composer materializes passes through
 * these primitives; absolute paths, backslashes, and escape traversals are
 * rejected, as are symlinked managed or seed sources
 * (SPEC-20261019-02, Constraints, Path confinement).
 *
 * The legacy module itself stays untouched until Phase 6/8 dispositions it.
 * The orchestrators the legacy module also exports (`deploy`, `init`,
 * `update`, `copyTree`, `copyMissing`) are replaced by the composer's
 * materializer and are deliberately not ported.
 *
 * Runtime: Node 24, built-in modules only.
 */

const fs = require("node:fs");
const path = require("node:path");

// ─── Presence and containment ───────────────────────────────────────────────

function lstatIfPresent(file) {
  try { return fs.lstatSync(file); } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

// ─── Path confinement assertions ────────────────────────────────────────────

function assertSafePath(root, candidate, label) {
  const absoluteRoot = path.resolve(root);
  const absoluteCandidate = path.resolve(candidate);
  if (!inside(absoluteRoot, absoluteCandidate)) throw new Error(`${label} escapes consumer cwd: ${candidate}`);
  let current = absoluteRoot;
  const relative = path.relative(absoluteRoot, absoluteCandidate);
  for (const part of relative ? relative.split(path.sep) : []) {
    current = path.join(current, part);
    const stat = lstatIfPresent(current);
    if (!stat) continue;
    if (stat.isSymbolicLink()) throw new Error(`${label} uses a symlink or junction: ${current}`);
    const real = fs.realpathSync(current);
    if (!inside(fs.realpathSync(absoluteRoot), real)) throw new Error(`${label} escapes consumer cwd: ${current}`);
  }
}

function assertSafeTree(root, label) {
  const stat = lstatIfPresent(root);
  if (!stat) return;
  if (stat.isSymbolicLink()) throw new Error(`${label} uses a symlink or junction: ${root}`);
  if (!stat.isDirectory()) return;
  for (const entry of fs.readdirSync(root)) assertSafeTree(path.join(root, entry), label);
}

// Node does not expose a portable directory-relative, no-follow equivalent for
// every operation used here (notably recursive removal and Windows junctions).
// Keep the checks immediately adjacent to mutations; this closes ordinary
// replacement mistakes, while the documented check-then-use race remains an
// unavoidable limitation for an untrusted process concurrently changing cwd.
function revalidateMutationPath(root, candidate, label, allowMissing = true) {
  assertSafePath(root, candidate, label);
  const stat = lstatIfPresent(candidate);
  if (!stat && !allowMissing) throw new Error(`${label} changed before mutation: ${candidate}`);
  if (stat?.isSymbolicLink()) throw new Error(`${label} uses a symlink or junction: ${candidate}`);
  return stat;
}

// ─── Confined mutations ─────────────────────────────────────────────────────

function mkdirSafe(root, directory, label) {
  const absolute = path.resolve(directory);
  const relative = path.relative(path.resolve(root), absolute);
  let current = path.resolve(root);
  for (const part of relative ? relative.split(path.sep) : []) {
    current = path.join(current, part);
    const stat = revalidateMutationPath(root, current, label);
    if (!stat) fs.mkdirSync(current);
  }
}

function copyFileSafe(root, source, destination, label) {
  const sourceStat = fs.lstatSync(source);
  if (sourceStat.isSymbolicLink() || !sourceStat.isFile()) throw new Error(`source uses a symlink or junction: ${source}`);
  revalidateMutationPath(root, path.dirname(destination), label, false);
  revalidateMutationPath(root, destination, label);
  fs.copyFileSync(source, destination);
}

// ─── Tree inventory ─────────────────────────────────────────────────────────

/**
 * Symlink-rejecting tree inventory with POSIX-normalized relative paths.
 * Returns a Set of relative POSIX paths; an absent `dir` yields an empty
 * set, a symlinked `dir` (or any entry within) fails closed.
 */
function collectRelativePaths(dir, base) {
  const result = new Set();
  const stat = lstatIfPresent(dir);
  if (!stat) return result;
  if (stat.isSymbolicLink()) throw new Error(`source uses a symlink or junction: ${dir}`);
  if (!stat.isDirectory()) throw new Error(`expected directory: ${dir}`);
  for (const entry of fs.readdirSync(dir)) {
    const entryPath = path.join(dir, entry);
    const entryStat = fs.lstatSync(entryPath);
    if (entryStat.isSymbolicLink()) throw new Error(`source uses a symlink or junction: ${entryPath}`);
    const relative = path.relative(base, entryPath).split(path.sep).join("/");
    result.add(relative);
    if (entryStat.isDirectory()) for (const child of collectRelativePaths(entryPath, base)) result.add(child);
  }
  return result;
}

// ─── Type-compatible replacement ────────────────────────────────────────────

/**
 * Ensure the destination's existing type is compatible with the source's.
 * `mode` "init" skips incompatible existing entries (logged); "update"
 * removes them (revalidated immediately before removal). `dryRun` reports
 * without mutating. Defaults `consumerRoot` to the destination's parent so
 * the primitive stays usable standalone.
 */
function ensureType(destination, sourceStat, mode, log, dryRun = false, consumerRoot = path.dirname(destination)) {
  const existing = lstatIfPresent(destination);
  if (!existing) return true;
  if (existing.isSymbolicLink()) throw new Error(`destination uses a symlink or junction: ${destination}`);
  const compatible = sourceStat.isDirectory() ? existing.isDirectory() : existing.isFile();
  if (compatible) return true;
  if (mode === "init") {
    log(`Skipped incompatible existing: ${destination}`);
    return false;
  }
  if (!dryRun) { revalidateMutationPath(consumerRoot, destination, "destination", false); fs.rmSync(destination, { recursive: existing.isDirectory(), force: true }); }
  return true;
}

module.exports = {
  lstatIfPresent,
  inside,
  assertSafePath,
  assertSafeTree,
  revalidateMutationPath,
  mkdirSafe,
  copyFileSafe,
  collectRelativePaths,
  ensureType,
};

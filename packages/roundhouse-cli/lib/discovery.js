"use strict";

/**
 * discovery.js
 *
 * The discovery contract (SPEC-20261019-02, Public contracts, Command
 * semantics; DEC-20261017-02, Package discovery): resolve the consumer
 * root's declared `dependencies` and `devDependencies` to package roots
 * (targeted `node_modules/<name>` resolution, walking npm's resolution
 * upward only for declared names), expand the root's `workspaces` globs to
 * member directories, and triage each candidate:
 *
 *   - no `roundhouse.json`        -> not a Roundhouse extension, skipped
 *                                    without error
 *   - valid `roundhouse.json`     -> discovered
 *   - invalid `roundhouse.json`   -> fail closed (SCEN-066)
 *
 * A candidate that carries a `roundhouse.json` declares itself a Roundhouse
 * extension and must therefore be a readable package (parseable
 * `package.json` with a usable `name`); anything less fails closed.
 * `node_modules` is never enumerated beyond resolving declared names, and
 * the workspace walk never descends into `node_modules` or `.git`
 * (SCEN-058, SCEN-059).
 *
 * Vocabulary validation (including the per-envelope dependency rules) is
 * delegated to `vocabulary.js` — the triage rule's "valid" means
 * vocabulary-valid; no rule logic is duplicated here.
 *
 * Determinism: candidates are processed in sorted order, duplicates are
 * resolved by realpath (a package may be both a declared dependency and a
 * workspace member), and the discovered set is sorted byte-wise by package
 * name.
 *
 * Interpretation calls (fail-closed posture):
 *   - A declared dependency that resolves nowhere is skipped with a
 *     warning (npm owns installation integrity; the composer lists the
 *     warning on stderr rather than silently ignoring the name).
 *   - A workspace glob match that is not a real directory (missing, file,
 *     or symlink) is skipped: npm's install is the authority on workspace
 *     membership.
 *   - Two discovered candidates claiming the same package name are a
 *     set-integrity failure: `requires` entries and the manifest resolve
 *     packages by name, so a duplicated name has no well-defined owner.
 *
 * Runtime: Node 24, built-in modules only.
 */

const fs = require("node:fs");
const path = require("node:path");

const { lstatIfPresent } = require("./safe-fs");
const { validateVocabulary, isValidPackageName } = require("./vocabulary");

// ─── Pure helpers ───────────────────────────────────────────────────────────

function comparePaths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Minimal workspace-glob matcher over literal segments, `*` (exactly one
 * segment), and `**` (zero or more segments) — the plan's T-05 matcher
 * contract. No intra-segment globs; patterns are relative POSIX-style
 * segment sequences.
 */
function matchSegments(pattern, segments) {
  if (pattern.length === 0) return segments.length === 0;
  const [head, ...rest] = pattern;
  if (head === "**") {
    for (let index = 0; index <= segments.length; index++) {
      if (matchSegments(rest, segments.slice(index))) return true;
    }
    return false;
  }
  if (segments.length === 0) return false;
  if (head === "*" || head === segments[0]) return matchSegments(rest, segments.slice(1));
  return false;
}

/**
 * Parse and validate one workspaces glob into segments. Throws on invalid
 * entries (fail closed): non-string, empty, absolute, backslashes, or
 * empty/dot segments.
 */
function parseWorkspacePattern(pattern) {
  if (typeof pattern !== "string" || pattern.length === 0) {
    throw new Error(`invalid workspaces entry (must be a non-empty string): ${JSON.stringify(pattern)}`);
  }
  if (pattern.startsWith("/") || pattern.includes("\\") || pattern.includes("\0")) {
    throw new Error(`invalid workspaces entry (must be a relative POSIX-style glob): ${pattern}`);
  }
  const segments = pattern.split("/");
  for (const segment of segments) {
    if (segment.length === 0 || segment === "." || segment === "..") {
      throw new Error(`invalid workspaces entry segment in: ${pattern}`);
    }
  }
  return segments;
}

/**
 * Declared dependency names from the consumer manifest: the sorted unique
 * names of `dependencies` and `devDependencies`. Malformed members fail
 * closed via `failures`.
 */
function collectDeclaredNames(manifest, failures) {
  const names = new Set();
  for (const member of ["dependencies", "devDependencies"]) {
    const value = manifest[member];
    if (value === undefined) continue;
    if (!isPlainObject(value)) {
      failures.push(`Error: consumer package.json "${member}" must be an object`);
      continue;
    }
    for (const [name, spec] of Object.entries(value)) {
      if (typeof spec !== "string") {
        failures.push(`Error: consumer package.json "${member}.${name}" must have a string version specifier`);
        continue;
      }
      names.add(name);
    }
  }
  return [...names].sort(comparePaths);
}

/**
 * Normalize the consumer manifest's `workspaces` member to an array of
 * glob strings, or null when absent. Malformed values fail closed via
 * `failures`.
 */
function normalizeWorkspaces(manifest, failures) {
  const value = manifest.workspaces;
  if (value === undefined) return null;
  const globs = typeof value === "string" ? [value] : value;
  if (!Array.isArray(globs) || globs.some((glob) => typeof glob !== "string")) {
    failures.push('Error: consumer package.json "workspaces" must be a glob string or an array of glob strings');
    return null;
  }
  return globs;
}

// ─── I/O: JSON reading ──────────────────────────────────────────────────────

/**
 * Read a JSON file if present. Returns { present: false } for an absent or
 * non-regular-file path, { present: true, value } for parseable content,
 * and { present: true, parseError } for unparseable content (the caller
 * converts that to a fail-closed error naming the file). I/O errors other
 * than absence propagate.
 */
function readJsonIfExists(absolutePath) {
  const stat = lstatIfPresent(absolutePath);
  if (!stat || !stat.isFile()) return { present: false };
  let raw;
  try {
    raw = fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    throw new Error(`cannot read ${absolutePath}: ${error.message}`);
  }
  try {
    return { present: true, value: JSON.parse(raw) };
  } catch (error) {
    return { present: true, parseError: error.message };
  }
}

// ─── I/O: declared-name resolution ──────────────────────────────────────────

/**
 * Resolve one declared package name the way npm does: walk upward from the
 * consumer root, probing `node_modules/<name>` at each level. Returns the
 * first existing candidate path (any entry type; triage decides what it
 * is), or null when the name resolves nowhere. Scoped names resolve
 * through their scope directory.
 */
function resolveDeclaredName(root, name) {
  let dir = path.resolve(root);
  for (;;) {
    const candidate = path.join(dir, "node_modules", ...name.split("/"));
    if (lstatIfPresent(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// ─── I/O: workspace member expansion ────────────────────────────────────────

/**
 * Depth-first directory walk collecting every real directory below `dir`
 * (excluding `node_modules` and `.git` at any depth, skipping symlinks),
 * as { segments, absolutePath } with deterministically sorted traversal.
 */
function listWorkspaceDirectories(dir, prefix, matches) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`cannot read directory ${dir}: ${error.message}`);
  }
  entries.sort((a, b) => comparePaths(a.name, b.name));
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    if (entry.isSymbolicLink() || !entry.isDirectory()) continue;
    const segments = prefix ? [...prefix, entry.name] : [entry.name];
    matches.push({ segments, absolutePath: path.join(dir, entry.name) });
    listWorkspaceDirectories(path.join(dir, entry.name), segments, matches);
  }
}

/**
 * Expand workspaces globs to member directory paths. Pure pattern logic
 * (`matchSegments`, `parseWorkspacePattern`) is separated from the
 * directory walk. Returns sorted, unique absolute directory paths.
 */
function expandWorkspaceGlobs(root, globs) {
  const patterns = globs.map(parseWorkspacePattern);
  const candidates = [];
  listWorkspaceDirectories(root, [], candidates);
  const matched = new Set();
  for (const candidate of candidates) {
    for (const pattern of patterns) {
      if (matchSegments(pattern, candidate.segments)) {
        matched.add(candidate.absolutePath);
        break;
      }
    }
  }
  return [...matched].sort(comparePaths);
}

// ─── Triage (per candidate) ─────────────────────────────────────────────────

/**
 * Triage one candidate package root. Returns a discriminated result:
 *   { status: "discovered", discovered: { name, root, envelope } }
 *   { status: "skipped", reason }
 *   { status: "failure", messages: [...] }
 * A candidate without `roundhouse.json` is skipped without error (and its
 * `package.json` is never demanded). A candidate with one declares itself
 * a Roundhouse extension: it must be a readable named package with a
 * vocabulary-valid envelope (including the per-envelope dependency rules,
 * which need the package name for the framework/CMS family rules).
 */
function triageCandidate(candidate, deps) {
  const envelopeResult = deps.readJsonIfExists(path.join(candidate.root, "roundhouse.json"));
  if (!envelopeResult.present) return { status: "skipped", reason: "no roundhouse.json" };
  const packageResult = deps.readJsonIfExists(path.join(candidate.root, "package.json"));
  if (!packageResult.present) {
    return { status: "failure", messages: [`Error: ${candidate.root}: declares roundhouse.json but has no package.json`] };
  }
  if (packageResult.parseError) {
    return { status: "failure", messages: [`Error: ${candidate.root}: package.json is not parseable JSON: ${packageResult.parseError}`] };
  }
  const name = packageResult.value && packageResult.value.name;
  if (typeof name !== "string" || name.length === 0) {
    return { status: "failure", messages: [`Error: ${candidate.root}: package.json has no usable "name" member`] };
  }
  if (envelopeResult.parseError) {
    return { status: "failure", messages: [`Error: ${name} (${candidate.root}): roundhouse.json is not parseable JSON: ${envelopeResult.parseError}`] };
  }
  const violations = deps.validateVocabulary(envelopeResult.value, { packageName: name });
  if (violations.length > 0) {
    return { status: "failure", messages: violations.map((violation) => `Error: ${name} (${candidate.root}): roundhouse.json ${violation}`) };
  }
  return { status: "discovered", discovered: { name, root: candidate.root, envelope: envelopeResult.value } };
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Run the discovery pipeline for one consumer root. Returns
 * { discovered, skipped, warnings, failures }:
 *   - discovered: [{ name, root, envelope }] sorted byte-wise by name
 *   - skipped:    [{ root, reason }] (no roundhouse.json)
 *   - warnings:   [string] (declared-but-uninstalled dependency names)
 *   - failures:   [string] (fail-closed; non-empty means the discovered
 *                 set is unusable and the caller must abort)
 *
 * Injection seams (the generator's run(options) pattern): every I/O step
 * is replaceable via `options` for in-process tests.
 */
function discoverPackages(consumerRoot, options = {}) {
  const deps = {
    readJsonIfExists: options.readJsonIfExists ?? readJsonIfExists,
    resolveDeclaredName: options.resolveDeclaredName ?? resolveDeclaredName,
    expandWorkspaceGlobs: options.expandWorkspaceGlobs ?? expandWorkspaceGlobs,
    validateVocabulary: options.validateVocabulary ?? validateVocabulary,
    realpath: options.realpath ?? ((value) => fs.realpathSync(value)),
  };
  const root = path.resolve(consumerRoot);
  const warnings = [];
  const failures = [];
  const skipped = [];

  // 1. The consumer's own manifest gates everything.
  const manifestResult = deps.readJsonIfExists(path.join(root, "package.json"));
  if (!manifestResult.present) {
    failures.push(`Error: consumer package.json not found: ${root}`);
    return { discovered: [], skipped, warnings, failures };
  }
  if (manifestResult.parseError) {
    failures.push(`Error: consumer package.json is not parseable JSON: ${manifestResult.parseError}`);
    return { discovered: [], skipped, warnings, failures };
  }
  const manifest = manifestResult.value;
  if (!isPlainObject(manifest)) {
    failures.push("Error: consumer package.json must be a JSON object");
    return { discovered: [], skipped, warnings, failures };
  }

  // 2. Declared dependencies resolve to candidate roots (targeted, never a scan).
  const candidateRoots = [];
  for (const name of collectDeclaredNames(manifest, failures)) {
    if (!isValidPackageName(name)) {
      failures.push(`Error: invalid declared dependency name: ${JSON.stringify(name)}`);
      continue;
    }
    let resolved;
    try {
      resolved = deps.resolveDeclaredName(root, name);
    } catch (error) {
      failures.push(`Error: cannot resolve declared dependency ${name}: ${error.message}`);
      continue;
    }
    if (resolved === null) {
      warnings.push(`Warning: declared dependency is not installed, skipped: ${name}`);
      continue;
    }
    candidateRoots.push(resolved);
  }

  // 3. Workspace globs expand to member candidate roots.
  const globs = normalizeWorkspaces(manifest, failures);
  if (globs !== null) {
    try {
      candidateRoots.push(...deps.expandWorkspaceGlobs(root, globs));
    } catch (error) {
      failures.push(`Error: workspace expansion failed: ${error.message}`);
    }
  }

  // 4. Dedupe candidates by realpath: a package may be both a declared
  //    dependency (reached through node_modules) and a workspace member.
  const uniqueRoots = [];
  const seenReal = new Set();
  for (const candidateRoot of candidateRoots) {
    let real;
    try {
      real = deps.realpath(candidateRoot);
    } catch (error) {
      failures.push(`Error: cannot resolve candidate package root ${candidateRoot}: ${error.message}`);
      continue;
    }
    if (seenReal.has(real)) continue;
    seenReal.add(real);
    uniqueRoots.push(real);
  }

  // 5. Triage each unique candidate in sorted order.
  const discovered = [];
  for (const candidateRoot of [...uniqueRoots].sort(comparePaths)) {
    let result;
    try {
      result = triageCandidate({ root: candidateRoot }, deps);
    } catch (error) {
      failures.push(`Error: candidate ${candidateRoot}: ${error.message}`);
      continue;
    }
    if (result.status === "discovered") discovered.push(result.discovered);
    else if (result.status === "skipped") skipped.push({ root: candidateRoot, reason: result.reason });
    else failures.push(...result.messages);
  }

  // 6. Set integrity: package names must be unique (requires entries and
  //    the manifest resolve packages by name).
  const byName = new Map();
  for (const found of discovered) {
    if (byName.has(found.name)) {
      failures.push(`Error: duplicate package name ${found.name} discovered at ${byName.get(found.name).root} and ${found.root}`);
    } else {
      byName.set(found.name, found);
    }
  }

  discovered.sort((a, b) => comparePaths(a.name, b.name));
  return { discovered, skipped, warnings, failures };
}

module.exports = {
  comparePaths,
  matchSegments,
  parseWorkspacePattern,
  collectDeclaredNames,
  normalizeWorkspaces,
  readJsonIfExists,
  resolveDeclaredName,
  expandWorkspaceGlobs,
  triageCandidate,
  discoverPackages,
};

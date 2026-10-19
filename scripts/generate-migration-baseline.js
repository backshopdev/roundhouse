#!/usr/bin/env node
"use strict";

/**
 * generate-migration-baseline.js
 *
 * Deterministic generator for `references/migration-baseline.json`, the
 * Phase 1 migration baseline fixture (SPEC-20261017-01, Generator behavior).
 *
 * The generator:
 *   1. Enumerates tracked paths via `git ls-files` (execFile-style, no shell).
 *   2. Classifies every tracked path (detection rules) and computes `sha256`
 *      and `sizeBytes` from file content.
 *   3. Validates the existing fixture file (parse, schema, structure) when
 *      present; absence means "no annotations to merge", not an error.
 *   4. Merges human-authored `intendedPhase5Owner` annotations: carried
 *      forward verbatim, pending marker for new managed paths, stale
 *      annotations dropped loudly (fixture written without them, exit 1).
 *   5. Serializes canonically and validates the output (schema + path
 *      uniqueness + sort order) before writing.
 *   6. Writes exactly one file: `references/migration-baseline.json`,
 *      refusing to write through a symlink at the target path.
 *
 * Exit codes: 0 success, 1 failure, 2 usage error. Every dropped annotation,
 * untracked-path warning, and failure is listed on stderr; zero silent
 * mutations. Runtime: Node 24, built-in modules only, no new dependencies.
 *
 * Usage:
 *   node scripts/generate-migration-baseline.js
 *
 * The generator accepts no arguments; any argument is a usage error (exit 2),
 * mirroring scripts/sync-roundhouse.js's strict argument parsing.
 *
 * Testability seams (used by scripts/test-migration-baseline.js): this module
 * exports its pure pipeline steps, and `run(options)` accepts injected
 * replacements for the tracked-path source, classifier, and the input/output
 * validators. Requiring this module never executes main(); the CLI entry runs
 * only when the script is the process's main module.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const FIXTURE_RELATIVE_PATH = "references/migration-baseline.json";
const SCHEMA_RELATIVE_PATH = "references/migration-baseline.schema.json";
const PENDING_MARKER = "TODO: pending human mapping (new path at generation time)";
const SCHEMA_VERSION = 1;
const GIT_SYMLINK_MODE = "120000";

const USAGE = `Usage: node scripts/generate-migration-baseline.js

Regenerates references/migration-baseline.json from the tracked tree,
carrying human-authored intendedPhase5Owner annotations forward verbatim.

The generator accepts no arguments; any argument is a usage error (exit 2).
`;

// ─── JSON Schema (Draft 2020-12) validator ──────────────────────────────────
// Minimal, fail-closed validator covering a superset of the keywords the
// baseline schema uses. Unknown keywords throw instead of being ignored, so a
// schema revision beyond this validator's support fails loudly rather than
// silently accepting invalid fixtures.

const SCHEMA_ANNOTATION_KEYWORDS = new Set([
  "$schema",
  "$id",
  "$comment",
  "title",
  "description",
  "default",
  "deprecated",
  "examples",
]);

const SUPPORTED_SCHEMA_KEYWORDS = new Set([
  ...SCHEMA_ANNOTATION_KEYWORDS,
  "$ref",
  "$defs",
  "type",
  "enum",
  "const",
  "pattern",
  "minimum",
  "maximum",
  "required",
  "properties",
  "additionalProperties",
  "items",
  "allOf",
  "anyOf",
  "oneOf",
  "not",
  "if",
  "then",
  "else",
]);

function jsonEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a)) {
    return Array.isArray(b) && a.length === b.length && a.every((item, i) => jsonEqual(item, b[i]));
  }
  if (typeof a === "object") {
    if (Array.isArray(b)) return false;
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return (
      aKeys.length === bKeys.length &&
      aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && jsonEqual(a[key], b[key]))
    );
  }
  return false;
}

function schemaTypeMatches(type, value) {
  switch (type) {
    case "object":
      return value !== null && typeof value === "object" && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    default:
      throw new Error(`Unsupported JSON Schema type: ${type}`);
  }
}

function resolveSchemaPointer(rootDocument, pointer) {
  if (!pointer.startsWith("#/")) {
    throw new Error(`Unsupported non-local JSON Schema $ref: ${pointer}`);
  }
  let target = rootDocument;
  for (const segment of pointer.slice(2).split("/")) {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    if (target === null || typeof target !== "object" || !(key in target)) {
      throw new Error(`Unresolvable JSON Schema $ref: ${pointer}`);
    }
    target = target[key];
  }
  return target;
}

function evaluateSchema(schema, instance, instancePath, errors, rootDocument) {
  if (schema === true) return;
  if (schema === false) {
    errors.push(`${instancePath}: schema forbids this value`);
    return;
  }
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`Invalid JSON Schema node (expected object or boolean)`);
  }
  for (const keyword of Object.keys(schema)) {
    if (!SUPPORTED_SCHEMA_KEYWORDS.has(keyword)) {
      throw new Error(`Unsupported JSON Schema keyword: "${keyword}"`);
    }
  }

  if ("$ref" in schema) {
    // Draft 2020-12: $ref is an ordinary assertion; siblings still apply.
    const target = resolveSchemaPointer(rootDocument, schema.$ref);
    evaluateSchema(target, instance, instancePath, errors, rootDocument);
  }
  if ("type" in schema) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => schemaTypeMatches(type, instance))) {
      errors.push(`${instancePath}: expected type ${types.join(" or ")}`);
    }
  }
  if ("enum" in schema && !schema.enum.some((candidate) => jsonEqual(candidate, instance))) {
    errors.push(`${instancePath}: value is not one of the enumerated values`);
  }
  if ("const" in schema && !jsonEqual(schema.const, instance)) {
    errors.push(`${instancePath}: value does not equal the const value`);
  }
  if ("pattern" in schema && typeof instance === "string" && !new RegExp(schema.pattern).test(instance)) {
    errors.push(`${instancePath}: string does not match pattern ${schema.pattern}`);
  }
  if ("minimum" in schema && typeof instance === "number" && instance < schema.minimum) {
    errors.push(`${instancePath}: value is less than minimum ${schema.minimum}`);
  }
  if ("maximum" in schema && typeof instance === "number" && instance > schema.maximum) {
    errors.push(`${instancePath}: value is greater than maximum ${schema.maximum}`);
  }
  if ("required" in schema) {
    const present = instance !== null && typeof instance === "object" && !Array.isArray(instance)
      ? instance
      : {};
    for (const key of schema.required) {
      if (!Object.prototype.hasOwnProperty.call(present, key)) {
        errors.push(`${instancePath}: missing required property "${key}"`);
      }
    }
  }
  if ("properties" in schema && instance !== null && typeof instance === "object" && !Array.isArray(instance)) {
    for (const [key, subschema] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(instance, key)) {
        evaluateSchema(subschema, instance[key], `${instancePath}/${key}`, errors, rootDocument);
      }
    }
  }
  if ("additionalProperties" in schema && instance !== null && typeof instance === "object" && !Array.isArray(instance)) {
    const known = "properties" in schema ? Object.keys(schema.properties) : [];
    for (const key of Object.keys(instance)) {
      if (known.includes(key)) continue;
      if (schema.additionalProperties === false) {
        errors.push(`${instancePath}: additional property "${key}" is not allowed`);
      } else if (typeof schema.additionalProperties === "object") {
        evaluateSchema(schema.additionalProperties, instance[key], `${instancePath}/${key}`, errors, rootDocument);
      }
    }
  }
  if ("items" in schema && Array.isArray(instance)) {
    instance.forEach((item, index) => {
      evaluateSchema(schema.items, item, `${instancePath}/${index}`, errors, rootDocument);
    });
  }
  if ("allOf" in schema) {
    for (const subschema of schema.allOf) {
      evaluateSchema(subschema, instance, instancePath, errors, rootDocument);
    }
  }
  if ("anyOf" in schema) {
    const branchErrors = schema.anyOf.map((subschema) => {
      const branch = [];
      evaluateSchema(subschema, instance, instancePath, branch, rootDocument);
      return branch;
    });
    if (!branchErrors.some((branch) => branch.length === 0)) {
      errors.push(`${instancePath}: does not match any anyOf branch`);
    }
  }
  if ("oneOf" in schema) {
    const validCount = schema.oneOf.filter((subschema) => {
      const branch = [];
      evaluateSchema(subschema, instance, instancePath, branch, rootDocument);
      return branch.length === 0;
    }).length;
    if (validCount !== 1) {
      errors.push(`${instancePath}: matches ${validCount} oneOf branches (expected exactly 1)`);
    }
  }
  if ("not" in schema) {
    const branch = [];
    evaluateSchema(schema.not, instance, instancePath, branch, rootDocument);
    if (branch.length === 0) {
      errors.push(`${instancePath}: matches a forbidden (not) schema`);
    }
  }
  if ("if" in schema) {
    const condition = [];
    evaluateSchema(schema.if, instance, instancePath, condition, rootDocument);
    const branchSchema = condition.length === 0 ? schema.then : schema.else;
    if (branchSchema !== undefined) {
      evaluateSchema(branchSchema, instance, instancePath, errors, rootDocument);
    }
  }
}

/**
 * Validate `instance` against `schemaDocument` (Draft 2020-12 subset).
 * Returns an array of error strings; empty means valid. Throws on schema
 * constructs this validator does not support (fail closed).
 */
function validateAgainstSchema(schemaDocument, instance) {
  const errors = [];
  evaluateSchema(schemaDocument, instance, "#", errors, schemaDocument);
  return errors;
}

// ─── Structural validation (generator-owned checks) ─────────────────────────

function comparePaths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Generator-owned structural checks: path uniqueness and ascending byte-wise
 * (code-unit) sort order. These are deliberately NOT expressed in the JSON
 * Schema (SPEC-20261017-01, Schema file contract).
 */
function validateStructure(entries) {
  if (!Array.isArray(entries)) {
    return ["entries: expected an array"];
  }
  const errors = [];
  const firstSeenAt = new Map();
  for (let index = 0; index < entries.length; index++) {
    const entryPath = entries[index] && entries[index].path;
    if (typeof entryPath !== "string") continue; // type errors are the schema's job
    if (firstSeenAt.has(entryPath)) {
      errors.push(`duplicate path: ${entryPath} (entries ${firstSeenAt.get(entryPath)} and ${index})`);
    } else {
      firstSeenAt.set(entryPath, index);
    }
    if (index > 0) {
      const previousPath = entries[index - 1] && entries[index - 1].path;
      if (typeof previousPath === "string" && comparePaths(previousPath, entryPath) > 0) {
        errors.push(`path out of order: "${entryPath}" at position ${index} follows "${previousPath}"`);
      }
    }
  }
  return errors;
}

// ─── Classification (detection rules) ────────────────────────────────────────

function isManagedSrcPath(relativePath) {
  return relativePath === "src/opencode.json" || relativePath.startsWith("src/.opencode/");
}

function isValidCombination(base, classification) {
  if (base === "src") return classification === "managed" || classification === "seed";
  if (base === "root") return classification === "root-only-artifact";
  return false;
}

/**
 * Detection rules, total over tracked paths (SPEC-20261017-01):
 * - The fixture file itself is never inventoried.
 * - Tracked path under src/: base "src"; managed if under src/.opencode/ or
 *   exactly src/opencode.json, otherwise seed.
 * - Tracked path outside src/ with a tracked src/<path> counterpart: seed
 *   instance (derived state), not inventoried. The counterpart check consults
 *   the tracked set, not the filesystem, so untracked files never change
 *   fixture membership.
 * - Tracked path outside src/ without a counterpart: base "root",
 *   classification "root-only-artifact".
 * - Tracked symlink (git mode 120000): failure — checked before the fixture
 *   self-exclusion so a symlink at the fixture path is rejected like any
 *   other symlink instead of being skipped and later followed by the fixture
 *   write.
 * - Every tracked path must classify; combination validity is re-checked as a
 *   defensive guard so a generator defect fails closed.
 */
function classifyTrackedPaths(trackedPaths) {
  const trackedSet = new Set(trackedPaths.map((tracked) => tracked.path));
  const entries = [];
  const failures = [];
  for (const tracked of trackedPaths) {
    const relativePath = tracked.path;
    // Symlink rejection precedes the fixture self-exclusion: a tracked
    // symlink at the fixture path must be rejected, not skipped, so the
    // fixture write can never follow it.
    if (tracked.mode === GIT_SYMLINK_MODE) {
      failures.push({ path: relativePath, reason: "tracked symlink (git mode 120000)" });
      continue;
    }
    if (relativePath === FIXTURE_RELATIVE_PATH) continue;
    let base;
    let classification;
    if (relativePath.startsWith("src/")) {
      base = "src";
      classification = isManagedSrcPath(relativePath) ? "managed" : "seed";
    } else if (trackedSet.has(`src/${relativePath}`)) {
      continue; // seed instance: derived state, not inventoried
    } else {
      base = "root";
      classification = "root-only-artifact";
    }
    if (!isValidCombination(base, classification)) {
      failures.push({ path: relativePath, reason: "unclassifiable tracked path" });
      continue;
    }
    entries.push({ path: relativePath, base, classification });
  }
  return { entries, failures };
}

// ─── Git enumeration ────────────────────────────────────────────────────────

/**
 * Tracked paths with index modes, via `git ls-files --stage -z`
 * (execFile-style: argument array, no shell interpolation). The mode is the
 * authoritative tracked-symlink signal (120000) on every platform, including
 * Windows checkouts where symlinks materialize as plain files.
 */
function listTrackedPaths(root) {
  const output = execFileSync("git", ["ls-files", "--stage", "-z"], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
    encoding: "buffer",
  });
  const trackedPaths = [];
  for (const record of output.toString("utf8").split("\0")) {
    if (!record) continue;
    const tab = record.indexOf("\t");
    if (tab === -1) {
      throw new Error(`malformed git ls-files record: ${record}`);
    }
    const mode = record.slice(0, tab).split(" ")[0];
    trackedPaths.push({ mode, path: record.slice(tab + 1) });
  }
  return trackedPaths;
}

/**
 * Untracked-and-not-ignored paths, via `git ls-files --others
 * --exclude-standard -z`. Ignore patterns do not exclude tracked files, but
 * they do exclude untracked ones — exactly the SCEN-041 population.
 */
function listUntrackedPaths(root) {
  const output = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    maxBuffer: 64 * 1024 * 1024,
    encoding: "buffer",
  });
  return output.toString("utf8").split("\0").filter(Boolean);
}

// ─── Content hashing ────────────────────────────────────────────────────────

function hashFile(absolutePath) {
  const content = fs.readFileSync(absolutePath);
  return {
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
    sizeBytes: content.length,
  };
}

// ─── Annotation merge ───────────────────────────────────────────────────────

/**
 * Merge human-authored annotations into a fresh inventory:
 * - managed path present in both: existing value carried forward verbatim;
 * - managed path only in the fresh inventory: deterministic pending marker;
 * - annotated path absent from the fresh inventory or no longer classified
 *   managed: dropped (reported loudly by the caller).
 * The generator never synthesizes, guesses, or alters an annotation value.
 */
function mergeAnnotations(freshEntries, existingAnnotations) {
  const entries = freshEntries.map((entry) => {
    if (entry.classification !== "managed") {
      const copy = { ...entry };
      delete copy.intendedPhase5Owner;
      return copy;
    }
    const existingOwner = existingAnnotations.get(entry.path);
    return { ...entry, intendedPhase5Owner: existingOwner !== undefined ? existingOwner : PENDING_MARKER };
  });
  const freshByPath = new Map(freshEntries.map((entry) => [entry.path, entry]));
  const dropped = [];
  for (const annotatedPath of existingAnnotations.keys()) {
    const fresh = freshByPath.get(annotatedPath);
    if (!fresh || fresh.classification !== "managed") {
      dropped.push(annotatedPath);
    }
  }
  dropped.sort(comparePaths);
  return { entries, dropped };
}

// ─── Canonical serialization ────────────────────────────────────────────────

function orderEntry(entry) {
  const ordered = {
    path: entry.path,
    base: entry.base,
    classification: entry.classification,
    sha256: entry.sha256,
    sizeBytes: entry.sizeBytes,
  };
  if (entry.intendedPhase5Owner !== undefined) {
    ordered.intendedPhase5Owner = entry.intendedPhase5Owner;
  }
  return ordered;
}

/**
 * Canonical serialization: entries sorted ascending byte-wise by path,
 * member order path/base/classification/sha256/sizeBytes/intendedPhase5Owner,
 * two-space indent, LF line endings (JSON.stringify emits \n), single
 * trailing newline. UTF-8 without BOM is a property of the write, not the
 * string.
 */
function serializeFixture(fixture) {
  const entries = [...fixture.entries]
    .sort((a, b) => comparePaths(a.path, b.path))
    .map(orderEntry);
  return `${JSON.stringify({ schemaVersion: fixture.schemaVersion, entries }, null, 2)}\n`;
}

// ─── Validation defaults (input and output share one shape) ─────────────────

function defaultValidateFixture(fixtureDocument, schemaDocument) {
  return [
    ...validateAgainstSchema(schemaDocument, fixtureDocument),
    ...validateStructure(fixtureDocument ? fixtureDocument.entries : undefined),
  ];
}

function describeError(error, fixtureDocument) {
  if (typeof error !== "string") return String(error);
  const match = error.match(/^#\/entries\/(\d+)/);
  if (match && fixtureDocument && Array.isArray(fixtureDocument.entries)) {
    const entry = fixtureDocument.entries[Number(match[1])];
    if (entry && typeof entry.path === "string") {
      return `${error} (path: ${entry.path})`;
    }
  }
  return error;
}

// ─── Pipeline ───────────────────────────────────────────────────────────────

/**
 * Run the full generation pipeline. Returns { code, messages, wrote } without
 * exiting, so tests can exercise the pipeline in-process; main() maps the
 * result onto process exit codes. `options` provides the test seams:
 * - root: repo root override (default: the repository containing this script)
 * - listTrackedPaths: tracked-path source replacement
 * - classifyPaths: classifier replacement
 * - validateInput / validateOutput: validator replacements (each receives
 *   (fixtureDocument, schemaDocument) and returns an array of error strings)
 */
function run(options = {}) {
  const root = options.root ?? path.resolve(__dirname, "..");
  const deps = {
    listTrackedPaths: options.listTrackedPaths ?? listTrackedPaths,
    classifyPaths: options.classifyPaths ?? classifyTrackedPaths,
    validateInput: options.validateInput ?? defaultValidateFixture,
    validateOutput: options.validateOutput ?? defaultValidateFixture,
  };
  const messages = [];
  const failure = () => ({ code: 1, messages, wrote: false });

  const schemaAbsolutePath = path.join(root, ...SCHEMA_RELATIVE_PATH.split("/"));
  let schemaDocument;
  try {
    schemaDocument = JSON.parse(fs.readFileSync(schemaAbsolutePath, "utf8"));
  } catch (error) {
    messages.push(`Error: cannot load schema file ${SCHEMA_RELATIVE_PATH}: ${error.message}`);
    return failure();
  }

  let trackedPaths;
  try {
    trackedPaths = deps.listTrackedPaths(root);
  } catch (error) {
    messages.push(`Error: git ls-files failed: ${error.message}`);
    return failure();
  }

  const { entries: classified, failures: classificationFailures } = deps.classifyPaths(trackedPaths);
  if (classificationFailures.length > 0) {
    messages.push(`Error: ${classificationFailures.length} tracked path(s) failed classification; nothing written:`);
    for (const failureRecord of classificationFailures) {
      messages.push(`  - ${failureRecord.path}: ${failureRecord.reason}`);
    }
    return failure();
  }

  const contentFailures = [];
  for (const entry of classified) {
    const absolutePath = path.join(root, ...entry.path.split("/"));
    let stats;
    try {
      stats = fs.lstatSync(absolutePath);
    } catch {
      contentFailures.push({ path: entry.path, reason: "tracked path is missing on disk" });
      continue;
    }
    if (stats.isSymbolicLink()) {
      contentFailures.push({ path: entry.path, reason: "tracked path is a symlink" });
      continue;
    }
    try {
      const { sha256, sizeBytes } = hashFile(absolutePath);
      entry.sha256 = sha256;
      entry.sizeBytes = sizeBytes;
    } catch (error) {
      contentFailures.push({ path: entry.path, reason: `unreadable: ${error.message}` });
    }
  }
  if (contentFailures.length > 0) {
    messages.push(`Error: ${contentFailures.length} tracked path(s) failed content read; nothing written:`);
    for (const failureRecord of contentFailures) {
      messages.push(`  - ${failureRecord.path}: ${failureRecord.reason}`);
    }
    return failure();
  }

  classified.sort((a, b) => comparePaths(a.path, b.path));

  const fixtureAbsolutePath = path.join(root, ...FIXTURE_RELATIVE_PATH.split("/"));
  let existingDocument = null;
  if (fs.existsSync(fixtureAbsolutePath)) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(fixtureAbsolutePath, "utf8"));
    } catch (error) {
      messages.push(`Error: existing fixture ${FIXTURE_RELATIVE_PATH} is not parseable JSON: ${error.message}`);
      return failure();
    }
    const inputErrors = deps.validateInput(parsed, schemaDocument);
    if (inputErrors.length > 0) {
      messages.push(`Error: existing fixture ${FIXTURE_RELATIVE_PATH} failed input validation; nothing written:`);
      for (const inputError of inputErrors) {
        messages.push(`  - ${describeError(inputError, parsed)}`);
      }
      return failure();
    }
    existingDocument = parsed;
  }

  const existingAnnotations = new Map();
  if (existingDocument) {
    for (const entry of existingDocument.entries) {
      if (entry.intendedPhase5Owner !== undefined) {
        existingAnnotations.set(entry.path, entry.intendedPhase5Owner);
      }
    }
  }
  const { entries: merged, dropped } = mergeAnnotations(classified, existingAnnotations);

  const outputDocument = { schemaVersion: SCHEMA_VERSION, entries: merged };
  const outputErrors = deps.validateOutput(outputDocument, schemaDocument);
  if (outputErrors.length > 0) {
    messages.push(`Error: generated fixture failed pre-write validation; nothing written:`);
    for (const outputError of outputErrors) {
      messages.push(`  - ${describeError(outputError, outputDocument)}`);
    }
    return failure();
  }
  const bytes = serializeFixture(outputDocument);

  // Pre-write guard: the tracked-mode check in classifyTrackedPaths covers
  // symlinks known to git, but a filesystem symlink at the fixture path whose
  // index mode is regular (a typechange state) would otherwise be followed by
  // the write below, because the fixture path is self-excluded from the
  // inventory before hashing. Fail closed instead of writing through the link.
  let fixtureStats = null;
  try {
    fixtureStats = fs.lstatSync(fixtureAbsolutePath);
  } catch {
    // An absent fixture path is the normal first-run state; nothing to guard.
  }
  if (fixtureStats !== null && fixtureStats.isSymbolicLink()) {
    messages.push(`Error: refusing to write through a symlink at ${FIXTURE_RELATIVE_PATH}; nothing written.`);
    return failure();
  }

  fs.mkdirSync(path.dirname(fixtureAbsolutePath), { recursive: true });
  fs.writeFileSync(fixtureAbsolutePath, bytes, "utf8");

  let untrackedPaths = [];
  try {
    untrackedPaths = listUntrackedPaths(root);
  } catch {
    // The untracked warning is advisory; never fail generation because of it.
  }
  if (dropped.length > 0) {
    messages.push(`Error: ${dropped.length} stale annotation(s) dropped (path vanished from the inventory or is no longer classified managed):`);
    for (const droppedPath of dropped) {
      messages.push(`  - ${droppedPath}`);
    }
    messages.push(`Warning: fixture written without the stale annotations listed above; review and rerun.`);
  }
  if (untrackedPaths.length > 0) {
    messages.push(`Warning: ${untrackedPaths.length} untracked-and-not-ignored path(s) present; not inventoried:`);
    for (const untrackedPath of untrackedPaths) {
      messages.push(`  - ${untrackedPath}`);
    }
  }

  return { code: dropped.length > 0 ? 1 : 0, messages, wrote: true };
}

// ─── CLI entry ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length > 0) {
    console.error(`Error: unexpected argument(s): ${args.join(" ")}`);
    console.error("");
    console.error(USAGE);
    process.exit(2);
  }
  let result;
  try {
    result = run();
  } catch (error) {
    console.error(`Error: generation failed unexpectedly: ${error && error.stack ? error.stack : error}`);
    process.exit(1);
  }
  for (const message of result.messages) {
    console.error(message);
  }
  if (result.code === 0) {
    console.log(`Wrote ${FIXTURE_RELATIVE_PATH}.`);
  }
  process.exit(result.code);
}

if (require.main === module) {
  main();
}

module.exports = {
  FIXTURE_RELATIVE_PATH,
  SCHEMA_RELATIVE_PATH,
  PENDING_MARKER,
  SCHEMA_VERSION,
  GIT_SYMLINK_MODE,
  comparePaths,
  classifyTrackedPaths,
  validateAgainstSchema,
  validateStructure,
  mergeAnnotations,
  serializeFixture,
  listTrackedPaths,
  listUntrackedPaths,
  run,
};

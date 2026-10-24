"use strict";

/**
 * manifest.js
 *
 * The `.roundhouse/manifest.json` generation and structural validation
 * (SPEC-20261019-02, Public contracts, .roundhouse/manifest.json). The
 * manifest is the generated composition and ownership record; it is
 * committed so composition changes are reviewable (DEC-20261017-02).
 *
 * Schema (member orders pinned):
 *   {
 *     schemaVersion: 1,
 *     composer: "<cli package name>@<version>",
 *     packages: [                       // sorted ascending byte-wise by name
 *       {
 *         name, version, contractVersion,
 *         skills: [...],                // sorted ascending byte-wise
 *         managed: [{ path, sha256 }],  // sorted by path; consumer-root-relative POSIX paths
 *         seeds: [...],                 // sorted; consumer-root-relative POSIX paths
 *       },
 *     ],
 *     composed: {
 *       "opencode.json": { sha256, templateSha256 },
 *     },
 *   }
 *
 * The managed entries record every managed file the package owns (skill
 * entries included) with the SHA-256 of the package's source file at
 * compose time; the composed entry records the rendered file's and the
 * template's hashes as of the last compose. The recorded hashes make the
 * manifest self-sufficient for drift detection without package sources
 * present; the authoritative verify comparison remains consumer-file-
 * versus-source byte-equality.
 *
 * Serialization canon: UTF-8 without BOM; LF line endings; two-space
 * indentation; the member orders above; a single trailing newline.
 * `validateManifest` checks structure and types (not sort order — sorting
 * is canonicalization, not integrity; compose refreshes the manifest
 * wholesale and verify's authority is byte-equality against sources).
 *
 * Pure: models arrive assembled (with hashes); file I/O lives in
 * commands.js. Runtime: Node 24, built-in modules only.
 */

const MANIFEST_SCHEMA_VERSION = 1;
const MANIFEST_RELATIVE_PATH = ".roundhouse/manifest.json";
const RENDERED_RELATIVE_PATH = "opencode.json";

const TOP_LEVEL_MEMBERS = Object.freeze(["schemaVersion", "composer", "packages", "composed"]);
const PACKAGE_MEMBERS = Object.freeze(["name", "version", "contractVersion", "skills", "managed", "seeds"]);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

// ─── Pure helpers ───────────────────────────────────────────────────────────

function comparePaths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

// ─── Build ──────────────────────────────────────────────────────────────────

/**
 * Build the manifest object from the assembled model set and the composed
 * artifacts' hashes. Pure; every array is sorted byte-wise at build time.
 */
function buildManifest({ composer, models, renderedSha256, templateSha256 }) {
  const packages = [...models]
    .sort((a, b) => comparePaths(a.name, b.name))
    .map((model) => ({
      name: model.name,
      version: model.version,
      contractVersion: model.envelope.contractVersion,
      skills: [...model.skills].sort(comparePaths),
      managed: model.managedFiles
        .map((file) => ({ path: file.consumerPath, sha256: file.sha256 }))
        .sort((a, b) => comparePaths(a.path, b.path)),
      seeds: model.seedFiles.map((seed) => seed.consumerPath).sort(comparePaths),
    }));
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    composer,
    packages,
    composed: {
      [RENDERED_RELATIVE_PATH]: { sha256: renderedSha256, templateSha256 },
    },
  };
}

/**
 * Canonical serialization: two-space indent, LF line endings (JSON.stringify
 * emits \n), single trailing newline, pinned member orders.
 */
function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Parse manifest text. Throws on unparseable JSON (the caller converts to
 * a fail-closed error).
 */
function parseManifest(text) {
  return JSON.parse(text);
}

// ─── Structural validation ──────────────────────────────────────────────────

function validatePackageEntry(pkg, label, violations) {
  if (!isPlainObject(pkg)) {
    violations.push(`${label}: must be an object`);
    return;
  }
  const keys = Object.keys(pkg);
  for (const member of PACKAGE_MEMBERS) {
    if (!keys.includes(member)) violations.push(`${label}: missing required member "${member}"`);
  }
  for (const member of keys) {
    if (!PACKAGE_MEMBERS.includes(member)) violations.push(`${label}: unexpected member "${member}"`);
  }
  if (!isNonEmptyString(pkg.name)) violations.push(`${label}.name: must be a non-empty string`);
  if (!isNonEmptyString(pkg.version)) violations.push(`${label}.version: must be a non-empty string`);
  if (!Number.isInteger(pkg.contractVersion)) violations.push(`${label}.contractVersion: must be an integer`);
  if (!Array.isArray(pkg.skills)) {
    violations.push(`${label}.skills: must be an array`);
  } else {
    pkg.skills.forEach((skill, index) => {
      if (!isNonEmptyString(skill)) violations.push(`${label}.skills[${index}]: must be a non-empty string`);
    });
  }
  if (!Array.isArray(pkg.managed)) {
    violations.push(`${label}.managed: must be an array`);
  } else {
    pkg.managed.forEach((entry, index) => {
      const entryLabel = `${label}.managed[${index}]`;
      if (!isPlainObject(entry)) {
        violations.push(`${entryLabel}: must be an object`);
        return;
      }
      const entryKeys = Object.keys(entry);
      if (entryKeys.length !== 2 || !entryKeys.includes("path") || !entryKeys.includes("sha256")) {
        violations.push(`${entryLabel}: must carry exactly path and sha256`);
      }
      if (!isNonEmptyString(entry.path)) violations.push(`${entryLabel}.path: must be a non-empty string`);
      if (!SHA256_PATTERN.test(entry.sha256 ?? "")) violations.push(`${entryLabel}.sha256: must be a lowercase sha256 hex digest`);
    });
  }
  if (!Array.isArray(pkg.seeds)) {
    violations.push(`${label}.seeds: must be an array`);
  } else {
    pkg.seeds.forEach((seed, index) => {
      if (!isNonEmptyString(seed)) violations.push(`${label}.seeds[${index}]: must be a non-empty string`);
    });
  }
}

/**
 * Validate a parsed manifest's structure and types. Returns an array of
 * violation strings; empty means structurally sound. Sort order is
 * deliberately not enforced (canonicalization, not integrity).
 */
function validateManifest(manifest) {
  const violations = [];
  if (!isPlainObject(manifest)) {
    violations.push("manifest: must be a JSON object");
    return violations;
  }
  const members = Object.keys(manifest);
  for (const member of TOP_LEVEL_MEMBERS) {
    if (!members.includes(member)) violations.push(`missing required member "${member}"`);
  }
  for (const member of members) {
    if (!TOP_LEVEL_MEMBERS.includes(member)) violations.push(`unexpected member "${member}"`);
  }
  if (!Number.isInteger(manifest.schemaVersion)) {
    violations.push("schemaVersion: must be an integer");
  } else if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    violations.push(`schemaVersion: must be ${MANIFEST_SCHEMA_VERSION} (got ${manifest.schemaVersion})`);
  }
  if (!isNonEmptyString(manifest.composer)) violations.push("composer: must be a non-empty string");
  if (!Array.isArray(manifest.packages)) {
    violations.push("packages: must be an array");
  } else {
    manifest.packages.forEach((pkg, index) => validatePackageEntry(pkg, `packages[${index}]`, violations));
  }
  if (!isPlainObject(manifest.composed)) {
    violations.push("composed: must be an object");
  } else {
    const composedKeys = Object.keys(manifest.composed);
    if (composedKeys.length !== 1 || composedKeys[0] !== RENDERED_RELATIVE_PATH) {
      violations.push(`composed: must contain exactly "${RENDERED_RELATIVE_PATH}"`);
    } else {
      const entry = manifest.composed[RENDERED_RELATIVE_PATH];
      const entryLabel = `composed.${RENDERED_RELATIVE_PATH}`;
      if (!isPlainObject(entry)) {
        violations.push(`${entryLabel}: must be an object`);
      } else {
        const entryKeys = Object.keys(entry);
        if (entryKeys.length !== 2 || !entryKeys.includes("sha256") || !entryKeys.includes("templateSha256")) {
          violations.push(`${entryLabel}: must carry exactly sha256 and templateSha256`);
        }
        for (const key of ["sha256", "templateSha256"]) {
          if (!SHA256_PATTERN.test(entry[key] ?? "")) violations.push(`${entryLabel}.${key}: must be a lowercase sha256 hex digest`);
        }
      }
    }
  }
  return violations;
}

module.exports = {
  MANIFEST_SCHEMA_VERSION,
  MANIFEST_RELATIVE_PATH,
  RENDERED_RELATIVE_PATH,
  buildManifest,
  serializeManifest,
  parseManifest,
  validateManifest,
};

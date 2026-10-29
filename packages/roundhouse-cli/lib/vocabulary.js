"use strict";

/**
 * vocabulary.js
 *
 * The `roundhouse.json` vocabulary contract (SPEC-20261019-02, Public
 * contracts, roundhouse.json vocabulary): the exact member set, the
 * four-value kind enum, the required `contractVersion` integer, and the
 * required `skills`/`bash`/`requires` arrays. The contract-version
 * compatibility check is owned here and nowhere else (the plan's ownership
 * map: the vocabulary-violation and contract-version families).
 *
 * The DEC-20261017-02 dependency rules are validation failures, not
 * authoring guidance. This module owns their per-envelope, name-family
 * form:
 *
 *   - Rule 1: a `capability` or `workflow` package's `requires` must
 *     contain a core-family entry (family token `core`, e.g.
 *     `@backshop/roundhouse-core` or `@roundhouse-fixture/core`).
 *   - Rules 3/4: a package whose own name's family token starts with
 *     `framework-` or `cms-` must require a language-family entry (a
 *     family token starting with `lang-`).
 *
 * The set-level aspects of the dependency graph are NOT owned here:
 * whether a `requires` entry resolves within the discovered set, and
 * whether the requires graph is acyclic, live in `graph.js`. The
 * name-family checks are declaration-shape rules; set-level truth
 * (exactly-one-core by kind, entry resolution) remains with the graph
 * validator, so the two layers stay orthogonal and no rule logic is
 * duplicated.
 *
 * Pure validation only: the envelope arrives parsed; I/O lives in
 * `discovery.js` (triage) and `model.js` (assembly). All violations in one
 * envelope are collected (not first-failure) so a rejected envelope
 * reports everything wrong with it in a single pass. Violations are
 * strings naming the offending member path (for example `skills[2]`);
 * callers prefix the offending package's name.
 *
 * Runtime: Node 24, built-in modules only.
 */

const SUPPORTED_CONTRACT_VERSION = 1;
const KINDS = Object.freeze(["core", "workflow", "capability", "bundle"]);
const VOCABULARY_MEMBERS = Object.freeze(["kind", "contractVersion", "skills", "bash", "requires"]);
const REQUIRED_MEMBERS = Object.freeze(["contractVersion", "skills", "bash", "requires"]);

const CORE_FAMILY_TOKEN = "core";
const LANGUAGE_FAMILY_PREFIX = "lang-";
const FRAMEWORK_FAMILY_PREFIX = "framework-";
const CMS_FAMILY_PREFIX = "cms-";

// ─── Value predicates ───────────────────────────────────────────────────────

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

/**
 * A skill ID must be usable as a single directory name under the
 * managed-path convention `managed/skills/<id>/SKILL.md`: one non-empty
 * path segment, no separators, no dot segments, no NUL. The bidirectional
 * declared-versus-actual content check is model.js's family, not ours.
 */
function isSkillId(value) {
  if (!isNonEmptyString(value)) return false;
  if (value.includes("/") || value.includes("\\") || value.includes("\0")) return false;
  return value !== "." && value !== "..";
}

/**
 * A package name must be resolvable as a path below a `node_modules`
 * directory: non-empty, no backslashes or NULs, not absolute, and every
 * `/`-separated segment non-empty and not a dot segment. Shared with
 * `discovery.js` (which applies the same shape rule to the consumer's
 * declared dependency names) so the shape rule has one definition.
 */
function isValidPackageName(value) {
  if (!isNonEmptyString(value)) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  return value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

// ─── Name-family helpers (dependency rules) ─────────────────────────────────

/**
 * The taxonomy family token of a package name: the last `/`-separated
 * segment with a leading `roundhouse-` stripped. Examples:
 *   `@backshop/roundhouse-lang-javascript` -> `lang-javascript`
 *   `@backshop/roundhouse-core`            -> `core`
 *   `@roundhouse-fixture/framework-phantom` -> `framework-phantom`
 */
function familyToken(packageName) {
  if (!isNonEmptyString(packageName)) return null;
  const segment = packageName.slice(packageName.lastIndexOf("/") + 1);
  return segment.startsWith("roundhouse-") ? segment.slice("roundhouse-".length) : segment;
}

// ─── Member validation ──────────────────────────────────────────────────────

function validateArrayMember(envelope, member, violations, elementPredicate, elementDescription) {
  if (!Object.prototype.hasOwnProperty.call(envelope, member)) return; // absence already reported
  const value = envelope[member];
  if (!Array.isArray(value)) {
    violations.push(`${member}: must be an array`);
    return;
  }
  value.forEach((entry, index) => {
    if (!elementPredicate(entry)) violations.push(`${member}[${index}]: ${elementDescription}`);
  });
}

// ─── Dependency rules (per-envelope, name-family form) ──────────────────────

/**
 * `selfToken` is the declaring package's own family token, or null when the
 * caller did not supply a package name (rules 3/4 are name-family rules and
 * cannot be evaluated without it; `discovery.js` always supplies the name).
 */
function validateDependencyRules(envelope, selfToken, violations) {
  const requires = Array.isArray(envelope.requires) ? envelope.requires : [];
  const requiresTokens = requires.map(familyToken);
  if (envelope.kind === "capability" || envelope.kind === "workflow") {
    if (!requiresTokens.includes(CORE_FAMILY_TOKEN)) {
      violations.push(`requires: ${envelope.kind} packages must require the core package (a core-family entry, e.g. "@backshop/roundhouse-core")`);
    }
  }
  if (selfToken !== null) {
    if (selfToken.startsWith(FRAMEWORK_FAMILY_PREFIX) && !requiresTokens.some((token) => token !== null && token.startsWith(LANGUAGE_FAMILY_PREFIX))) {
      violations.push("requires: framework packages must require their applicable language package (a lang-family entry)");
    }
    if (selfToken.startsWith(CMS_FAMILY_PREFIX) && !requiresTokens.some((token) => token !== null && token.startsWith(LANGUAGE_FAMILY_PREFIX))) {
      violations.push("requires: CMS packages must require their applicable language package (a lang-family entry)");
    }
  }
}

// ─── Entry point ────────────────────────────────────────────────────────────

/**
 * Validate one parsed `roundhouse.json` envelope. Returns an array of
 * violation strings; empty means valid. Options:
 *   - supportedContractVersion: override the CLI's supported version
 *     (default SUPPORTED_CONTRACT_VERSION).
 *   - packageName: the declaring package's npm name; enables the
 *     framework/CMS language dependency rules (rules 3/4).
 */
function validateVocabulary(envelope, options = {}) {
  const supportedContractVersion = options.supportedContractVersion ?? SUPPORTED_CONTRACT_VERSION;
  const packageName = options.packageName ?? null;
  const violations = [];
  if (!isPlainObject(envelope)) {
    violations.push("envelope: must be a JSON object");
    return violations;
  }
  const members = Object.keys(envelope);
  for (const member of REQUIRED_MEMBERS) {
    if (!Object.prototype.hasOwnProperty.call(envelope, member)) violations.push(`missing required member "${member}"`);
  }
  for (const member of members) {
    if (!VOCABULARY_MEMBERS.includes(member)) violations.push(`unexpected member "${member}" (no additional members are permitted)`);
  }
  if (Object.prototype.hasOwnProperty.call(envelope, "kind")) {
    if (typeof envelope.kind !== "string" || !KINDS.includes(envelope.kind)) {
      violations.push(`kind: must be one of ${KINDS.join(", ")}`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(envelope, "contractVersion")) {
    if (!Number.isInteger(envelope.contractVersion)) {
      violations.push("contractVersion: must be an integer");
    } else if (envelope.contractVersion !== supportedContractVersion) {
      violations.push(`contractVersion: must equal the supported contract version ${supportedContractVersion} (got ${envelope.contractVersion})`);
    }
  }
  validateArrayMember(envelope, "skills", violations, isSkillId, "must be a skill ID usable as a single managed/skills/<id> directory name");
  validateArrayMember(envelope, "bash", violations, isNonEmptyString, "must be a non-empty allow-pattern string");
  validateArrayMember(envelope, "requires", violations, isValidPackageName, "must be a package name");
  validateDependencyRules(envelope, packageName === null ? null : familyToken(packageName), violations);
  return violations;
}

module.exports = {
  SUPPORTED_CONTRACT_VERSION,
  KINDS,
  VOCABULARY_MEMBERS,
  familyToken,
  isValidPackageName,
  validateVocabulary,
};

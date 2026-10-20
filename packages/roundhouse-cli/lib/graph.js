"use strict";

/**
 * graph.js
 *
 * Set-level validation over the discovered package-model set (the plan's
 * T-08: nine checks realizing five of the spec's ten fail-closed families
 * — duplicate ownership, missing requires, requires cycle, dependency-rule
 * violation, bash collision). Every rejection names the violating package
 * and path. Pure: models and the validated template arrive in memory; I/O
 * lives elsewhere.
 *
 * Ownership split (reconciled): the per-envelope dependency-rule
 * declaration shapes — a capability/workflow envelope's `requires` must
 * contain a core-family entry, and a `framework-*`/`cms-*`-named package's
 * `requires` must contain a lang-family entry — live in `vocabulary.js`
 * and are NOT re-implemented here. This module owns the set-level residue:
 * whether required entries resolve within the discovered set (check 2) and
 * whether the required core entry resolves to the discovered kind-core
 * package (check 4), plus requires-graph acyclicity (check 3).
 *
 * Expected model shape (fulfilled by model.js):
 *   {
 *     name: string,                    // npm package name, unique in the set
 *     kind: string | null,             // envelope.kind ?? null
 *     skills: string[],                // declared skill IDs
 *     bash: string[],                  // declared allow patterns
 *     requires: string[],              // declared package names
 *     managedFiles: [{ path, consumerPath, sha256 }],
 *     seedFiles: [{ path, consumerPath }],
 *   }
 * `path` is the package-relative POSIX path; `consumerPath` is the
 * consumer-root-relative POSIX path the artifact materializes to
 * (managed/<rel> -> .opencode/<rel>; seed/<rel> -> <rel>).
 *
 * The nine checks, in evaluation order (all run; violations collect):
 *   1. duplicate skill IDs (across packages and within one package)
 *   2. unresolved requires (entries resolving to no discovered package)
 *   3. requires cycles (depth-first over resolvable edges)
 *   4. dependency-rule residue: a capability/workflow package's requires
 *      must include the discovered core package's name
 *   5. duplicate managed paths, EXCLUDING skill-entry convention paths
 *      (`skills/<id>/SKILL.md` — skill-entry ownership is the skill-ID
 *      rule's domain, per the WP-01 fixture note; additional files under
 *      managed/skills/<id>/ remain governed by this check)
 *   6. the agent-path reservation (non-core packages declaring managed
 *      paths under .opencode/agents/ fail)
 *   7. seed-path collisions
 *   8. exactly one core-kind package (by kind)
 *   9. bash-pattern collisions against the validated template's
 *      role-driven entries: a package pattern colliding with a non-"allow"
 *      template entry fails; an identical-allow collision is idempotent.
 *      Skipped when the template is unavailable — the core-count violation
 *      (check 8) already fails composition in that case.
 *
 * Runtime: Node 24, built-in modules only.
 */

const { CORE_AGENTS } = require("./template");

// ─── Pure helpers ───────────────────────────────────────────────────────────

function comparePaths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const SKILL_ENTRY_PATTERN = /^skills\/[^/]+\/SKILL\.md$/;
const AGENT_PATH_PREFIX = ".opencode/agents/";

// ─── Check 1: duplicate skill IDs ───────────────────────────────────────────

function findDuplicateSkillIds(models) {
  const violations = [];
  const ownerBySkill = new Map();
  for (const model of models) {
    const seenInPackage = new Set();
    for (const skill of model.skills) {
      if (seenInPackage.has(skill)) {
        violations.push(`duplicate skill ID "${skill}" in ${model.name} (skill IDs are globally unique per installation)`);
        continue;
      }
      seenInPackage.add(skill);
      const previousOwner = ownerBySkill.get(skill);
      if (previousOwner !== undefined) {
        violations.push(`duplicate skill ID "${skill}": owned by ${previousOwner} and ${model.name}`);
      } else {
        ownerBySkill.set(skill, model.name);
      }
    }
  }
  return violations;
}

// ─── Check 2: unresolved requires ───────────────────────────────────────────

function findUnresolvedRequires(models) {
  const violations = [];
  const names = new Set(models.map((model) => model.name));
  for (const model of models) {
    for (const entry of model.requires) {
      if (!names.has(entry)) {
        violations.push(`${model.name} requires "${entry}", which resolves to no discovered package`);
      }
    }
  }
  return violations;
}

// ─── Check 3: requires cycles ───────────────────────────────────────────────

/**
 * Depth-first cycle detection over resolvable requires edges (unresolvable
 * entries are check 2's findings and are excluded here so the two checks
 * stay orthogonal). Each cycle is reported once, as the path from its
 * first visited member back to itself.
 */
function findRequiresCycles(models) {
  const violations = [];
  const names = new Set(models.map((model) => model.name));
  const adjacency = new Map();
  for (const model of models) {
    adjacency.set(model.name, model.requires.filter((entry) => names.has(entry)).sort(comparePaths));
  }
  const state = new Map(); // "visiting" | "done"
  const stack = [];
  const visit = (name) => {
    state.set(name, "visiting");
    stack.push(name);
    for (const dependency of adjacency.get(name) ?? []) {
      const dependencyState = state.get(dependency);
      if (dependencyState === "visiting") {
        const cycle = [...stack.slice(stack.indexOf(dependency)), dependency];
        violations.push(`requires cycle: ${cycle.join(" -> ")}`);
      } else if (dependencyState === undefined) {
        visit(dependency);
      }
    }
    stack.pop();
    state.set(name, "done");
  };
  for (const model of models) {
    if (!state.has(model.name)) visit(model.name);
  }
  return violations;
}

// ─── Check 4: dependency-rule residue (core resolution) ─────────────────────

/**
 * The set-level form of dependency rule 1: a capability/workflow package
 * must require the DISCOVERED core package (by kind), not merely carry a
 * core-family-shaped entry. Skipped when the core count is not exactly one
 * — check 8 owns that violation.
 */
function findDependencyRuleResidue(models, coreName) {
  const violations = [];
  if (coreName === null) return violations;
  for (const model of models) {
    if (model.kind !== "capability" && model.kind !== "workflow") continue;
    if (!model.requires.includes(coreName)) {
      violations.push(`${model.name} (${model.kind}) must require the discovered core package "${coreName}" (dependency rule 1, set level)`);
    }
  }
  return violations;
}

// ─── Check 5: duplicate managed paths ───────────────────────────────────────

function findDuplicateManagedPaths(models) {
  const violations = [];
  const ownerByPath = new Map();
  for (const model of models) {
    for (const file of model.managedFiles) {
      if (SKILL_ENTRY_PATTERN.test(file.path)) continue; // skill-entry ownership is the skill-ID rule's domain
      const previousOwner = ownerByPath.get(file.consumerPath);
      if (previousOwner !== undefined) {
        violations.push(`duplicate managed path "${file.consumerPath}": owned by ${previousOwner} and ${model.name}`);
      } else {
        ownerByPath.set(file.consumerPath, model.name);
      }
    }
  }
  return violations;
}

// ─── Check 6: agent-path reservation ────────────────────────────────────────

function findAgentPathViolations(models) {
  const violations = [];
  for (const model of models) {
    if (model.kind === "core") continue; // agent paths are reserved to Core
    for (const file of model.managedFiles) {
      if (file.consumerPath.startsWith(AGENT_PATH_PREFIX)) {
        violations.push(`${model.name} declares managed path "${file.consumerPath}" under the reserved ${AGENT_PATH_PREFIX} prefix (agent paths are Core-owned)`);
      }
    }
  }
  return violations;
}

// ─── Check 7: seed collisions ───────────────────────────────────────────────

function findSeedCollisions(models) {
  const violations = [];
  const ownerByPath = new Map();
  for (const model of models) {
    for (const seed of model.seedFiles) {
      const previousOwner = ownerByPath.get(seed.consumerPath);
      if (previousOwner !== undefined) {
        violations.push(`duplicate seed path "${seed.consumerPath}": offered by ${previousOwner} and ${model.name}`);
      } else {
        ownerByPath.set(seed.consumerPath, model.name);
      }
    }
  }
  return violations;
}

// ─── Check 8: exactly one core ──────────────────────────────────────────────

function findCoreCountViolation(models) {
  const cores = models.filter((model) => model.kind === "core");
  if (cores.length === 0) {
    return ["no core-kind package in the discovered set (exactly one is required)"];
  }
  if (cores.length > 1) {
    return [`multiple core-kind packages: ${cores.map((model) => model.name).join(", ")} (exactly one is required)`];
  }
  return [];
}

// ─── Check 9: bash collisions ───────────────────────────────────────────────

function findBashCollisions(models, template) {
  if (template === null) return [];
  const violations = [];
  for (const model of models) {
    for (const pattern of model.bash) {
      for (const agentName of CORE_AGENTS) {
        const bashMap = template.agent?.[agentName]?.permission?.bash;
        if (!isPlainObject(bashMap) || !Object.prototype.hasOwnProperty.call(bashMap, pattern)) continue;
        if (bashMap[pattern] !== "allow") {
          violations.push(`${model.name} bash pattern "${pattern}" collides with agent "${agentName}"'s role-driven template entry (value ${JSON.stringify(bashMap[pattern])})`);
        }
      }
    }
  }
  return violations;
}

// ─── Entry point ────────────────────────────────────────────────────────────

/**
 * Run all nine set-level checks. Returns an array of violation strings;
 * empty means the set composes. `template` is the validated template
 * object, or null when the core count is wrong (check 9 then skips).
 */
function validateGraph(models, template) {
  const sorted = [...models].sort((a, b) => comparePaths(a.name, b.name));
  const cores = sorted.filter((model) => model.kind === "core");
  const coreName = cores.length === 1 ? cores[0].name : null;
  const violations = [];
  violations.push(...findDuplicateSkillIds(sorted));
  violations.push(...findUnresolvedRequires(sorted));
  violations.push(...findRequiresCycles(sorted));
  violations.push(...findDependencyRuleResidue(sorted, coreName));
  violations.push(...findDuplicateManagedPaths(sorted));
  violations.push(...findAgentPathViolations(sorted));
  violations.push(...findSeedCollisions(sorted));
  violations.push(...findCoreCountViolation(sorted));
  violations.push(...findBashCollisions(sorted, template ?? null));
  return violations;
}

module.exports = {
  validateGraph,
  findDuplicateSkillIds,
  findUnresolvedRequires,
  findRequiresCycles,
  findDependencyRuleResidue,
  findDuplicateManagedPaths,
  findAgentPathViolations,
  findSeedCollisions,
  findCoreCountViolation,
  findBashCollisions,
};

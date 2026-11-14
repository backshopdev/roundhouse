"use strict";

/**
 * template.js
 *
 * The Core template validation contract (SPEC-20261019-02, Public
 * contracts, Core template). The template lives in the core package as
 * content at `opencode-template.json` — a package-root file, sibling of
 * `roundhouse.json`. It is composer input, never managed content: it is
 * not copied into the consumer tree; the rendered `opencode.json` is.
 *
 * Six invariants, each failing closed with the invariant and the offending
 * agent or member named (the template family is owned here and nowhere
 * else, per the plan's ownership map):
 *
 *   1. It parses as JSON.
 *   2. The `agent` map carries exactly eight entries: the four Core agents
 *      (`orchestrator`, `document-author`, `implementor`, `reviewer`) and
 *      the four built-ins (`build`, `plan`, `general`, `explore`) each
 *      exactly `{ "disable": true }`.
 *   3. Each Core agent carries `mode`, its tuning member (`steps` for the
 *      orchestrator; `temperature` for each subagent, matching the shape
 *      authority), and a `permission` block.
 *   4. Each Core agent's `permission.skill` map is exactly `{ "*": "deny" }`
 *      — the deny-all wildcard and no allow entries. (The rendered map
 *      retains the wildcard first; that ordering is render.js's concern.)
 *   5. Each Core agent's `bash` member, when present, is a map — never a
 *      bare deny string. (Value types are not pinned here: the graph
 *      validator's collision check treats any non-"allow" template value
 *      as colliding, so unexpected values fail closed there.)
 *   6. `default_agent` is present and names one of the four Core agents.
 *
 * Pure validation only: reading the template file is the caller's I/O.
 * `validateTemplateSource` accepts the raw file text so invariant 1 (a
 * parse failure) is reported as a template violation; `validateTemplate`
 * accepts an already-parsed object for in-memory unit tests.
 *
 * Runtime: Node 24, built-in modules only.
 */

const CORE_AGENTS = Object.freeze(["orchestrator", "document-author", "implementor", "reviewer"]);
const BUILTIN_AGENTS = Object.freeze(["build", "plan", "general", "explore"]);
const ALL_AGENTS = Object.freeze([...CORE_AGENTS, ...BUILTIN_AGENTS]);

// ─── Value predicates ───────────────────────────────────────────────────────

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDisabledBuiltinEntry(value) {
  return isPlainObject(value) && Object.keys(value).length === 1 && value.disable === true;
}

// ─── Invariant checks ───────────────────────────────────────────────────────

function validateAgentMap(template, violations) {
  const agent = template.agent;
  if (!isPlainObject(agent)) {
    violations.push('template: the "agent" member must be a map (invariant 2)');
    return;
  }
  const keys = Object.keys(agent);
  const missing = ALL_AGENTS.filter((name) => !keys.includes(name));
  const unexpected = keys.filter((name) => !ALL_AGENTS.includes(name));
  if (missing.length > 0 || unexpected.length > 0) {
    const details = [
      missing.length > 0 ? `missing: ${missing.join(", ")}` : null,
      unexpected.length > 0 ? `unexpected: ${unexpected.join(", ")}` : null,
    ].filter(Boolean).join("; ");
    violations.push(`template: the agent map must carry exactly the four Core agents and the four built-ins (invariant 2; ${details})`);
  }
  for (const name of BUILTIN_AGENTS) {
    if (keys.includes(name) && !isDisabledBuiltinEntry(agent[name])) {
      violations.push(`template: built-in agent "${name}" must be exactly { "disable": true } (invariant 2)`);
    }
  }
}

function validateCoreAgent(name, agent, violations) {
  if (!isPlainObject(agent)) {
    violations.push(`template: agent "${name}" must be an object (invariant 3)`);
    return;
  }
  if (typeof agent.mode !== "string") {
    violations.push(`template: agent "${name}" must carry a "mode" string (invariant 3)`);
  }
  if (name === "orchestrator") {
    if (!Number.isInteger(agent.steps)) {
      violations.push(`template: agent "${name}" must carry an integer "steps" tuning member (invariant 3)`);
    }
  } else if (typeof agent.temperature !== "number" || Number.isNaN(agent.temperature)) {
    violations.push(`template: agent "${name}" must carry a numeric "temperature" tuning member (invariant 3)`);
  }
  if (!isPlainObject(agent.permission)) {
    violations.push(`template: agent "${name}" must carry a "permission" block (invariant 3)`);
    return;
  }
  const skill = agent.permission.skill;
  if (!isPlainObject(skill) || Object.keys(skill).length !== 1 || skill["*"] !== "deny") {
    violations.push(`template: agent "${name}" permission.skill must be exactly { "*": "deny" } (invariant 4)`);
  }
  if (Object.prototype.hasOwnProperty.call(agent.permission, "bash") && !isPlainObject(agent.permission.bash)) {
    violations.push(`template: agent "${name}" permission.bash must be a map, never a bare string (invariant 5)`);
  }
}

// ─── Entry points ───────────────────────────────────────────────────────────

/**
 * Validate a parsed template object. Returns an array of violation
 * strings; empty means valid.
 */
function validateTemplate(template) {
  const violations = [];
  if (!isPlainObject(template)) {
    violations.push("template: must be a JSON object");
    return violations;
  }
  validateAgentMap(template, violations);
  if (isPlainObject(template.agent)) {
    for (const name of CORE_AGENTS) {
      if (template.agent[name] !== undefined) validateCoreAgent(name, template.agent[name], violations);
    }
  }
  if (typeof template.default_agent !== "string" || !CORE_AGENTS.includes(template.default_agent)) {
    violations.push("template: default_agent must name one of the four Core agents (invariant 6)");
  }
  return violations;
}

/**
 * Validate raw template file text: invariant 1 (parses as JSON) first,
 * then the structural invariants on the parsed object.
 */
function validateTemplateSource(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    return [`template: does not parse as JSON: ${error.message} (invariant 1)`];
  }
  return validateTemplate(parsed);
}

module.exports = {
  CORE_AGENTS,
  BUILTIN_AGENTS,
  validateTemplate,
  validateTemplateSource,
};

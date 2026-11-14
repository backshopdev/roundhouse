"use strict";

/**
 * render.js
 *
 * The rendering model (SPEC-20261019-02, Public contracts, Rendered
 * opencode.json). The composer renders the template object and touches
 * exactly two things per Core agent — the skill map and the bash map;
 * everything else, template member order included, renders verbatim.
 *
 * Three layers:
 *   (a) The template's scaffolding verbatim: shell, agent blocks, tool
 *       permissions, and role-driven bash entries in template order.
 *   (b) Uniform skill maps: each Core agent's rendered permission.skill is
 *       the deny-all wildcard first, followed by the byte-wise-sorted union
 *       of all discovered packages' skills arrays, each with value "allow".
 *       The map is identical across the four agents (uniform availability:
 *       role boundaries are tool permissions and agent prompts, never skill
 *       availability).
 *   (c) The bash union block: the byte-wise-sorted union of all discovered
 *       packages' bash patterns, each with value "allow", excluding
 *       patterns already present in that agent's template map, appended
 *       contiguously last within the map — the distinguishability mechanism
 *       (contiguous, last, sorted, and verifiable from package
 *       declarations). An agent whose template declares no bash map renders
 *       the union block only.
 *
 * Per-agent exclusion is deliberate: the exclusion exists to avoid
 * re-declaring a pattern within one rendered map (a template entry stands
 * in the agent that declares it; a package pattern colliding with a
 * non-"allow" template entry has already failed composition in graph.js).
 * Excluding globally would break the uniform-bash consequence — every agent
 * that can load a skill needs the bash commands skills declare, so the
 * union reaches every agent except where that agent's own template already
 * carries the pattern.
 *
 * Canonical emission: the template's member order is preserved
 * (structuredClone preserves insertion order; assigning to existing keys
 * keeps their positions; a bash map added where the template had none is
 * appended last within the permission block), two-space indentation, LF
 * line endings, single trailing newline; UTF-8 without BOM is a property
 * of the write, not the string.
 *
 * Pure: the template arrives validated (template.js) and the model set
 * graph-validated (graph.js); this module re-validates nothing. Runtime:
 * Node 24, built-in modules only.
 */

const { CORE_AGENTS } = require("./template");

// ─── Pure helpers ───────────────────────────────────────────────────────────

function comparePaths(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortedUnique(values) {
  return [...new Set(values)].sort(comparePaths);
}

// ─── Union computation ──────────────────────────────────────────────────────

/**
 * The byte-wise-sorted union of all discovered packages' skills arrays.
 */
function computeSkillUnion(models) {
  return sortedUnique(models.flatMap((model) => model.skills));
}

/**
 * The byte-wise-sorted union of all discovered packages' bash patterns.
 */
function computeBashUnion(models) {
  return sortedUnique(models.flatMap((model) => model.bash));
}

// ─── Map rendering ──────────────────────────────────────────────────────────

function renderSkillMap(skillUnion) {
  const map = { "*": "deny" };
  for (const skill of skillUnion) map[skill] = "allow";
  return map;
}

/**
 * Role-driven entries verbatim in template order, then the union block
 * (sorted, excluding patterns the template map already declares). A
 * template agent with no bash map renders the union block only.
 */
function renderBashMap(templateBash, bashUnion) {
  const map = {};
  if (templateBash !== undefined) {
    for (const [pattern, value] of Object.entries(templateBash)) map[pattern] = value;
  }
  for (const pattern of bashUnion) {
    if (templateBash !== undefined && Object.prototype.hasOwnProperty.call(templateBash, pattern)) continue;
    map[pattern] = "allow";
  }
  return map;
}

// ─── Rendering ──────────────────────────────────────────────────────────────

/**
 * Render the composed opencode.json object from the validated template and
 * the graph-validated model set.
 */
function renderOpencode(template, models) {
  const rendered = structuredClone(template);
  const skillUnion = computeSkillUnion(models);
  const bashUnion = computeBashUnion(models);
  for (const agentName of CORE_AGENTS) {
    const agent = rendered.agent[agentName];
    agent.permission.skill = renderSkillMap(skillUnion);
    agent.permission.bash = renderBashMap(agent.permission.bash, bashUnion);
  }
  return rendered;
}

/**
 * Canonical serialization: two-space indent, LF line endings (JSON.stringify
 * emits \n), single trailing newline.
 */
function serializeRendered(rendered) {
  return `${JSON.stringify(rendered, null, 2)}\n`;
}

module.exports = {
  computeSkillUnion,
  computeBashUnion,
  renderOpencode,
  serializeRendered,
};

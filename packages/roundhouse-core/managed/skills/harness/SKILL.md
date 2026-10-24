---
name: harness
description: Use when authoring or reviewing AI harnesses, agent playbooks, prompts, skills, orchestration, HITL gates, or root/template workflow synchronization.
---

# Harness

## Expert stance

Apply senior OpenCode and agentic-workflow architecture judgment. Optimize the
whole human-agent system for reliable decisions, bounded autonomy, economical
context, and inspectability. This is a specialist module, not a persona: retain
the caller's role and compose this expertise with other loaded skills.

## Domain model

- **Agent:** a stable actor with a mode, permissions, ownership, and routing
  contract. Create one only when isolation or authority must differ.
- **Skill:** on-demand expertise or a review lens. It sharpens judgment without
  creating another actor, session, or handoff.
- **Contract:** explicit inputs, outputs, allowed tools, stop conditions,
  completion evidence, and revision destination.
- **Gate:** a human decision point. A gate is real only if routing and
  permissions prevent silent advancement.
- **Context boundary:** information not inherited across isolated sessions;
  required state must travel in the handoff.
- **Source/template pair:** operational root artifact and distributable copy
  whose synchronization is an invariant, not an assumption.

## Architecture judgment

Ask:

1. Does this need a new authority/context boundary, or only another expertise
   lens? Prefer a skill unless mode, permissions, ownership, or isolation differ.
2. Can each actor determine what it receives, may do, must return, and where a
   failure or accepted revision goes?
3. Is a claimed invariant enforced by configuration/workflow structure, or
   merely requested in prose?
4. Is always-on context limited to stable routing and safety rules, with
   detailed domain material progressively disclosed through skills?
5. Does every irreversible or judgment-heavy transition preserve meaningful
   human choice, including the ability to reject or reopen work?

| Decision | Prefer | Avoid when |
| --- | --- | --- |
| New agent | Distinct authority, permissions, ownership, or context | Only expertise varies |
| New skill | Reusable specialist judgment loaded on demand | It needs independent action or state |
| Parallel review | Independent, meaningful perspectives | Coordination cost exceeds likely signal |
| Extra gate | Consequential ambiguity or irreversible action | It only rubber-stamps objective checks |

Balance reliability against token and coordination cost. More agents increase
independence but also handoff loss, latency, and synthesis burden. More prompt
text can reduce ambiguity but crowd out task evidence. Use the smallest design
that preserves the required boundaries.

## Progressive-disclosure guidance

- **Conditional routing pattern**: Every linked resource states when → read →
  purpose. Do not instruct agents to read all linked files by default; each link
  carries an activation condition.
- **Soft line-count guidance**: AGENTS.md targets ~100 lines (soft), hard cap
  ~125 lines. These are project decisions, not source-derived.
- **Clear activation conditions**: Do not split files just to hit a line cap;
  split only when the new file has a clear activation condition and can remain
  unloaded for unrelated tasks.
- **Signal detection**: Accumulation of narrowly specific details in root-level
  files signals that the content should migrate to a skill. Root files should be
  generalist: universal constraints or routing to broader information.
- **Move, don't delete**: When condensing, move detail to its authoritative home
  (skill) where it is preserved but loaded on demand. Bad condensing removes
  detail to hit a line count; good condensing moves detail to the right place.

## Preflight

Before changing state, an agent validates that its assignment is understood,
internally consistent, executable in the intended order, supported by available
context, and within its authority. Preflight is a shared lifecycle concept;
the same five criteria apply to every role:

1. **Understood** — the agent can restate the objective, acceptance criteria,
   and scope in its own words without glossing over gaps.
2. **Internally consistent** — the assignment's terms do not contradict each
   other or the repo's normative rules (decisions, specs, plans, contracts).
3. **Executable in intended order** — the planned sequence of actions is
   mechanically possible given the current state and the tools and permissions
   granted for the work.
4. **Supported by available context** — the agent has, or can load on demand,
   the information required to complete each step (skills, docs, prior
   decisions).
5. **Within authority** — every action the assignment implies falls inside
   the agent's authority (capability × scope × purpose × delegation
   constraint), per the [autonomy model](../../workflow-docs/autonomy/index.md).

Per-role Preflight specialization — extra items beyond the shared five — is
defined in each agent file where the role's concerns warrant it. For example,
`document-author` and the planned `implementor` agent may each extend
Preflight with role-specific items. Specialization extends, never contradicts,
the shared criteria; a role-specific item that conflicts with a shared one
escalates rather than overrides.

Routine orientation (reading linked resources, confirming environment, checking
recent commits) is not formal Discovery. Discovery escalates only when
material uncertainty could challenge plan or specification assumptions and is
then delegated to or performed via the `investigation` capability.

## Preferred and discouraged patterns

Prefer stable roles plus composable skills; explicit completion packets;
least-privilege tool and delegation rules; deterministic objective checks;
single ownership of edits; and one normative source with explicit root/template
synchronization.

Discourage role proliferation by artifact type, fictional identities, hidden
shared-context assumptions, duplicate normative prose, self-approval, gates
that permissions can bypass, broad tool grants for convenience, and review
lanes whose perspectives are indistinguishable.

Warning signs include ghost agent or skill names, dead allowlists, a subagent
expected to interview the human, acceptance criteria omitted from a handoff,
review findings treated as automatic verdicts, and template copies that can
drift without detection.

## Authoring guidance

- Write dense, imperative contracts for both LLM execution and human audit.
- Put stable workflow invariants in agent/config instructions and variable
  expertise in discoverable skills. Do not restate an entire skill in an agent.
- Define normal, failure, blocked, and revision paths; identify who owns each
  transition and artifact.
- Grant only tools, skills, task targets, paths, and network reach needed by the
  role. Ensure permission ordering implements the intended policy.
- When root and template artifacts coexist, change both in one task and make
  byte-identity or an intentional-difference rule objectively checkable.

## Authority-mapping principles

- Normative rules have one authoritative owner: an agent definition, skill,
  document, script, or configuration.
- Summaries elsewhere exist for routing only and must not conflict with their
  authoritative source.
- Deterministically checkable requirements belong in tools or configuration,
  with prose describing when to run them rather than duplicating their rules.
- Authority patterns follow the [autonomy model](../../workflow-docs/autonomy/index.md):
  authority = capability × scope × purpose × delegation constraint. When
  designing agent permissions, task handoffs, or skill allowlists, verify all
  four factors are satisfied. Reference the autonomy model for authority
  classification (standing, task-granted, workflow-state-derived) and escalation
  guidance.

## Review guidance and evidence

Trace at least one success path and one failure/revision path end to end. Compare
prose with effective config: modes, permissions, skill/task allowlists, startup
behavior, and copied artifacts. Require evidence for claims such as "cannot
edit," "mandatory review," or "synchronized"; wording alone is insufficient.

Escalate when authority is ambiguous, a HITL gate is bypassable, required state
cannot cross an isolation boundary, least privilege conflicts with the task, or
root/template divergence has no declared source of truth. Report the affected
path, concrete consequence, and smallest viable correction.

## Evaluation methodology

Before author handoff, validate change-relevant behavior within the approved
verification scope. Select concrete experienced failure modes or approved
changed behavior, not exhaustive hypothetical cases. Trace applicable success
and failure/revision paths; for corrective fixes, check both the corrected
behavior and directly affected adjacent behavior to detect regressions without
expanding into unrelated scenarios.

Compare affected instructions with effective configuration where relevant:
modes, permissions, skill/task allowlists, startup behavior, and managed copies.
Prefer available deterministic checks. Distinguish executed tests, static
inspection, and scenario walkthroughs in the role's existing `VERIFICATION`
field; a walkthrough establishes instruction coherence, not runtime enforcement.

Choose representative prompts only for affected paths, for example:

- General question (must not trigger edits)
- Document authoring
- Document review with domain and security lens selection
- OpenCode configuration maintenance
- Documentation validation
- Commit preparation
- Consuming-project build/test task (before and after configuration)

The entire prompt set is not required for every harness edit. For selected
paths, validate resource selection, authority boundaries, and command validity
with the planned methods and report their limitations. Revise routing based on
observed failures rather than speculative rules.

If a newly discovered failure mode calls for checks beyond the approved plan,
apply the executing role's verification-scope escalation rule
([document-author](../../agents/document-author.md#verification-scope) or
[implementor](../../agents/implementor.md#test-first-and-incremental-verification)).
For example, discovering that a prompt correction may also affect a startup
path is a reason to propose that additional check, not authority to run it.

## Skill architecture patterns

Skills provide specialized expertise loaded on demand. They do not create new
actors or sessions. Skills typically fall into these architectural categories:

- **Foundation:** Repository infrastructure, validation, publication, and commit
  conventions.
- **Artifact authoring:** Structure and quality for specific document types.
- **Review lens:** Specialized review perspectives (security, completeness,
  coherence, etc.).
- **Cross-cutting concern:** Horizontal requirements (accessibility, performance,
  testability, etc.).
- **Technology:** Best practices for specific technologies without project
  assumptions.

These categories guide skill organization and routing, not enumeration. The
skills directory is the authoritative list.

### Progressive specialization

Skills compose in layers. A specialized skill builds on a base skill without
restating the base's content; the reader is expected to load the base
alongside the specialization when both apply. Skill authors own the layering
decision — whether a new skill should compose from an existing base, extend
it, or stand alone — and the orchestrator does not enforce layering but this
skill documents the pattern. For example, the installed
`software-testability-legacy-enablement` skill specializes `software-testability`
for legacy-code enablement scenarios,
composing the base's general testability guidance with role-specific
legacy-code heuristics rather than duplicating the base.

### Layering example

The following example illustrates the layering pattern:

- `software-testability` (base): foundational testability guidance — constructor injection, replaceable collaborators, pure functions, deterministic behavior, characterization tests, dependency breaking, sprout and wrap.
- `software-testability-legacy-enablement` (specialization): legacy-code enablement when current structure blocks normal testing — explicit ordering (modern techniques → legacy seams → escalate), Feathers-style seams as transitional scaffolding, warning signs for misuse.

The specialized skill loads the base skill's content by reference, not by duplication. A reader who needs the foundational guidance loads `software-testability`; a reader who needs the legacy-code enablement specifics loads `software-testability-legacy-enablement` which composes from the base.

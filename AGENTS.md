# Agentic Workflow Harness

## Core Philosophy

Human + agent collaboration produces a better whole. Agents augment rather
than replace human judgment; dialog surfaces assumptions, edge cases, and side
effects before implementation.

This repository is the operational harness for the current project. It defines
the stable roles, workflow, gates, and checks that govern human-agent
collaboration here.

## Universal Rules

These rules apply to all agents in all contexts:

1. **Human approval is mandatory before implementation or commit.** No stage
   advances without passing its gate. Questions and requests for advice do not
   authorize file changes.
2. **Human requests enter through the orchestrator.** The orchestrator is the
   primary human interface and never edits files directly.
3. **Never force-push, bypass hooks, use wrappers to evade permissions, or
   select persistent "always" approval.** Every git commit and push requires
   explicit human chat approval plus a fresh OpenCode `once` confirmation.
4. **Workflow resets after each commit.** The human may abandon work and restart
   at the planning phase at any time.
5. **Prefer deterministic checks over prose-based inspection.** Use tools and
   scripts to validate what can be validated objectively.

## Read on Demand

Load only the resources relevant to your current task. Do not read all linked
files by default.

| When | Read | Purpose |
| --- | --- | --- |
| Understanding the end-to-end workflow | [`AGENTIC_WORKFLOW.md`](AGENTIC_WORKFLOW.md) | Learn stable roles, the workflow, remediation flow, HITL gates, permission model, and key rules |
| Authoring or reviewing an artifact | Applicable domain skill | Load artifact-specific or review-lens procedures |
| Validating documentation | `docs-check` skill or document-author responsibilities | Run and interpret objective checks (markdown lint, JSON validation, link/index validation, frontmatter, secrets) |
| Preparing a commit | `commit-convention` skill | Apply the normative commit grammar and amendment rules |
| Changing OpenCode configuration | `opencode-configuration` skill | Apply configuration-specific guidance and validation |
| Conducting a review | `peer` skill (+ domain skill) | Apply the peer review lens and domain expertise |
| Changes affect permissions, secrets, or auth | `security` skill | Apply the security review threat model |
| Decomposing work into a plan | `backshopdev-planning` skill | Apply planning structure requirements and acceptance criteria |
| Working with testability, constructor injection, or characterization tests | `software-testability` skill | Load foundational testability guidance |
| Enabling tests on legacy code where current structure blocks normal testing | `software-testability-legacy-enablement` skill | Load legacy-code enablement techniques (Feathers-style seams) |
| Material uncertainty could change plan or spec assumptions | `investigation` skill | Apply the read-only investigation procedure for material uncertainty |
| Executing a commit, amend, or push | `git-commit` skill | Apply the canonical commit/amend/push procedure and exact-command contracts |
| Consolidating reviewer output into the final report | `review-findings` skill | Format consolidated review output using the mandatory template |
| Understanding authority and autonomy | [`packages/roundhouse-core/managed/workflow-docs/autonomy/index.md`](packages/roundhouse-core/managed/workflow-docs/autonomy/index.md) | Learn the autonomy model, authority types, escalation protocol, and session lifetime rules |

## Root Composition

The workspace packages under `packages/` are the authoritative source. Each
package carries its `roundhouse.json` envelope plus its `managed/` content
(the harness content composed into the consumer's `.opencode/`), and the Core
package additionally carries the `seed/` scaffolding and the
`opencode-template.json` the rendered `opencode.json` derives from.

The root is a self-hosting consumer. After changing any package's content,
recompose the root:

```bash
npm run sync-roundhouse -- --mode sync
```

The wrapper composes the root from the packages via the composer library
(init when no `.roundhouse/manifest.json` exists, compose thereafter). The
root `.opencode/` is the composer's managed output (gitignored, never edited
directly); the root `opencode.json` is the composed render and
`.roundhouse/manifest.json` is the composition record (both committed).
`--mode verify` checks the root read-only.

The seed files (`AGENTS.md`, `AGENTIC_WORKFLOW.md`, `README.md`, `BUILDING.md`,
`TESTING.md`, `docs/`, `ktlo/`, `scratch/README.md`) are consumer-owned once
created: the composer creates them only when missing and never overwrites
them — edit them directly.

## Authority and Autonomy

Agent authority is governed by the [autonomy model](packages/roundhouse-core/managed/workflow-docs/autonomy/index.md).
Authority = capability × scope × purpose × delegation constraint; all four
must be satisfied simultaneously. Technical enforcement lives in
`opencode.json`; normative guidance lives in the autonomy model. See
[AGENTIC_WORKFLOW.md](AGENTIC_WORKFLOW.md) for the detailed permission model.

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
| Understanding the end-to-end workflow | [`AGENTIC_WORKFLOW.md`](AGENTIC_WORKFLOW.md) | Learn stages, gates, roles, orchestration loop, and key rules |
| Authoring or reviewing an artifact | Applicable domain skill | Load artifact-specific or review-lens procedures |
| Validating documentation | `docs-check` skill or document-author responsibilities | Run and interpret objective checks (markdown lint, JSON validation, link/index validation, frontmatter, secrets) |
| Preparing a commit | `commit-convention` skill | Apply the normative commit grammar and amendment rules |
| Changing OpenCode configuration | `opencode-configuration` skill | Apply configuration-specific guidance and validation |
| Conducting a review | `peer` skill (+ domain skill) | Apply the peer review lens and domain expertise |
| Changes affect permissions, secrets, or auth | `security` skill | Apply the security review threat model |
| Decomposing work into a plan | `planning-structure` skill | Apply planning structure requirements and acceptance criteria |
| Working with testability, constructor injection, or characterization tests | `design-for-testability` skill | Load foundational testability guidance |
| Enabling tests on legacy code where current structure blocks normal testing | `test-enablement` skill | Load legacy-code enablement techniques (Feathers-style seams) |
| Understanding authority and autonomy | [`src/.opencode/workflow-docs/autonomy/index.md`](src/.opencode/workflow-docs/autonomy/index.md) | Learn the autonomy model, authority types, escalation protocol, and session lifetime rules |

## OpenCode Synchronization

Root `.opencode/` and `opencode.json` are deployed instances of `src/.opencode/`
and `src/opencode.json`. They are gitignored and never edited directly.

The sync runs in two modes that mirror the package's consumer-side `update()`
command:

- **Managed (Mode 1)**: `src/.opencode/` (and children) and `src/opencode.json`
  are always overwritten. Stale files in `.opencode/` are removed. The package
  is the source of truth here; consumer customization is not supported.
- **Seed (Mode 2)**: every other file under `src/` is copied to root only if
  the destination does not already exist. Once a seed file is present at root,
  it belongs to the consumer and is left alone on subsequent syncs. Typical
  seed files include `BUILDING.md`, `TESTING.md`, and `scratch/README.md`.

All changes to source files must be made in `src/` first, then synced to root:

```bash
npm run sync-roundhouse
```

The sync copies `src/.opencode/` over root `.opencode/` (overwriting stale
files) and copies any missing seed files from `src/` to root. Root-only
artifacts (`node_modules/`, `data/`, `package.json`, `package-lock.json`, `.gitignore`)
are preserved because the sync script's preserve list protects them; they
don't normally exist in `src/`.

`--verify-only` and `--verify` exit non-zero when either mode has drift,
listing the missing files. Run `npm run test-sync` to execute the automated
test suite for the sync script. It verifies sync correctness, root-only
artifact preservation, stale file removal, Mode 1 and Mode 2 seed-file
behavior, and `--verify` integrity checks (including discrepancy detection).

## Authority and Autonomy

Agent authority is governed by the [autonomy model](src/.opencode/workflow-docs/autonomy/index.md).
Authority = capability × scope × purpose × delegation constraint; all four
must be satisfied simultaneously. Technical enforcement lives in
`opencode.json`; normative guidance lives in the autonomy model. See
[AGENTIC_WORKFLOW.md](AGENTIC_WORKFLOW.md) for the detailed permission model.

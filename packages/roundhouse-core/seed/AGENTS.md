# Document-Authoring Workflow Template

A multi-agent workflow for OpenCode that guides AI agents through structured
document authoring, independent review, and publication.

## Quick Start

1. Start `opencode` and select `orchestrator`.
2. Describe the documentation goal.
3. The orchestrator conducts a Socratic interview and drafts an authoring brief.
4. Approve the plan (Gate 1).
5. The orchestrator delegates to `document-author`, `implementor`, and `reviewer`, loading the `investigation` skill when material uncertainty arises.
6. Inspect authored files and triage review findings.
7. Approve the commit message and confirm the commit.

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

## Composing your consumer

The Roundhouse packages are the workflow's authoritative source; your
consumer's `.opencode/` is the composer's managed output. After installing or
updating the packages, compose your consumer with the `roundhouse` CLI:

```bash
roundhouse init     # first composition: discovers the installed packages, validates them, and creates .opencode/, opencode.json, .roundhouse/manifest.json, and the missing seed files
roundhouse compose  # thereafter: updates managed content, removes stale managed files by recorded ownership, regenerates opencode.json, and creates newly applicable seeds
```

`roundhouse verify` checks your consumer read-only. The seed files (this
document included) are consumer-owned once created: the composer creates them
only when missing and never overwrites them — edit them directly. See
`AGENTIC_WORKFLOW.md` for the full composition contract.

## Read on Demand

Load only the resources relevant to your current task. Do not read all linked
files by default.

| When | Read | Purpose |
| --- | --- | --- |
| Understanding the end-to-end workflow | [`AGENTIC_WORKFLOW.md`](AGENTIC_WORKFLOW.md) | Learn agent roles, authoring and investigation workflows, remediation flow, routing table, HITL gates, and key rules; routing table directs to skills for document authority, validation, publication, and other detailed procedures |
| Authoring or reviewing an artifact | Applicable domain skill | Load artifact-specific or review-lens procedures |
| Validating documentation | `docs-check` skill or document-author responsibilities | Run and interpret objective checks (markdown lint, JSON validation, link/index validation, frontmatter, secrets) |
| Preparing a commit | `commit-convention` skill | Apply the normative commit grammar and amendment rules |
| Changing OpenCode configuration | `opencode-configuration` skill | Apply configuration-specific guidance and validation |
| Conducting a review | `peer` skill (+ domain skill) | Apply the peer review lens and domain expertise |
| Changes affect permissions, secrets, or auth | `security` skill | Apply the security review threat model |
| Decomposing work into a plan | the installed planning skill (discover via the skill listing; Core default `task-planning`) | Apply planning structure requirements and acceptance criteria |
| Working with testability — designing for test (constructor injection, characterization tests) or enabling tests on legacy code where current structure blocks normal testing | the installed testability skill (discover via the skill listing) | Load testability guidance: foundational testable-design techniques and legacy-code enablement (Feathers-style seams) |
| Material uncertainty could change plan or spec assumptions | `investigation` skill | Apply the read-only investigation procedure for material uncertainty |
| Executing a commit, amend, or push | `git-commit` skill | Apply the canonical commit/amend/push procedure and exact-command contracts |
| Consolidating reviewer output into the final report | `review-findings` skill | Format consolidated review output using the mandatory template |
| Building or running the project | [`BUILDING.md`](BUILDING.md) | Learn build prerequisites and commands |
| Running tests | [`TESTING.md`](TESTING.md) | Learn test commands and coverage expectations |

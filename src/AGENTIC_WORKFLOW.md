# Agentic Workflow — Detailed Mechanics

This document is the high-level workflow overview and routing surface for the
document-authoring workflow template. For a concise introduction, see
[AGENTS.md](AGENTS.md). For detailed procedures, load the relevant skill.

## Agent Roles

### 1. Orchestrator (primary)

The orchestrator is the only human-invokable agent. It conducts Socratic
interviews, drafts authoring briefs, delegates work to subagents, presents
review findings to the human, and manages the commit gate. It never edits files
directly. See `.opencode/agents/orchestrator.md` for the full protocol.

### 2. document-author (subagent)

The document-author agent implements the approved plan. It loads domain skills,
creates and edits documentation files, runs validation checks, and returns a
completion packet. It cannot delegate tasks. See
`.opencode/agents/document-author.md` for the full contract.

### 3. implementor (subagent)

The implementor agent implements executable software changes — code, tests,
configuration files — in an independent context. It loads implementation
expertise through skills, applies a test-first default for behavioral
changes, and returns a completion packet. It cannot delegate tasks. See
`.opencode/agents/implementor.md` for the full contract.

### 4. Reviewer (subagent)

The reviewer agent provides independent, read-only review. It loads `peer` plus
at least one relevant domain or lens skill, inspects the changed-file list and
acceptance criteria, and reports findings with severity, confidence, and
evidence. Multiple review sessions may run in parallel. See
`.opencode/agents/reviewer.md` for the invocation contract.

## Skill Architecture

Skills provide specialized expertise loaded on demand. They do not create new
actors or sessions. See the `harness` skill for skill categorization patterns.
The skills directory is the authoritative list of available skills.

## Authoring Workflow

The orchestrator conducts a Socratic interview to clarify goals, surface
assumptions, identify affected documents, determine document types, and
establish acceptance criteria. From the interview, it drafts an authoring
brief containing objective, scope, document types, acceptance criteria,
relevant skills, changed-file scope, and attention flags.

The document-author loads relevant skills, creates or modifies documents, runs
`docs-check` and `markdownlint`, and returns a completion packet.

The orchestrator launches parallel review sessions. Each session loads `peer`
plus relevant lens skills. Sessions report findings to the orchestrator, which
presents them to the human for triage. The human accepts, dismisses, or
requests changes. Accepted changes return to document-author. The plan remains
approved unless the human explicitly reopens it.

## Remediation Flow

When review surfaces issues that need remediation, the flow returns to
implementation and then back through both review stages. The human and agent
both validate that findings were remediated without introducing new issues.

### Path A — Human review finds issues

```text
human review [changes surfaced] → implementation → human review → agentic review → commit
```

### Path B — Agentic review finds issues (after human review was clean)

```text
human review [clean] → agentic review [changes surfaced] → implementation → human review → agentic review → commit
```

### Skipping workflow steps

The human may elect to skip a workflow step (e.g., agentic re-review after a
trivial fix). If the agent disagrees with that assessment, it should push back.
The human may override, but the agent's pushback is a valued input that signals
potential risk. The decision and reasoning should be noted in the conversation.

## Workflow Reset

After each commit, the workflow resets. The next changeset begins with dialog
and planning, not implementation. Every gate must be passed again, regardless
of how similar the work may seem to previous changesets. After a commit, you go
back to square one.

The human collaborator may choose to abandon work and restart at the planning
phase at any time. This decision is final and should be respected.

## Investigation Workflow

Material uncertainty that could expand, invalidate, or fundamentally alter the
approved plan or specification triggers formal Discovery. The agent that needs
the investigation (orchestrator during planning, `implementor` or
`document-author` during execution) loads the `investigation` skill within the
current session. The skill enforces read-only discipline (no file edits, no task
delegation, no webfetch, read-only git commands only) and returns a Discovery
Request containing Unknown, Why it matters, Potential impact on plan/spec
assumptions, and Proposed investigation. Findings return upstream for
reassessment and may reopen or revise the approved plan. Routine exploration
within approved assumptions does not require the skill.

## Root/Template Synchronization

Root `.opencode/` and `opencode.json` are deployed instances of `src/.opencode/` and `src/opencode.json`. The source of truth for agents, skills, workflow-docs, `docs-check.js`, and `opencode.json` is `src/`. Root `.opencode/` and root `opencode.json` are gitignored; never edit them directly.

After any change to `src/.opencode/` or `src/opencode.json`, sync to root:

```bash
npm run sync-roundhouse
```

The sync script (`scripts/sync-roundhouse.js`) is idempotent and platform-independent. Top-level files in `src/` (e.g., `AGENTS.md`, `AGENTIC_WORKFLOW.md`, `README.md`) are seeded to root on first install; once root copies exist they are consumer-owned. To re-sync a top-level file, edit root directly or delete the root file before re-running sync.

## Routing Table

Load the relevant resource based on your task:

| When | Load | Purpose |
| --- | --- | --- |
| Authoring or reviewing document structure, lifecycles, IDs, indexes, links, archives, specification behavior, or contracts | `repository-documentation` skill | Document structure and lifecycle rules |
| Running or interpreting documentation validation | `docs-check` skill | Validation script usage and checks |
| Publishing documentation to external surfaces | `docs-publish` skill | Publication workflow boundary |
| Drafting or reviewing a commit message | `commit-convention` skill | Commit grammar and approval |
| Decomposing work into a plan | `planning-structure` skill | Plan structure and acceptance criteria |
| Authoring or reviewing harness, agents, skills, or workflow | `harness` skill | Harness architecture and skill catalog |
| Authoring or reviewing OpenCode configuration | `opencode-configuration` skill | Configuration judgment and permission model |
| Conducting a review | `peer` skill (+ domain skill) | Peer review lens and heuristics |
| Changes affect permissions, secrets, or auth | `security` skill | Security review threat model |
| Authoring or reviewing literature notes | `literature-note` skill | Source note evidence judgment |

## HITL Gates

- **Gate 1:** Explicit human plan approval before substantive work.
- **Gate 2:** Human work approval before agent review. Commit only after every
  required perspective returns non-`BLOCKED`, no human-accepted finding remains
  unresolved, and the human approves the commit message.
- Any accepted change restarts human work approval and agent review.

### Re-review scope after accepted findings

When a re-review follows accepted findings, the reviewer covers the **full final state** of the changed files, not just the lines touched by the corrections. The justification: corrections can introduce collateral damage to surrounding context (e.g., a wording change that breaks a blockquote continuation, a link update that affects paragraph flow), so the prior review's verdict on unchanged parts is invalidated by any correction. The reviewer may attest that "carry-forward findings from the prior review still apply to the unchanged parts," but the verdict is on the *final state* as a unit.

### Two-turn separation of review and commit gates

A clean review verdict (or a verdict where all findings have been accepted or dismissed) is acknowledged in its own turn, before the commit message is drafted. The human's acknowledgment form is:

> [brief confirmation of review contents] The review came back clean. Shall we proceed to the commit gate?

The orchestrator only proceeds to `commit-convention` and message drafting in the *next* turn, after the acknowledgment. This separates two gates that are easy to conflate when presented together: "the work passed review" and "the commit message is approved."

## Key Rules

- No stage advances without passing checks.
- Only the orchestrator conducts human-facing Socratic interviewing.
- Every `git commit` and `git push` requires explicit human chat approval plus
  a fresh OpenCode `once` confirmation for the exact command.
- Never force-push, bypass hooks, use wrappers to evade permissions, or select
  persistent `always` approval.
- Durable artifacts live in `docs/` and `ktlo/`; review packets remain in
  context.
- Questions open dialog; only explicit commands authorize implementation.
- Keep models unpinned and permissions least-privileged.
- Restart OpenCode after config, agent, skill, or plugin changes.

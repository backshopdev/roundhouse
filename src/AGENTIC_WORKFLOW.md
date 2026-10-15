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
  unresolved, and the human gives a SINGLE combined chat approval that covers
  the staged changeset (empty index for message-only amend), the exact commit
  message, and the exact `npm run commit -- ...` command. There is no separate
  chat authorization for the command; the command still requires a fresh
  OpenCode `once` confirmation at execution.
- Any accepted change restarts human work approval and agent review.

### Re-review scope after accepted findings

When a re-review follows accepted findings, the reviewer covers the **full final state** of the changed files, not just the lines touched by the corrections. The justification: corrections can introduce collateral damage to surrounding context (e.g., a wording change that breaks a blockquote continuation, a link update that affects paragraph flow), so the prior review's verdict on unchanged parts is invalidated by any correction. The reviewer may attest that "carry-forward findings from the prior review still apply to the unchanged parts," but the verdict is on the *final state* as a unit.

### Combined approval at the commit gate

When the agentic review returns clean, the orchestrator presents a brief
summary of the results and asks whether it is okay to move to the commit gate.
After the human responds affirmatively, the orchestrator drafts the commit
message and presents a SINGLE combined chat message containing, in that order,
the actual staged changeset (or the empty index for message-only amend) and
the proposed exact commit message (or full file content for `--message-file`).
The human's combined approval of that message authorizes scope, the exact
message, and the exact `npm run commit -- ...` command — there is no separate
chat authorization for the command. The fresh OpenCode `once` confirmation at
execution is separate per-command technical enforcement, not a substitute for
the combined approval.

Before combined approval, `document-author` prepares only approved task content
and reports the actual staged changeset (empty index for message-only amend).
The orchestrator combines that changeset with the proposed exact commit
message in a SINGLE chat message; combined human approval authorizes scope,
the exact message, and the exact `npm run commit -- ...` command. Staging
itself needs no separate approval or permission gate unless the task
prohibits it; inspect the index first, use explicit paths, and stop on
unrelated staged content. Repository-wide `git add -A` requires all pending
content to be explicitly approved and in scope. Message-only amend skips
staging, requires an empty index immediately before execution, and verifies
tree preservation afterward. Content-changing amend requires explicit
approved/reviewed content scope and all normal work/review gates before the
combined approval covers the actual staged changeset and the exact amended
message.

## Key Rules

- No stage advances without passing checks.
- Only the orchestrator conducts human-facing Socratic interviewing.
- Every new commit and amend uses the supported `npm run commit -- ...`
  procedure; direct `git commit` and alternate `scripts/commit.js` invocation
  are forbidden. A SINGLE combined human chat approval covers the staged
  changeset (empty index for message-only amend), the exact message, and the
  exact `npm run commit -- ...` command — there is no separate chat
  authorization for the command. A fresh OpenCode `once` is also required at
  execution. This prescribed procedure is not a wrapper to evade permission
  matching. Push only the exact human-approved
  command or the approved remote, source ref, and destination ref, using an
  explicit command such as `git push <remote> <source>:<ref>`; never infer
  remote or refs from upstream. Each push requires separate explicit chat
  approval and a fresh `once` for that exact command. Configured remotes are
  ask-gated; `git branch -d/-D`, `git remote prune`, and push deletion/pruning
  forms remain ask-gated.
- Treat explicit chat approval as the human decision gate and `once` as
  per-command technical enforcement, not another decision. Do not ask the human
  afterward to remember or attest whether the prompt appeared. The exact
  command's tool execution result is the tool-side outcome; after successful
  execution, verify the resulting state through normal post-action checks. If
  a push result is unclear, first use `git status` to determine whether outgoing
  work remains; do not routinely inspect remote URLs. Use a read-only check of
  the exact approved remote/ref only if status cannot resolve the outcome,
  accounting for configured `pushurl` when required. Do not expose raw URLs or
  credentials. If checks establish success, do not retry. If they establish
  failure and the intended state was not created, report the evidence and get
  explicit chat approval plus a fresh `once` for the exact retry command. If
  still unresolved, report the checks and stop. Do not use a write operation
  such as `git fetch` as a probe. For unclear commit results, inspect status,
  history, the intended message, and commit tree; status alone may not prove
  whether a commit was created. If permission is denied or a command is not
  executed, report that outcome and wait for fresh chat approval and `once`
  before any retry. Never use arbitrary wrappers, auto-approval, persistent
  `always` approval, or an alternate command or path.
- Never force-push, bypass hooks, use wrappers to evade permissions, or select
  persistent `always` approval.
- `document-author` owns commit/amend/push execution; `implementor` has no Git
  write authority and must route those operations to `document-author`.
- Durable artifacts live in `docs/` and `ktlo/`; review packets remain in
  context.
- Questions open dialog; only explicit commands authorize implementation.
- Keep models unpinned and permissions least-privileged.
- Restart OpenCode after config, agent, skill, or plugin changes.

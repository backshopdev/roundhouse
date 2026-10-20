# Agentic Workflow — Detailed Mechanics

This document is the high-level workflow overview and routing surface for the
document-authoring workflow template. For a concise introduction, see
[AGENTS.md](AGENTS.md). For detailed procedures, load the relevant skill.

## Agent Roles

### 1. Orchestrator (primary, required entry point)

The orchestrator is the only human-invokable agent and the required entry
point. It runs Socratic planning, enforces both HITL gates, delegates work,
composes review perspectives from skills, consolidates findings, presents
review findings to the human, and manages commit approval. It never edits
files directly. See `.opencode/agents/orchestrator.md` for the full protocol.

### 2. document-author (subagent)

The document-author agent implements the approved plan in isolated context. It
loads relevant domain skills, creates and edits documentation files, owns the
explicit changed-file list, runs repo objective checks, and returns a completion
packet. It cannot delegate tasks. Accepted human/reviewer changes return here;
the plan stays approved unless the human explicitly reopens it. See
`.opencode/agents/document-author.md` for the full contract.

### 3. implementor (subagent)

The implementor agent implements executable software changes — code, tests,
configuration files — in an independent context. It loads implementation
expertise through skills, applies a test-first default for behavioral
changes, and returns a completion packet. It cannot delegate tasks. See
`.opencode/agents/implementor.md` for the full contract.

### 4. Reviewer (subagent)

The reviewer agent provides independent, read-only review. Every review launches
one or more independent review sessions in parallel, one session per meaningful
perspective. Every session loads mandatory `peer` plus at least one relevant
domain skill (for example, `harness` or `opencode-configuration`). Add `security` to that session if any listed change
affects permissions, secrets, auth, MCP, plugins, executable tools/commands,
network access, external directories, trust boundaries, or equivalent sensitive
configuration, regardless of the session's perspective. If no domain skill
applies, stop for a domain-skill gap; never run `peer` alone.

Sessions are read-only and receive the changed-file list, acceptance criteria,
author attention flags, and assigned skills explicitly. They report review
results and assumptions to the orchestrator and never interview the human. Each
session inspects the entire supplied changed-file list. See
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

### Consolidating findings and disputes

The orchestrator may merge mechanical duplicate findings but retains session
and skill provenance. Substantive disagreement is a **Debate** presented to the
human for authoritative triage; the orchestrator never resolves it alone or
rewrites an original reviewer verdict after triage.

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

## Composing your consumer

The Roundhouse packages are the workflow's authoritative source. Each package
carries its `roundhouse.json` envelope plus its `managed/` content (agents,
skills, workflow-docs, `docs-check.js`), and the Core package additionally
carries the `seed/` scaffolding and the `opencode-template.json` the rendered
`opencode.json` derives from.

After installing or updating the packages, compose your consumer with the
`roundhouse` CLI:

```bash
roundhouse init     # first composition: discovers the installed packages, validates them, and creates .opencode/, opencode.json, .roundhouse/manifest.json, and the missing seed files
roundhouse compose  # thereafter: updates managed content, removes stale managed files by recorded ownership, regenerates opencode.json, and creates newly applicable seeds
```

Your `.opencode/` is the composer's managed output (never edited directly);
`opencode.json` is the composed render and `.roundhouse/manifest.json` the
composition record. `roundhouse verify` checks your consumer read-only.

The seed files (`AGENTS.md`, `AGENTIC_WORKFLOW.md`, `README.md`, and the rest
of the Core seed set) are consumer-owned once created: the composer creates
them only when missing and never overwrites them — edit them directly.

## Objective Checks

The document-author runs checks; there is no separate verifier. This is a docs
and configuration repository: lint touched Markdown with
`npx --yes markdownlint-cli2@0.23.2`, validate JSON/JSONC and OpenCode schema
expectations, and check acceptance criteria, links/indexes, frontmatter,
whitespace, secrets, consumer composition (the composer's verify), and git
status. Code lint/test/build is `N/A`.

## Index and Link Discipline

Every `index.md` uses relative links and links every sibling Markdown file plus
each immediate child directory's `index.md`. It may link only to same-directory
Markdown or an immediate child's `index.md`; no deep or absolute links.

## Routing Table

Load the relevant resource based on your task:

| When | Load | Purpose |
| --- | --- | --- |
| Authoring or reviewing document structure, lifecycles, IDs, indexes, links, archives, specification behavior, or contracts | the installed documentation-practice skill (discover via the skill listing) | Document structure and lifecycle rules |
| Running or interpreting documentation validation | `docs-check` skill | Validation script usage and checks |
| Publishing documentation to external surfaces | the installed documentation-publishing skill (discover via the skill listing) | Publication workflow boundary |
| Drafting or reviewing a commit message | `commit-convention` skill | Commit grammar and approval |
| Decomposing work into a plan | the installed planning skill (discover via the skill listing; Core default `task-planning`) | Plan structure and acceptance criteria |
| Authoring or reviewing harness, agents, skills, or workflow | `harness` skill | Harness architecture and skill catalog |
| Authoring or reviewing OpenCode configuration | `opencode-configuration` skill | Configuration judgment and permission model |
| Conducting a review | `peer` skill (+ domain skill) | Peer review lens and heuristics |
| Changes affect permissions, secrets, or auth | `security` skill | Security review threat model |
| Authoring or reviewing literature notes | the installed source-note skill (discover via the skill listing) | Source note evidence judgment |

## HITL Gates

- **Gate 1 — plan approval:** obtain explicit human plan approval before
  substantive work unless executing an already-approved written plan in the
  repo.
- **Gate 2 — commit approval:** human work approval precedes agent review. A
  commit requires a non-`BLOCKED` packet from every required perspective, with
  blocked sessions corrected and rerun, and no unresolved human-accepted
  finding. Human approval is required at the commit gate; the exact approval
  contract (staged changeset, exact message, and exact
  `npm run commit -- ...` command) is defined in the `git-commit` skill. A
  fresh OpenCode `once` confirmation is required at execution. Human-dismissed
  findings do not block commit or require reviewers to change their original
  verdicts to `APPROVE`.
- Any accepted change restarts human work approval and agent review; re-plan
  only when the human reopens the plan.

### Re-review scope after accepted findings

When a re-review follows accepted findings, the reviewer covers the **full final state** of the changed files, not just the lines touched by the corrections. The justification: corrections can introduce collateral damage to surrounding context (e.g., a wording change that breaks a blockquote continuation, a link update that affects paragraph flow), so the prior review's verdict on unchanged parts is invalidated by any correction. The reviewer may attest that "carry-forward findings from the prior review still apply to the unchanged parts," but the verdict is on the *final state* as a unit.

### Approval at the commit gate

Human approval is required at the commit gate. The exact approval contract —
including how the staged changeset, exact message, and exact
`npm run commit -- ...` command are presented and authorized — is defined in
the `git-commit` skill. A fresh OpenCode `once` confirmation is required at
execution. Load that skill for the current authoritative procedure.

Before approval, `document-author` prepares only approved task content and
reports the actual staged changeset (empty index for message-only amend).
Staging itself needs no separate approval or permission gate unless the task
prohibits it; inspect the index first, use explicit paths, and stop on
unrelated staged content. Repository-wide `git add -A` requires all pending
content to be explicitly approved and in scope. Message-only amend skips
staging, requires an empty index immediately before execution, and verifies
tree preservation afterward. Content-changing amend requires explicit
approved/reviewed content scope and all normal work/review gates.

## Permission Model

Agent authority is defined by the
[autonomy model](.opencode/workflow-docs/autonomy/index.md). The autonomy
model provides normative guidance; `opencode.json` provides technical
enforcement. Both are authoritative; neither substitutes for the other.

### Authority types

Three authority types classify every action an agent can take:

- **Standing role authority:** Permissions inherent to the agent's role (read,
  search, routine operations). Stable and repeatable; no per-task approval
  needed.
- **Task-granted authority:** Authority conferred by an approved task handoff.
  Bounded by the objective; expires when the task is accepted, abandoned, or
  superseded.
- **Workflow-state-derived authority:** Authority that arises from approved
  workflow states (for example, git commit/push after full approval). Narrow
  and non-delegable.

All actions must satisfy the authority equation: capability × scope × purpose ×
delegation constraint.

### Friction reduction

- **Content search:** Content search is a routine read operation with no side
  effects; agents should reach for it freely.
- **Web fetch:** The orchestrator has free web fetch for planning and synthesis.
  Subagents are bounded by URLs listed in their task handoff; other URLs
  require human approval.
- **Git commit/amend/push:** Single-gate principle — one human gate (explicit
  chat authorization for the exact side effect). Human approval is required at
  the commit gate; the exact approval contract is defined in the `git-commit`
  skill. Push approval is separate. The OpenCode `once` confirmation is
  technical enforcement, not a substitute for chat authorization, and is
  required for the exact command. Do not ask the human afterward to remember or
  attest whether the prompt appeared. Treat the exact command's tool execution
  result as the tool-side outcome; after successful execution, verify the
  resulting state through normal post-action checks. If a push result is
  unclear, first use `git status` to determine whether outgoing work remains;
  do not routinely inspect remote URLs. If status cannot resolve the outcome,
  perform a read-only check of the exact approved remote/ref only when status
  cannot resolve it, accounting for configured `pushurl` when required. Do not
  expose raw URLs or credentials. If checks show success, do not retry. If
  they establish failure and the intended state was not created, report the
  evidence and get explicit chat approval plus a fresh `once` for the exact
  retry command. If still unresolved, report the checks and stop. Do not use a
  write operation such as `git fetch` as a probe. For an unclear commit result,
  inspect status, history, the intended message, and commit tree; status alone
  may not prove whether it was created. If permission is denied or the command
  is not executed, report that outcome and wait for fresh chat approval and
  `once` before any retry. Push approval is separate from commit approval.

## Key Rules

- No stage advances without passing checks; findings are inputs the human may
  dismiss.
- Only the orchestrator conducts human-facing Socratic interviewing.
- Every new commit and amend uses the supported `npm run commit -- ...`
  procedure; direct `git commit` and alternate `scripts/commit.js` invocation
  are forbidden. Human approval is required at the commit gate; the exact
  approval contract is defined in the `git-commit` skill. A fresh OpenCode
  `once` is required at execution. This prescribed procedure is not a wrapper
  to evade permission matching. Push only the exact human-approved
  command or the approved remote, source ref, and destination ref, using an
  explicit command such as `git push <remote> <source>:<ref>`; never infer
  remote or refs from upstream. Each push requires separate explicit chat
  approval and a fresh `once` for that exact command. Configured remotes are
  ask-gated; `git branch -d/-D`, `git remote prune`, and push deletion/pruning
  forms remain ask-gated. An amend additionally requires a fresh confirmation
  for its exact command and is allowed only while the commit is unpushed.
  Message-only amend skips staging, requires an empty index immediately before
  execution, and verifies tree preservation afterward. Content-changing amend
  requires explicit approved/reviewed content scope and all normal work/review
  gates; stop on unexpected staged content. Verify divergence and staged
  state before amend, then the resulting commit/message/tree and branch state
  after. Never force-push, bypass hooks, use arbitrary wrappers to evade
  permissions, use OpenCode `--auto`/auto-approve, or select persistent
  `always` approval. Correct an already-pushed commit with a new commit.
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
- Report the actual tool execution outcome and verify resulting state after
  successful execution. Do not ask the human to recall prompt history or
  infer that a `once` prompt was absent from a missing separate receipt. If
  permission is denied or the command is not executed, stop and report that
  outcome without an alternate command or path.
- Never force-push, bypass hooks, use wrappers to evade permissions, or select
  persistent `always` approval.
- `document-author` owns commit/amend/push execution; `implementor` has no Git
  write authority and must route those operations to `document-author`.
- Durable artifacts live in `docs/` and `ktlo/`; review packets remain in
  context.
- Questions open dialog; only explicit commands authorize implementation.
- Keep models unpinned and permissions least-privileged. OpenCode config-time
  changes require quitting and restarting OpenCode before they take effect.
- Restart OpenCode after config, agent, skill, or plugin changes.

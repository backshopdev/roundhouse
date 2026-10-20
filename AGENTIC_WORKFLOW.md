# Agentic Workflow — Detailed Mechanics

This document contains the complete workflow specification for the Agentic
Workflow harness. For a concise introduction, see [AGENTS.md](AGENTS.md).

## Stable Roles

### 1. Orchestrator (required entry point)

- `@orchestrator` is the primary human interface and never edits files.
- Runs Socratic planning, enforces both HITL gates, delegates work, composes
  review perspectives from skills, consolidates findings, and manages commit
  approval.

### 2. document-author

- `@document-author` implements the approved plan in isolated context.
- Loads relevant domain skills, owns the explicit changed-file list, runs repo
  objective checks, and returns a completion packet.
- Accepted human/reviewer changes return here; the plan stays approved unless
  the human explicitly reopens it.

### 3. Reviewer Agent

- Every review launches one or more independent `@reviewer` sessions in
  parallel, one session per meaningful perspective.
- Every session loads mandatory `peer` plus at least one relevant domain skill:
  `harness`, `docs-literature-note`, or `opencode-configuration`.
- Inspect each session's entire supplied changed-file list. Add `security` to
  that session if any listed change affects permissions, secrets, auth, MCP,
  plugins, executable tools/commands, network access, external directories,
  trust boundaries, or equivalent sensitive configuration, regardless of the
  session's perspective.
- If no domain skill applies, stop for a domain-skill gap; never run peer alone.
- Sessions are read-only and receive the changed-file list, acceptance criteria,
  author attention flags, and assigned skills explicitly. They report review
  results and assumptions to the orchestrator and never interview the human.

## Workflow

`@orchestrator` (plan + Gate 1) → `@document-author` (author + checks) → human
work approval → parallel `@reviewer` sessions → human triage → commit gate.

The orchestrator may merge mechanical duplicate findings but retains session
and skill provenance. Substantive disagreement is a **Debate** presented to the
human for authoritative triage; the orchestrator never resolves it alone or
rewrites an original reviewer verdict after triage.

## Workflow Reset

After each commit, the workflow resets. The next changeset begins with dialog and planning, not implementation. Every gate must be passed again, regardless of how similar the work may seem to previous changesets. After a commit, you go back to square one.

The human collaborator may choose to abandon work and restart at the planning phase at any time. This decision is final and should be respected.

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

## Objective Checks

The document-author runs checks; there is no separate verifier. This is a docs
and configuration repository: lint touched Markdown with
`npx --yes markdownlint-cli2@0.23.2`, validate JSON/JSONC and OpenCode schema expectations,
and check acceptance criteria, links/indexes, frontmatter, whitespace, secrets,
package/consumer composition (the composer's verify), and git status. Code
lint/test/build is `N/A`.

## Index and Link Discipline

Every `index.md` uses relative links and links every sibling Markdown file plus
each immediate child directory's `index.md`. It may link only to same-directory
Markdown or an immediate child's `index.md`; no deep or absolute links.

## Root Composition

The workspace packages under `packages/` are the authoritative source. Each
package carries its `roundhouse.json` envelope plus its `managed/` content
(agents, skills, workflow-docs, `docs-check.js` — composed into the consumer's
`.opencode/`), and the Core package additionally carries the `seed/`
scaffolding and the `opencode-template.json` the rendered `opencode.json`
derives from.

The root is a self-hosting consumer. After changing any package's content,
recompose the root:

```bash
npm run sync-roundhouse -- --mode sync
```

The wrapper (`scripts/sync-roundhouse.js`) composes the root from the packages
via the composer library: init when no `.roundhouse/manifest.json` exists,
compose thereafter — managed artifacts updated, stale managed files removed by
recorded ownership, `opencode.json` regenerated, newly applicable seeds created
only when missing, and the manifest refreshed. The root `.opencode/` is the
composer's managed output (gitignored; never edited directly); the root
`opencode.json` is the composed render and `.roundhouse/manifest.json` the
composition record (both committed). `--mode verify` checks the root read-only.

The seed files (`AGENTS.md`, `AGENTIC_WORKFLOW.md`, `README.md`, `docs/`,
`ktlo/`, and the rest of the Core seed set) are consumer-owned once created:
the composer creates them only when missing and never overwrites them — edit
them directly.

## HITL Gates

- **Gate 1 — plan approval:** obtain explicit human approval before substantive
  work unless executing an already-approved written plan in the repo.
- **Gate 2 — commit approval:** human work approval precedes agent review. A
  commit requires a non-`BLOCKED` packet from every required perspective, with
  blocked sessions corrected and rerun, and no unresolved human-accepted
  finding. Human approval is required at the commit gate; the exact approval
  contract (staged changeset, exact message, and exact
  `npm run commit -- ...` command) is defined in the `git-commit` skill. A
  fresh OpenCode `once` confirmation is required at execution. Human-
  dismissed findings do not block commit or require reviewers to change their
  original verdicts to `APPROVE`.
- Any accepted change request returns to document-author and restarts work
  approval/review. Re-plan only when the human reopens the plan.

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
[autonomy model](packages/roundhouse-core/managed/workflow-docs/autonomy/index.md). The autonomy
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
delegation constraint. See the
[autonomy principles](packages/roundhouse-core/managed/workflow-docs/autonomy/principles.md) for
the six fundamental invariants and the
[authority types reference](packages/roundhouse-core/managed/workflow-docs/autonomy/authority-types.md)
for the complete classification.

### Friction reduction

- **Content search:** Target state is `grep: allow` for all agents. Content
  search is a routine read operation with no side effects.
- **Web fetch:** Orchestrator has free web fetch for planning and synthesis.
  Subagents are bounded by URLs listed in their task handoff; other URLs
  require human approval.
- **Git commit/amend/push:** Single-gate principle — one human gate (explicit chat
  authorization for the exact side effect). Human approval is required at the
  commit gate; the exact approval contract is defined in the `git-commit`
  skill. Push approval is separate. The OpenCode `once` confirmation is
  technical enforcement, not a substitute for chat authorization, and is
  required for the exact command. Do not ask the human
  afterward to remember or attest whether the prompt appeared. Treat the exact
  command's tool execution result as the tool-side outcome; after successful
  execution, verify the resulting state through normal post-action checks. If
  a push result is unclear, first use `git status` to determine whether outgoing
  work remains; do not routinely inspect remote URLs. If status cannot resolve
  the outcome, perform a read-only check of the exact approved remote/ref,
  accounting for configured `pushurl` when required. Do not expose raw URLs or
  credentials. If checks show success, do not retry. If they establish failure
  and the intended state was not created, report the evidence and get explicit
  chat approval plus a fresh `once` for the exact retry command. If still
  unresolved, report the checks and stop. Do not use a write operation such as
  `git fetch` as a probe. For an unclear commit result, inspect status, history,
  the intended message and commit tree; status alone may not prove whether it
  was created. If permission is denied or the command is not executed, report
  that outcome and wait for fresh chat approval and `once` before any retry.
  Push approval is separate from commit approval.

### Bash permission patterns

Bash permission patterns in `opencode.json` use wildcards (for example,
`"git diff *"`). This assumes OpenCode either sanitizes shell metacharacters
(`&&`, `;`, `|`, `||`) before matching or uses `execFile` instead of a shell
interpreter, so that a wildcard match cannot be escaped into an unintended
command.

### Consuming repositories

For consuming repositories that add git write permissions, port the deny rules
from the production root `opencode.json` (force-push, `--no-verify`, persistent
`always` approval, and similar) before granting write authority. The workspace
packages own the managed configuration the composer materializes:
`document-author` uses the supported
`npm run commit -- ...` command with `ask`; staging via `git add` is `allow`
but bounded to approved task content; pushes to configured remotes are `ask`;
direct Git writes are denied for `implementor`. Destructive-operation denials
remain after the relevant grants.

## Key Rules

- No stage advances without passing; findings are inputs the human may dismiss.
- Only the orchestrator conducts human-facing Socratic interviewing.
- Every new commit and amend by document-author uses the supported
  `npm run commit -- ...` procedure; direct `git commit` and alternate
  `scripts/commit.js` invocation are forbidden. Human approval is required at
  the commit gate; the exact approval contract is defined in the `git-commit`
  skill. A fresh OpenCode `once` confirmation is required at execution. This
  prescribed procedure is not a wrapper to evade permission matching. Push
  only the exact human-approved command or the
  explicitly approved remote, source ref, and destination ref, with an explicit
  command such as `git push <remote> <source>:<ref>`; never infer a remote or
  ref from upstream. Push requires separate explicit chat approval and a fresh
  `once` for that exact command. Configured remotes are ask-gated;
  `git branch -d/-D`, `git remote prune`, and push deletion/pruning forms remain
  ask-gated. An amend additionally
  requires a fresh confirmation for its exact command and is allowed only while
  the commit is unpushed. Message-only amend skips staging, requires an empty
  index immediately before execution, and verifies tree preservation afterward.
  Content-changing amend requires explicit approved/reviewed content scope and
  all normal gates; stop on unexpected staged content. Verify divergence and
  staged state before amend, then the resulting commit/message/tree and branch
  state after. Never force-push, bypass hooks, use arbitrary wrappers to evade
  permissions, use OpenCode `--auto`/auto-approve, or select persistent
  `always` approval. Correct an already-pushed commit with a new commit.
- Report the actual tool execution outcome and verify resulting state after
  successful execution. Do not ask the human to recall prompt history or infer
  that a `once` prompt was absent from a missing separate receipt. If permission
  is denied or the command is not executed, stop and report that outcome without
  an alternate command or path.
- If a commit or push result is unclear, first perform read-only checks. For
  commit, inspect status, history, the intended message and commit tree; status
  alone may not prove whether it was created. For push, first use `git status`
  to determine whether outgoing work remains; do not routinely inspect remote
  URLs. If status cannot resolve the outcome, perform a read-only check of the
  exact approved remote/ref, accounting for configured `pushurl` when required.
  Do not expose raw URLs or credentials. Do not use a write operation such as
  `git fetch` as a probe. If checks show success, do not retry. If they establish
  failure and the intended state was not created, report the evidence and wait
  for explicit chat approval plus a fresh `once` for the exact retry command.
  If still unresolved, report the checks and stop without retrying or guessing.
- Persistent artifacts live in `docs/` and `ktlo/`; chat review packets are
  ephemeral.
- `document-author` owns commit/amend/push execution; `implementor` has no Git
  write authority and routes those operations to `document-author`.
- A question/opinion probe opens dialog, not file edits; implementation requires
  an explicit command.
- Do not pin models. OpenCode config-time changes require quitting and restarting
  OpenCode before they take effect.

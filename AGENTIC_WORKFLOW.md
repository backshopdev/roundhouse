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
  `harness`, `literature-note`, or `opencode-configuration`.
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
root/template synchronization, and git status. Code lint/test/build is `N/A`.

## Index and Link Discipline

Every `index.md` uses relative links and links every sibling Markdown file plus
each immediate child directory's `index.md`. It may link only to same-directory
Markdown or an immediate child's `index.md`; no deep or absolute links.

## Root/Template Synchronization

Root `.opencode/` and `opencode.json` are deployed instances of
`src/.opencode/` and `src/opencode.json`. The source of truth for agents,
skills, workflow-docs, `docs-check.js`, and `opencode.json` is `src/`. Root
`.opencode/` and root `opencode.json` are gitignored; never edit them directly.

After any change to `src/.opencode/` or `src/opencode.json`, sync to root:

```bash
npm run sync-roundhouse
```

The sync script (`scripts/sync-roundhouse.js`) copies `src/.opencode/` over root
`.opencode/` and `src/opencode.json` over root `opencode.json`, overwriting
stale files. Root-only artifacts (`node_modules/`, `data/`, `package.json`,
`.gitignore`) are preserved because they do not exist in `src/`. The script is
idempotent and platform-independent.

When a task changes both `src/` and root artifacts, change `src/` first, then
sync. The document-author must verify synchronization as part of objective
checks.

## HITL Gates

- **Gate 1 — plan approval:** obtain explicit human approval before substantive
  work unless executing an already-approved written plan in the repo.
- **Gate 2 — commit approval:** human work approval precedes agent review. A
  commit requires a non-`BLOCKED` packet from every required perspective, with
  blocked sessions corrected and rerun, and no unresolved human-accepted
  finding, followed by explicit human approval of the
  `commit-convention`-compliant message. Human-dismissed findings do not block
  commit or require reviewers to change their original verdicts to `APPROVE`.
- Any accepted change request returns to document-author and restarts work
  approval/review. Re-plan only when the human reopens the plan.

## Permission Model

Agent authority is defined by the
[autonomy model](src/.opencode/workflow-docs/autonomy/index.md). The autonomy
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
[autonomy principles](src/.opencode/workflow-docs/autonomy/principles.md) for
the six fundamental invariants and the
[authority types reference](src/.opencode/workflow-docs/autonomy/authority-types.md)
for the complete classification.

### Friction reduction

- **Content search:** Target state is `grep: allow` for all agents. Content
  search is a routine read operation with no side effects.
- **Web fetch:** Orchestrator has free web fetch for planning and synthesis.
  Subagents are bounded by URLs listed in their task handoff; other URLs
  require human approval.
- **Git operations:** Single-gate principle — one human gate (explicit chat
  approval). The OpenCode `once` confirmation is a technical safety mechanism,
  not a second gate.

### Bash permission patterns

Bash permission patterns in `opencode.json` use wildcards (for example,
`"git diff *"`). This assumes OpenCode either sanitizes shell metacharacters
(`&&`, `;`, `|`, `||`) before matching or uses `execFile` instead of a shell
interpreter, so that a wildcard match cannot be escaped into an unintended
command.

### Consuming repositories

For consuming repositories that add git write permissions, port the deny rules
from the production root `opencode.json` (force-push, `--no-verify`, persistent
`always` approval, and similar) before granting write authority. The template in
`src/` mirrors the root configuration structure and includes the same git write
authority (commit and push with `ask` permission) and deny rules for destructive
operations.

## Key Rules

- No stage advances without passing; findings are inputs the human may dismiss.
- Only the orchestrator conducts human-facing Socratic interviewing.
- Every `git commit` and `git push` by document-author requires explicit human
  chat approval plus a fresh OpenCode `once` confirmation for the exact command;
  commit-message approval precedes commit confirmation. An amend additionally
  requires a fresh confirmation for its exact command and is allowed only while
  the commit is unpushed. Message-only amend requires an empty index; staged
  content must pass human work approval and all required non-`BLOCKED` reviews,
  with no unresolved human-accepted finding. Verify divergence and staged state
  before amend, then the resulting commit/message/tree and branch state after.
  Never force-push, bypass hooks, use wrappers to evade permissions, use OpenCode
  `--auto`/auto-approve, or select persistent `always` approval. Correct an
  already-pushed commit with a new commit.
- Persistent artifacts live in `~/docs/`; chat review packets are ephemeral.
- A question/opinion probe opens dialog, not file edits; implementation requires
  an explicit command.
- Do not pin models. OpenCode config-time changes require quitting and restarting
  OpenCode before they take effect.

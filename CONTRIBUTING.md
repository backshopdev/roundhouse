# Contributing

This document defines how changes are made, reviewed, and committed in this repository.

This is a **populate-once** file for consuming repos: copy it in during setup,
set your tracker key format below, and leave the rest aligned with the shared
standard. The commit *grammar* itself is owned by the discoverable
`commit-convention` skill — this file points to it rather than restating every
rule.

## Human-in-the-loop (HITL) — hard gate on every commit

A changeset becomes commit-eligible only after the human approves the authored
work, every required review perspective returns a non-`BLOCKED` packet, and no
human-accepted finding remains unresolved. Correct and rerun blocked sessions;
they never satisfy a required perspective. Accepted changes return to document-author and
restart human work approval and review. Human-dismissed findings do not block a
commit or require reviewers to replace their original verdicts with `APPROVE`.

```text
[agent develops] → [human reviews] → [agents review] → [commit]
       ▲                │                  │
       └────────────────┴──────────────────┘  (any "request changes" restarts the loop)
```

- The **human reviews first** — a fast, cheap direction check ("is this the right thing?") before spending adversarial-review tokens.
- One or more independent **review sessions** run next, in parallel. Each
  receives the changed-file list and loads `peer` plus a domain skill; risk-sensitive
  work also loads `security`. The document-author has already reported objective
  checks. The human authoritatively triages findings and debates.
- Original reviewer verdicts and skill/session provenance remain part of the
  review record after human triage.
- Roles **overlap**: every reviewer — human or agent — brings its own strengths,
  so this is a dialog, not a rigid "human=fit / agents=quality" split.
- **Staging:** document-author may stage only approved task content without a
  separate staging approval or permission gate, unless the task prohibits it.
  Inspect the index first, use explicit paths, and stop on unrelated staged
  content. Use repository-wide `git add -A` only when all pending content is
  explicitly approved and in scope.
- **Commit message:** the orchestrator drafts it per the standard for human
  approval. Document-author may execute only the exact command containing the
  approved message.
- **Command enforcement:** human approval is required at the commit gate; the
  exact approval contract (staged changeset, exact message, and exact
  `npm run commit -- ...` command) is defined in the `git-commit` skill. A
  fresh OpenCode `once` confirmation is required at execution. Document-author
  must use `npm run commit -- ...` for every new commit and amend; direct
  `git commit` or alternate `scripts/commit.js` invocation is forbidden. This
  prescribed repository procedure is not a wrapper to evade permission
  matching. An amend
  is eligible only while the commit is unpushed. Before amend, verify
  branch/upstream divergence and staged-content state; afterward, verify the
  resulting commit, exact message, tree, and branch state before any push. A
  message-only amend skips staging, requires an empty index immediately before
  execution and the exact newly human-approved message, and verifies tree
  preservation afterward. Content-changing amend requires explicit approved
  content scope and all normal plan/work/review gates, including every required
  non-`BLOCKED` perspective and no unresolved human-accepted finding; stop on
  unexpected staged content and obtain approval of the actual staged changeset
  and the exact amended message.
  If the commit was pushed, use a new commit. Push only the exact human-approved
  command or approved remote, source ref, and destination ref with an explicit
  command such as `git push <remote> <source>:<ref>`; never infer remote or
  refs from upstream. Every push requires separate explicit
  chat approval and a fresh `once` for that exact command. Configured remotes
  are ask-gated; `git branch -d/-D`, `git remote prune`, and push deletion or
  pruning forms remain ask-gated. If a
  push outcome is unclear, first use `git status` to determine whether outgoing
  work remains; do not routinely inspect remote URLs. If status cannot resolve
  the outcome, perform a read-only check of the exact approved remote/ref,
  accounting for configured `pushurl` when required. Do not expose raw URLs or
  credentials. If checks show success, do not retry. If they establish failure
  and the intended state was not created, report the evidence and obtain
  explicit chat approval plus a fresh `once` for the exact retry command. If
  still unresolved, report the checks and stop. For an unclear commit outcome,
  inspect status, history, the intended message and commit tree; status alone
  may not prove creation. Do not use `git fetch` as a probe. Never force-push,
  bypass hooks, evade permissions through arbitrary wrappers or alternate
  paths, run this harness with `--auto`/auto-approve, or select persistent
  `always` approval. Read-only Git checks run without unnecessary prompts.

This is **Gate 2**. **Gate 1 — plan sign-off** sits upstream: unless an approved written plan already exists in the repo, the human signs off on the plan before work begins. See `AGENTS.md` for the full pipeline.

## Commit message standard

This repo uses **Conventional Commits** for every commit, written so its history can be consumed directly to generate release notes (agentic release tooling reads the log — the more consistent and user-facing the entries, the better the output).

The normative grammar lives in `.opencode/skills/commit-convention/SKILL.md`. In short:

```text
<type>(<scope>): <subject>            # imperative, ≤72 chars, no trailing period

<user-facing body>                    # why + what changed from the user's view;
                                      # for noteworthy changes, this is the release-note copy

Refs: #123                            # footer(s): GitHub issue key(s) if applicable
BREAKING CHANGE: <impact + migration> # only for breaking changes
```

- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Breaking changes:** append `!` after the type/scope (`feat(api)!:`) **and** add a `BREAKING CHANGE:` footer.
- **Issue footer:** use `Refs: #<n>` (comma-separate multiple: `Refs: #12, #34`) whenever a tracked issue exists; omit otherwise. This repo uses **GitHub**, so keys are `#<number>`.

### Examples

```text
feat(reviewer): add per-model score to consolidated review output

Reviewers now attach a 0-10 score to each finding, surfaced in the
consolidated report so humans can triage severity at a glance.

Refs: #41
```

```text
fix(orchestrator): stop advancing past a failed gate

A blocked review result could still let the session move forward.
Gate results are now enforced before any stage transition.

Refs: #57
```

```text
feat(session)!: replace flat history with per-session context files

Each session now persists to its own file to bound context growth.
Existing sessions must be re-opened to pick up the new layout.

BREAKING CHANGE: session history format changed; `scratch/sessions/*`
from prior versions are not auto-migrated.
```

## Pull request conventions

Pull requests sit on top of the commit standard, but they are addressed to
human reviewers, not to release-note tooling, so their shape differs.

### PR title

Write the title as an imperative sentence. Do **not** use a Conventional Commit
type prefix, scope, or trailing period — the commit subject already carries
that information, and PR titles read more clearly as plain descriptions of the
change.

The human example 'Create Spec for Human-Directed Branch and PR Workflow' was used for a real PR (see git history of this repo):

```text
Create Spec for Human-Directed Branch and PR Workflow
```

Do not use a commit subject as the PR title. The commit message standard (Conventional Commits style) is for commits only; PR titles use the imperative-sentence style defined in this section. For example, do not use:

```text
docs(spec): define human-directed branch and PR workflow
```

That style is reserved for commit subjects.

### Branch name

Branches use a predefined workstream prefix followed by a short kebab-case
description in ASCII:

- `feature/` — new functionality
- `bugfix/` — issue-driven fix; an optional `<issue-key>-` prefix is allowed
- `hotfix/` — urgent production fix
- `docs/` — documentation-only
- `chore/` — tooling and maintenance

Examples:

- `feature/review-depth-rules`
- `bugfix/1234-pr-template-renders-blank`
- `hotfix/2026-10-16-ci-token-leak`
- `docs/20261016-workflow-changes`

A branch is created for the work and must exist before its intended commits.
Abandoned branches are not auto-deleted; any cleanup requires explicit human
authorization.

### PR body

Use the two-section layout below, with the exact heading text and in this
order. There is no required third heading.

```markdown
## What is the purpose of this PR?

Paragraph(s) stating the actual intent and selected scope.

- Change-summary bullet describing an actual change
- ...

## Steps to validate

1. Concrete validation step a human reviewer can run or check.
```

The change-summary list under "What is the purpose of this PR?" is
recommended at 15 bullets or fewer describing actual changes; this is a
recommendation, not a hard cap, and consumers can configure a stricter
limit if they wish.

The body must accurately describe the actual selected scope and validation
status (executed, static walkthrough, or pending). Do not copy these
section headings as a substitute for substantive content, and do not claim
unexecuted checks as passed. Drafts may disclose unfinished work and
pending validation without implying completion.

Departures from this template — including an additional third heading or a
different structure — require explicit human approval before publication.

## Enforcement (current)

Documentation-only for now — no git hooks / no CI grammar gate. The human+agent HITL review is the enforcement mechanism, and agents drafting commits load the commit-convention skill. Automated enforcement can be layered later if drift appears.

## OpenCode plugin maintenance

To update the pinned OpenCode workflow plugin, approve a specific
version change, review that release's provenance and release notes, change only
the explicit version, then restart OpenCode and rerun config, agent, skill, and
workflow checks. A version pin improves repeatability; it is not an integrity
guarantee.

## Per-repo overrides (consume in your repo)
- **Tracker / key format:** GitHub (`#<number>`) by default. Swap the footer format if your tracker differs.
- **Extra types / scopes:** you may add repo-specific scopes; keep the base type set aligned with the source-of-truth skill.
- **PR conventions:** consumers may override the PR title, branch name, and PR body conventions above in this section to match their own policy.

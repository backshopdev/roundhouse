# Contributing

How changes are made, reviewed, and committed in this repository.

This is a **populate-once** file: copy it in during setup, set your tracker key format below, and keep it aligned with the shared standard. The commit *grammar* is owned by `.opencode/skills/commit-convention/SKILL.md` (source-of-truth, copied from the harness template) — this file references it rather than restating every rule.

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

- The **human reviews first** — a fast, cheap direction check before spending adversarial-review tokens.
- Independent **review sessions** run next, in parallel. Each receives the
  changed-file list and loads `peer` plus a domain skill; risk-sensitive work
  also loads `security`. The document-author has already reported objective checks.
- Roles **overlap**: each reviewer — human or agent — brings its own strengths;
  the human authoritatively triages findings and substantive debates.
- Original reviewer verdicts and skill/session provenance remain part of the
  review record after human triage.
- **Staging:** document-author may stage only approved task content without a
  separate staging approval or permission gate, unless the task prohibits it.
  Inspect the index first, use explicit paths, and stop on unrelated staged
  content. Use repository-wide `git add -A` only when all pending content is
  explicitly approved and in scope. The actual staged changeset (or empty
  index for message-only amend) is combined with the exact commit message in
  a SINGLE chat message; combined human approval covers scope, exact
  message, and the exact commit/amend command.
- **Commit message:** the orchestrator drafts it per the standard and combines
  it with the staged changeset in a SINGLE chat message to the human for
  approval. Document-author may execute only the exact command containing the
  approved message.
- **Command enforcement:** the human's combined approval of the staged
  changeset and the exact commit message also authorizes the exact
  `npm run commit -- ...` command — there is no separate chat authorization
  for the command. Document-author must use `npm run commit -- ...` for
  every new commit and amend; direct `git commit` or alternate
  `scripts/commit.js` invocation is forbidden. The exact command still
  requires a fresh OpenCode `once` confirmation at execution. This
  prescribed repository procedure is not a wrapper to evade permission
  matching. An amend
  is eligible only while the commit is unpushed. Before amend, verify
  branch/upstream divergence and staged-content state; afterward, verify the
  resulting commit, exact message, tree, and branch state before any push. A
  message-only amend skips staging, requires an empty index immediately before
  execution and the exact newly human-approved message (presented together
  with the empty index in the combined chat message), and verifies tree
  preservation afterward. Content-changing amend requires explicit approved
  content scope and all normal plan/work/review gates, including every required
  non-`BLOCKED` perspective and no unresolved human-accepted finding; stop on
  unexpected staged content and obtain combined approval of the actual staged
  changeset and the exact amended message.
  If the commit was pushed, use a new commit. Push only the exact human-approved
  command or approved remote, source ref, and destination ref with an explicit
  command such as `git push <remote> <source>:<ref>`; never infer remote or refs
  from upstream. Every push requires separate explicit
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

This is **Gate 2**. **Gate 1 — plan sign-off** sits upstream: unless an approved written plan already exists in the repo, the human signs off on the plan before work begins. See `AGENTS.md`.

## Commit message standard

**Conventional Commits** for every commit, written so history can be consumed directly to generate release notes. The normative grammar is in `.opencode/skills/commit-convention/SKILL.md`. Summary:

```text
<type>(<scope>): <subject>            # imperative, ≤72 chars, no trailing period

<user-facing body>                    # why + user-facing impact; release-note copy for noteworthy changes

Refs: #123                            # GitHub issue key(s) if applicable
BREAKING CHANGE: <impact + migration> # only for breaking changes
```
- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Breaking:** `!` after type/scope **and** a `BREAKING CHANGE:` footer.
- **Issue footer:** `Refs: #<n>` (comma-separate multiples). Default tracker **GitHub** → override below if yours differs.

## Enforcement (current)
Documentation-only — no git hooks / CI grammar gate. The HITL review + agents drafting from the skill are the enforcement. Add automated checks later if drift appears.

## Per-repo overrides (set for YOUR repo)
- **Tracker / key format:** GitHub (`#<number>`).
- **Extra scopes/types:** add repo-specific scopes as needed; keep the base type set aligned with the source-of-truth skill.

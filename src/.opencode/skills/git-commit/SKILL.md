---
name: git-commit
description: Use when staging approved content, validating changesets, or executing authorized commits and amends.
---

# Git Commit

## Purpose

Standardize bounded staging, commit preparation, and authorized execution for
document-author agents.

## When to Use

Load this skill for staging/commit preparation or authorized execution.
Preparation can start from unstaged approved content; it does not authorize a
commit. Staging approved task content needs no separate approval or permission
gate, unless the task explicitly prohibits staging.

## Required Inputs

- **Approved content scope**: Explicit content and expected files; "all changes"
  is valid only when all pending content is explicitly approved and in scope
- **Commit mode**: New commit, message-only amend, or content-changing amend
- **Execution only**: Human approval of the actual staged changeset (empty index
  for message-only amend) and exact message text
- **Push authorization**: "yes" or "no"
- **Execution only — commit authorization**: separate human chat authorization for the
  exact command, obtained after message approval and before delegation
- For an authorized push: the exact approved command, or the approved remote,
  source ref, and destination ref. Never infer a remote or ref from upstream.

## Procedure

### Pre-commit Validation

1. Inspect `git status`, the full working diff, the full cached diff, and
   `git log --oneline -10`. Identify unrelated work before changing the index.
   Stop on unexpected staged content; do not silently unstage it or assume a
   path match proves its content is approved.
2. If amend, verify safety:
   - Commit is unpushed: `git log --oneline @{u}..`
   - No divergence from upstream
   - If the branch has no upstream (`@{u}` is undefined), the commit is by
     definition unpushed — treat this as safe for amend and skip the
     divergence check.
3. Prepare according to mode:
   - **Message-only amend:** skip staging entirely. Require an empty index and
     record the current commit and tree (`git log -1 --format=%H:%T`). Leave
     unrelated unstaged work untouched.
   - **New commit / content-changing amend:** require explicit approved content
     scope, normal plan/work approval, every required non-`BLOCKED` review, and
     no unresolved human-accepted finding. Stage only that content using
     `git add -- <file1> <file2> ...` or `git add -A -- <approved-paths>`.
     Use repository-wide `git add -A` only when all pending content is
     explicitly approved and no unrelated work would enter the index. If a
     file mixes approved and unrelated edits, stop for scoped preparation;
     do not stage the entire file.
4. Inspect `git diff --cached --stat` and the full `git diff --cached`; compare
   paths and content with the approved scope. On any mismatch, STOP and report.
5. Return the actual staged changeset for human approval before exact-message
   approval and then separate exact-command authorization before delegation.
   Message-only amend reports the empty index instead. Do not execute while
   any of these approvals is missing.

### Commit Execution

- Immediately before execution, recheck status and the full cached diff. For
  message-only amend, require `git diff --cached --exit-code` to confirm an empty
  index and confirm the recorded pre-amend commit/tree is unchanged. For new
  commits and content-changing amends, require the index to match the exact
  human-approved staged content. Stop on unexpected staged content or changed
  scope; do not stage additional content after changeset approval.
- New commit: `npm run commit -- --subject "<subject>" --body "<body>"` (or `--body-file <path>` for long bodies) — or `--message-file <path>` when the full approved message is pre-composed
- Amend: `npm run commit -- --amend --subject "<subject>" --body "<body>"`
- `npm run commit -- ...` is the required supported procedure for every new
  commit and amend. Direct `git commit` invocation is forbidden. The exact
  message must be approved first, followed by separate explicit human
  authorization for the exact npm command before delegation; the exact command
  must also receive a fresh OpenCode `once` confirmation at execution. This
  prescribed repository procedure is not a wrapper to evade permission
  matching. Do not substitute arbitrary wrappers or alternate commands.
- When the approved message contains non-ASCII characters (em-dashes, smart
  quotes, accented names, arrows, etc.), use `--message-file <path>`. Inline
  `--subject`/`--body` arguments pass through the shell/npm/cmd.exe transport
  (`npm run commit -- --subject "…"`) before reaching the script's
  `process.argv`, and that transport is not covered by the script's byte-clean
  guarantee. `--body-file <path>` protects the body only: the body is decoded as
  UTF-8 and re-encoded (byte-exact for valid UTF-8 text), but the subject is
  always supplied as an inline argv argument, so `--body-file` does not protect
  it. Use `--message-file <path>` whenever *any* part of the message — including
  the subject — contains non-ASCII; `--message-file` is a pure byte
  pass-through.

#### File-backed message inputs

- For `--message-file`, present the complete file content and compare it with
  the exact human-approved message. Approval covers the full message, including
  subject, body, footers, and the exact text/bytes passed to the commit script.
- For `--body-file`, present and compare the complete body with the
  human-approved body. Present and obtain separate approval for the subject and
  every footer; body-file approval does not approve them.
- Immediately before invoking canonical `npm run commit -- ...`, re-read every
  message/body file and compare its content exactly with the approved
  bytes/text. Do not normalize encoding or newlines, or modify, move, or replace
  the file after approval or this verification.
- If content mismatches, is unapproved, or the file is sensitive or outside the
  approved scope, stop without invoking the commit command and obtain fresh
  message approval (and approval for a safe, in-scope file path when needed).
  Re-verify after approval; any later file change invalidates the verification.

#### Multi-line messages

Single-line commits are forbidden per commit-convention standards. The
commit-convention requires multi-line messages with a subject, body, and
footers.

`npm run commit` composes the subject, body, and footers into a single
multi-line message with byte-exact UTF-8, avoiding PowerShell encoding
corruption (per DEC-20260906-01).

`git commit -F -` (stdin) and raw `git commit -F <tmpfile>` from
PowerShell are **not** acceptable for agentic commits on this repo.

The `-m` form exists but is not recommended because it is not reliable
across all Windows shells.

### Post-commit Verification

1. Verify commit succeeded: `git log -1`
2. Verify exact message matches
   and the resulting tree matches the approved content. For message-only amend,
   compare `git log -1 --format=%T` with the recorded pre-amend tree; they must
   be identical. For either amend mode, verify branch/upstream state before push.
3. If push authorized: run only the exact human-approved command or the
   command matching the explicitly approved remote, source ref, and destination
   ref, such as `git push <remote> <source>:<ref>`. Push authorization is
   separate from message approval and commit execution authorization; never
   infer a remote or ref from upstream.
4. Verify local state with `git status`. If a push outcome is unclear, first use
   `git status` to determine whether outgoing work remains. Do not routinely
   inspect remote URLs. Only if status
   cannot resolve the outcome, perform a read-only check of the exact approved
   remote/ref, accounting for configured `pushurl` when required. Do not expose
   raw URLs or credentials. If status or the exact destination/ref check
   establishes success, do not retry. If it establishes failure and the
   intended state was not created, report the evidence and obtain explicit
   human chat approval plus a fresh `once` for the exact retry command. If still
   unresolved, report the checks and stop without retrying or guessing.

### Error Handling

- If any step fails, stop and report the exact error while preserving repository
  state. Never blind-retry or use an alternate command/path.
- If a commit or push command's outcome is unclear, use read-only Git checks
  before reporting ambiguity. For commit, inspect `git status`, local history,
  the intended message and commit tree; `git status` alone may not prove whether
  it was created. For push, first use `git status` to determine whether
  outgoing work remains; do not routinely inspect remote URLs. Only if status
  cannot resolve the outcome, perform a read-only check of the exact approved
  remote/ref, accounting for configured `pushurl` when required. Do not expose
  raw URLs or credentials. Never use `git fetch` as a write probe.
- If checks establish that the command failed and the intended state was not
  created, report the evidence and wait for explicit human chat approval before
  retrying. Each retry requires the exact approved command and a fresh OpenCode
  `once` confirmation. If checks show success, do not retry. If the state
  remains unresolvable, report the concrete checks and stop without retrying or
  guessing. Never ask the human to recall whether a permission prompt appeared.

## Completion Packet

```text
COMMIT EXECUTION PACKET
commit-hash: <hash>
commit-message: <exact message used>
files-committed:
  - <file1>
  - <file2>
push-status: <success|failed|not-attempted>
verification:
  - git status: <result>
  - git log: <result>
issues: <any problems encountered or "none">
```

## Constraints

- Never force-push
- Never use --no-verify or -n
- Never bypass hooks
- Always use exact human-approved message
- Use `npm run commit -- ...` for every new commit and amend; never invoke
  `git commit` directly
- Push only to the explicitly approved remote and ref, with separate human
  approval
- Always validate changeset before committing
- Always verify after committing

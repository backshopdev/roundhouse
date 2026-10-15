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
- New commit: `npm run commit -- --message-file <path>` (the supported
  transport for the full approved message)
- Amend: `npm run commit -- --amend --message-file <path>` (same supported
  transport for the full approved amended message)
- `npm run commit -- ...` is the required supported procedure for every new
  commit and amend. Direct `git commit` invocation is forbidden. The exact
  message must be approved first, followed by separate explicit human
  authorization for the exact npm command before delegation; the exact command
  must also receive a fresh OpenCode `once` confirmation at execution. This
  prescribed repository procedure is not a wrapper to evade permission
  matching. Do not substitute arbitrary wrappers or alternate commands.
- When the full approved message is in hand (subject, body, footers, and any
  blank-line separators), agents pass it via `--message-file <path>`. Do not
  split the approved message into separate `--subject` and `--body`
  transport arguments. The shell/npm/cmd.exe layer between the agent and
  `commit.js`'s `process.argv` is not covered by the script's byte-clean
  guarantee: inline args can be tokenized on whitespace, mangled by codepage
  rules, or — on Windows cmd.exe — split on newline characters that occur
  inside what is otherwise a single quoted argument. Only the file path
  travels through that layer with `--message-file`; the message bytes are
  read by `commit.js` via `fs.readFileSync` (Buffer), so the shell cannot
  alter them. `--body-file <path>` protects only the body; the subject is
  always supplied as an inline argv argument, so `--body-file` does not
  protect it. `--message-file` is therefore the only byte-safe form for the
  full approved message — not merely a workaround for non-ASCII inputs.
- **Walkthrough — new commit (mode b):** the agent writes the exact
  approved message bytes to a bounded temporary file (UTF-8, no BOM, no
  encoding conversion), then runs `npm run commit -- --message-file <path>
  [--amend]`. The path travels through the shell; the message bytes do not.
- **Walkthrough — amend (mode b):** the same path form, with `--amend`. The
  message-only amend case requires an empty index immediately before
  invocation; the content-changing amend case requires staged content
  matching the approved scope.

#### File-backed message inputs

- For `--message-file` (the universal supported form), present the complete
  file content and compare it with the exact human-approved message. Approval
  covers the full message — subject, body, footers, and the exact
  text/bytes passed to the commit script — and the file path.
- `--body-file` is only acceptable when the agent cannot compose a single
  full-message file in scope (for example, a configuration that supplies
  the subject as an inline argv for a workflow-specific reason). For
  `--body-file`, present and compare the complete body with the
  human-approved body; present and obtain separate approval for the subject
  and every footer; body-file approval does not approve them. The default
  and preferred path remains `--message-file`.
- Immediately before invoking canonical `npm run commit -- ...`, re-read every
  message/body file and compare its content exactly with the approved
  bytes/text. Do not normalize encoding or newlines, or modify, move, or replace
  the file after approval or this verification.
- If content mismatches, is unapproved, or the file is sensitive or outside the
  approved scope, stop without invoking the commit command and obtain fresh
  message approval (and approval for a safe, in-scope file path when needed).
  Re-verify after approval; any later file change invalidates the verification.
- The file path passed to `--message-file` is itself an inline argv argument
  and travels through the shell. It must be a safe, in-scope location (a
  bounded temp file under the OS temp directory or a path the human has
  explicitly approved). The file's *contents* are not subject to shell
  transport because `commit.js` reads them as a Buffer.

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

The procedural steps below illustrate how the contract in the next section
can be satisfied. The contract — not this procedure — is binding; an
equivalent permitted inspection that demonstrates the same outcome is
acceptable.

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

### Verification Contract

Every commit execution is bound by this contract. Each obligation names an
outcome the agent must demonstrate; it does not enumerate a specific
command. The agent selects an equivalent permitted inspection — one it can
perform within its authority — sufficient to demonstrate the outcome. Do
not move approval into the script: human approval of the staged changeset,
exact message text, and exact command remains separate from this contract
and precedes execution.

**Required outcomes before execution.** Before invoking `npm run commit`:

- The staged changeset matches the approved content scope (paths and
  bytes), or — for message-only amend — the index is empty.
- The approved message is unchanged since human approval: the
  `--message-file` content equals the approved bytes, or the inline argv
  form (only when used under the narrow exception above) equals the
  approved text. The file path is in scope and not sensitive.
- The repository state is suitable for the operation: for amend, the
  branch state matches the preconditions recorded in the pre-commit
  validation; for new commit, the staged content matches the approved
  scope with no extra unstaged or staged drift that should change the
  commit.

**Required outcomes after execution.** After the commit returns:

- A commit is recorded in local history corresponding to the staged state
  captured before execution, or — for message-only amend — to the recorded
  pre-amend tree.
- The committed message bytes match the approved message modulo git's
  trailing-newline normalization. Any byte difference beyond that
  normalization is a fatal mismatch (the script's exit 6 path is one such
  signal).
- Local state is consistent with no unintended side effects: no extra files
  in the index, no spurious unstaged churn introduced by the commit, and
  branch/upstream state as expected.
- For push (when separately authorized): the push produced the
  human-approved remote/ref state, and local history is consistent with the
  remote ref.

**Sufficient evidence per obligation.** An inspection satisfies an
obligation when the resulting evidence is complete and unambiguous for
that obligation: a reader can audit whether the outcome holds without
relying on prose summary. The procedural steps above name specific
inspections that demonstrate sufficiency for each obligation; the agent
may substitute any equivalent permitted inspection that produces
equivalent evidence. Inspections must be read-only or part of an approved
command. Evidence lighter than the obligation requires (for example, a
status-level summary when the obligation is byte-level) does not satisfy
the obligation.

**Escalation boundaries.** Stop and escalate when any of the following
arises; do not relax the contract to fit available tooling:

- **New authority or broader scope.** Satisfying an obligation would
  require a command, tool, or scope not covered by the approved plan or
  this contract (for example, a write the role does not have, or a
  network reach the task does not authorize). Do not invent a new
  command; ask the human or the orchestrator.
- **Materially different cost/risk.** The available inspection would
  carry materially different cost or risk than the obligation assumes
  (for example, fetching from a remote, mutating unrelated paths, or
  performing a destructive operation). A lighter inspection is not a
  substitute when the obligation names heavier evidence.
- **Changed evidence standard.** Relaxing the comparison the obligation
  names (for example, accepting trailing-newline-equivalent for a
  byte-exact obligation, or accepting "looks right" for a byte-diff
  obligation) escalates; do not weaken comparison to fit available
  tooling.
- **Denied inspection.** A denied inspection does not justify a weaker
  inspection. If no permitted inspection can demonstrate the obligation,
  stop and escalate.

**Walkthroughs.** The following illustrate the contract:

- *Normal commit.* The agent's pre-execution evidence shows: staged
  content matches the approved scope, the message file equals the
  approved bytes, and the index has no drift. Post-execution: `git log
  -1` shows the new commit at HEAD with the expected tree, and the
  committed message matches the approved message modulo
  trailing-newline normalization.
- *Equivalent inspection.* The agent needs to demonstrate "no divergence
  from upstream before amend" and chooses `git log --oneline @{u}..`
  rather than an explicit divergence query. The outcome (no unpushed
  commits) is the same, and the evidence is sufficient; no escalation.
- *Denied inspection that escalates.* The agent needs to demonstrate
  "remote ref state" but the role's permissions deny remote read
  inspection. The agent stops and escalates; it does not accept
  "no remote read was performed" as equivalent evidence.
- *Post-commit message mismatch.* The agent reads
  `git log -1 --format=%B` and observes a byte difference beyond
  trailing-newline tolerance. The agent reports the diff detail and
  stops; the script's exit 6 path is one such signal, and a chat-level
  "looks fine" assertion does not bypass the byte-level obligation.

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

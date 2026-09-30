---
name: git-commit
description: Use when executing git commits with human-approved messages and validating changesets.
---

# Git Commit

## Purpose

Standardize commit execution for document-author agents.

## When to Use

Load this skill when the orchestrator delegates a commit task with:

- An exact commit message (human-approved)
- A list of expected files in the changeset (or "all changes")
- Commit type: new commit or amend
- Push authorization: yes/no

## Required Inputs

- **Commit message**: Exact message text (human-approved)
- **Expected files**: List of files that should be in the changeset, or "all changes"
- **Commit type**: "new" or "amend"
- **Push authorization**: "yes" or "no"

## Procedure

### Pre-commit Validation

1. Check working tree state: `git status`
2. If amend, verify safety:
   - Commit is unpushed: `git log --oneline @{u}..`
   - No divergence from upstream
   - If the branch has no upstream (`@{u}` is undefined), the commit is by
     definition unpushed — treat this as safe for amend and skip the
     divergence check.
3. Stage files:
   - If specific files: `git add <file1> <file2> ...`
   - If all changes: `git add -A`
4. Validate changeset: `git diff --cached --stat`
5. Compare with expected files list
6. If mismatch, STOP and report

### Commit Execution

- New commit: `git commit -F -` (pipe message via stdin) OR `git commit -F <unique-tmpfile>`
- Amend: `git commit --amend -F -` (pipe message via stdin) OR `git commit --amend -F <unique-tmpfile>`
- Obtain fresh OpenCode `once` confirmation for the exact command

#### Multi-line messages

Single-line commits are forbidden per commit-convention standards. The
commit-convention requires multi-line messages with a subject, body, and
footers.

**Preferred: pipe via stdin.** Use `git commit -F -` and provide the
message via stdin (e.g., PowerShell here-string, `echo` with proper
escaping, or a shell heredoc). This avoids temp file collisions across
sessions.

**Alternative: unique temp file path.** If stdin piping is not feasible,
write the message to a temp file with a unique name (e.g., include the
PID or a timestamp: `commit-msg-<pid>-<timestamp>.txt`). Never reuse a
shared temp file path across sessions — stale content from a previous
session can contaminate the commit.

The `-m` form exists but is not recommended because it is not reliable
across all Windows shells.

### Post-commit Verification

1. Verify commit succeeded: `git log -1`
2. Verify exact message matches
3. If push authorized: `git push`
4. Verify push succeeded: `git status`

### Error Handling

- If any step fails, STOP immediately
- Report the failure with exact error message
- Do not attempt recovery or retry
- Preserve repository state

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
- Always validate changeset before committing
- Always verify after committing

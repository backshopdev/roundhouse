---
name: commit-convention
description: Use when drafting or reviewing a commit message for Conventional Commits grammar, release-note quality, issue footers, and human approval.
---

# Commit Convention

Use `<type>(<scope>): <imperative subject>` with a subject no longer than 72
characters and no trailing period. Allowed base types: `feat`, `fix`, `docs`,
`style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`.

Add a body for user-facing or breaking changes; write why and impact as usable
release-note copy rather than narrating the diff. Use the repository's tracker
footer convention (`Refs: #<number>` here) when an issue exists.

Breaking changes require both `!` after type/scope and a `BREAKING CHANGE:`
footer describing impact and migration; use neither for non-breaking work.

Before commit, verify grammar, type/scope, subject, body, breaking markers, and
footers against `CONTRIBUTING.md`, then obtain explicit human message approval.

## Amendments

Amend only the current unpushed commit. Before amend, verify branch/upstream
divergence and staged-content state; if `HEAD` is already pushed or its state is
uncertain, make a new commit instead. Force-push remains prohibited.

A message-only amend requires an empty index and the exact newly human-approved
message. If staged content would enter the amended commit, that content must
first pass human work approval and every required non-`BLOCKED` agentic review
perspective, with no unresolved human-accepted finding. The exact amended
message must also be approved. Every amend requires a fresh OpenCode `once`
confirmation for its exact command; never use `--no-verify`, `-n`, auto mode,
persistent `always` approval, or a wrapper/configuration override to bypass it.
After amend, verify the resulting commit, exact message, tree, and branch state
before any separately approved push.

## Required Footers

Every commit message must include these footers after the body:

```text
review-skills: <comma-delimited list of review skills invoked>
agents: <comma-delimited list of agent roles used>
models: <comma-delimited list of agent=model pairs>
```

Example:

```text
feat(skills): add git-commit skill

Standardizes commit execution across workflows.

review-skills: peer, harness
agents: orchestrator, document-author, review
models: orchestrator=opencode-go\qwen3.7-plus, document-author=opencode-go\qwen3.7-plus, review=opencode-go\qwen3.7-plus
```

The orchestrator is responsible for tracking and including this information when
drafting commit messages.

# Escalation Protocol

Defines how agents request authority when the approved task requires an action
outside their current grant. Preserves structure, prevents paraphrase loss, and
ensures the human receives complete context for decision-making.

## When to escalate

Escalate when **all** of the following are true:

1. The action is necessary to complete the approved objective.
2. The action falls outside current standing, task-granted, or workflow-state
   authority.
3. No narrower interpretation of the objective avoids the need for this action.

### Decision rule: escalation vs. soft revocation

If the agent can formulate a specific authority request with bounded scope, use
this escalation protocol. If the agent cannot determine what authority is needed
or the situation requires immediate cessation of the in-flight action, use soft
revocation (see [Session Lifetime](./session-lifetime.md)).

Do **not** escalate when:

- The action is routine (see [Authority Types](./authority-types.md)).
- A narrower interpretation of the objective achieves the same result.
- The action is prohibited by security boundaries (these are non-negotiable;
  escalate the objective ambiguity instead).

## Structured request format

Every authority request must include all four fields. Do not omit or combine
fields. Preserve the structure exactly; the orchestrator and human rely on
consistent formatting for rapid evaluation.

```text
AUTHORITY REQUEST

Requested authority: <what capability or access is needed>
  - Be specific: "edit file X" not "modify files"
  - Name the permission: "bash: git commit" not "git operations"

Scope: <what resources or actions are covered>
  - File paths, module names, or operation patterns
  - Bounded and explicit: "src/.opencode/workflow-docs/autonomy/*.md" not "documentation"

Reason: <why this is necessary for the approved objective>
  - Reference the specific task or plan element
  - Explain why standing authority is insufficient

Impact if denied: <what happens without this authority>
  - "blocked" — cannot proceed at all
  - "partially completable" — can complete X but not Y
  - "alternative available" — can achieve objective via different path Z
```

### Example

```text
AUTHORITY REQUEST

Requested authority: edit
  - File: docs/index.md

Scope: Add one link to src/.opencode/workflow-docs/autonomy/index.md

Reason: WP-02 creates src/.opencode/workflow-docs/autonomy/ directory;
  docs/index.md must link to src/.opencode/workflow-docs/autonomy/index.md
  per index discipline rules (GP02, repository-documentation skill)

Impact if denied: partially completable — autonomy documents created but
  docs/index.md not updated, violating index completeness requirement
```

**Note:** This is a hypothetical example; the actual link may or may not exist
depending on current index state.

## Decision tree

```text
Authority request received
  │
  ├─ Action is routine operation?
  │   └─ YES → Grant under standing role authority. No escalation needed.
  │
  ├─ Action falls within task-granted authority?
  │   └─ YES → Proceed. Verify scope and purpose constraints.
  │
  ├─ Action falls within workflow-state authority?
  │   └─ YES → Proceed. Verify workflow state prerequisites.
  │
  ├─ Action prohibited by security boundary?
  │   └─ YES → STOP. Do not request authority for prohibited actions.
  │            Escalate objective ambiguity instead (I5).
  │
  └─ Action requires new authority grant
      │
      ├─ Can objective be achieved with narrower interpretation?
      │   └─ YES → Proceed with narrower interpretation. Document decision.
      │
      └─ NO → Escalate to human via orchestrator
          │
          ├─ Human grants authority
          │   └─ Proceed. Record grant in completion packet.
          │
          ├─ Human denies authority
          │   └─ Stop. Adjust approach or report blocked status.
          │
          └─ Human requests clarification
              └─ Provide additional context. Re-submit request.
```

## Upward communication rules

### Preserve structure

When an agent escalates a request upward (e.g., document-author → orchestrator
→ human), preserve the exact structure of the request. Do not paraphrase,
summarize, or reinterpret. The human must see the original request in full.

### Maintain provenance

Every escalation carries its origin:

- Who requested the authority (agent role)
- What task or objective triggered the request
- What the requesting agent's assessment is (if any)

The orchestrator may add context or recommendation but must not alter the
original request structure.

### No silent resolution

If an authority request is denied, the denial is explicit. Do not proceed with
a workaround that effectively grants the denied authority through a different
path. If the denial reveals objective ambiguity, escalate the ambiguity (I5).

## Approval patterns

When an agent receives human chat approval for a persistent side effect (commit,
push, tag, etc.), the approval must unambiguously reference the specific action.
Exact verbatim wording is not required; natural-language approval is acceptable
as long as the action is clearly identified.

### Principle

Approval is valid when:

1. The message clearly references the specific action being approved (e.g.,
   "push the tag", "commit the README fix", "approve the push").
2. The message is unambiguous in intent (e.g., "approved", "proceed", "go",
   "lgtm", "ship it").
3. The action being approved matches the action the agent is about to execute.

### Acceptable patterns

- "approved"
- "proceed"
- "go"
- "lgtm"
- "ship it"
- "yes, push it"
- "do it"
- "approved — push the v0.6.0 tag"

Standalone tokens like "approved" or "proceed" are valid when they follow a
specific agent request that names the action being approved. The
conversational context provides the action reference; the token provides the
unambiguous intent.

### Rejectable patterns

- "ok" (too vague — does not reference the action)
- "thanks" (not an approval)
- "👍" (emoji-only, no semantic content)
- "looks good" (approves the work, not the specific action)
- Any message that does not reference the specific action

### Agent behavior

When an agent receives a message that could be interpreted as approval:

1. Verify the message references the specific action.
2. If unambiguous, proceed with the action.
3. If ambiguous, ask for clarification before proceeding.
4. Never assume approval from a vague message.

## Escalate vs. narrower interpretation

### When to escalate

- The action is strictly necessary; no alternative path exists.
- The objective is ambiguous about whether this action is required.
- The action has significant side effects (external writes, dependency changes,
  broad rewrites).
- The requesting agent is uncertain about scope boundaries.

### When to proceed with narrower interpretation

- A reasonable interpretation of the objective avoids the need for this action.
- The narrower path achieves the same functional result.
- The action is convenient but not strictly necessary.
- The cost of escalation (delay, context switch) exceeds the benefit.

### Documenting narrower interpretations

When proceeding with a narrower interpretation instead of escalating:

1. State the narrower interpretation explicitly.
2. Explain why it satisfies the objective.
3. Note the alternative that was not taken.
4. Include in the completion packet for reviewer verification.

Example:

```text
NARROWER INTERPRETATION

Objective: "Update all indexes to reflect new autonomy documents"

Narrower interpretation: Update only docs/index.md (parent index).
  Do not update docs/decisions/index.md or docs/plans/index.md because
  autonomy documents are not decisions or plans.

Alternative not taken: Update all index.md files in docs/ tree.
  Rejected because autonomy is a distinct category, not a subtype of
  decisions or plans.
```

**Note:** Document narrower interpretations in the `assumptions/open-questions`
field of the completion packet.

## Blocked status

When an authority request is denied and no alternative path exists, the agent
reports **blocked** status:

```text
BLOCKED

Blocked on: <what authority was denied>
Objective impact: <what cannot be completed>
Recommended action: <re-scope task, abandon objective, or human intervention>
```

The orchestrator presents the blocked status to the human with the original
authority request and the agent's assessment. The human decides whether to:

- Re-scope the task to avoid the blocked action.
- Grant the authority and unblock.
- Abandon the objective.
- Provide alternative instructions.

## Anti-patterns

- **Silent expansion:** Proceeding beyond granted authority without escalation.
- **Paraphrase loss:** Summarizing or altering the structure of an authority
  request during upward communication.
- **Workaround escalation:** Denying a request then effectively granting it
  through a different path.
- **Speculative escalation:** Requesting authority for actions that may be
  needed but are not currently necessary.
- **Security boundary testing:** Requesting authority for actions that are
  prohibited by hard security constraints.

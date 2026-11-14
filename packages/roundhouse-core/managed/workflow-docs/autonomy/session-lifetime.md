# Session Lifetime and Supervision Model

Defines how authority flows through task lifecycles, when it expires, how
sessions are managed, and what supervision looks like. Applies to all agent
types without exception.

## Task lifecycle

Every task follows this lifecycle. Authority is tied to lifecycle state.

```text
delegation → implementation → review → remediation → acceptance
```

### Delegation

- Orchestrator delegates task to implementor (e.g., document-author).
- Task handoff specifies: target scope, capability extension, purpose constraint,
  delegation limit.
- Authority activates upon acceptance of the task.

### Implementation

- Implementor executes task within granted authority.
- Authority is active and bounded by the task handoff.
- Implementor returns completion packet upon finishing.

### Review

- Orchestrator launches independent reviewer sessions.
- Reviewers receive: changed-file list, acceptance criteria, author attention
  flags, assigned skills.
- Reviewers operate under standing role authority (read-only, no bash, no edit).
- Review authority is independent of implementor authority.

### Remediation

- If review surfaces issues, task returns to the **same implementor**.
- Rationale: preserve context. The implementor understands the original
  decisions and can remediate efficiently.
- Implementor authority reactivates for the specific remediation scope.
- Reactivation occurs when orchestrator returns review findings to implementor
  with explicit remediation scope; no new task handoff required, but remediation
  scope bounds reactivated authority.
- Remediation cycles repeat review → remediation until acceptance.

### Acceptance

- Human approves work (Gate 2: commit approval).
- Authority expires upon acceptance.
- Workflow resets; next task begins at delegation.

## Authority expiration

Authority expires in these cases:

| Trigger | Effect |
| --- | --- |
| Task accepted | All task-granted authority expires. Standing authority remains. |
| Task abandoned | All task-granted authority expires immediately. |
| Task superseded | Old task authority expires; new task authority activates if delegated. |
| Session terminated | All authority expires. Work is suspect (see revocation below). |
| Workflow reset (after commit) | All task authority from previous workflow expires. |

### What remains after expiration

- Standing role authority (read, grep, web search, routine operations) persists
  across tasks. It is inherent to the role, not the task.
- Workflow-state authority (commit/push) expires when the workflow state
  transitions (e.g., after commit, the commit authority is consumed).

## Review remediation: same implementor

When review finds issues requiring remediation:

1. Return to the **same implementor** who produced the original work.
2. Provide the review findings, attention flags, and reviewer comments.
3. Implementor remediates within the original task scope (or escalated scope if
   the finding requires broader changes).
4. Re-enter review cycle.

### When to break this rule

Start a new session instead of returning to the same implementor when:

- Context is degrading (implementor is confused, repeating mistakes, or losing
  track of state).
- The task has fundamentally changed (scope expanded beyond original objective).
- The implementor is stuck (cannot remediate after reasonable effort).
- The human explicitly requests a fresh perspective.

Document the reason for breaking the rule in the completion packet.

## New session conditions

Start a new session when:

| Condition | Rationale |
| --- | --- |
| Context degrading | Implementor effectiveness is dropping; fresh context is more efficient |
| Task fundamentally changed | Original context is no longer relevant; new context needed |
| Implementor stuck | Cannot proceed; fresh perspective may unblock |
| Human requests | Human judgment overrides default behavior |
| Reviewer independence | Every review session is a new session (see below) |

### Reviewer independence

**Every review session is a new session.** Reviewers do not inherit context from
the implementor or from previous review sessions. This ensures independence.

- Each reviewer session receives only: changed-file list, acceptance criteria,
  attention flags, assigned skills.
- Reviewers do not receive chat history, implementation reasoning, or prior
  review findings (unless explicitly included in the handoff).
- Multiple reviewer sessions run in parallel for diverse perspectives.

## Soft revocation

Soft revocation: stop at a safe boundary, preserve state, report, await
instructions.

### Decision rule: soft revocation vs. escalation

If the agent can formulate a specific authority request with bounded scope, use
the escalation protocol (see [Escalation Protocol](./escalation-protocol.md)).
If the agent cannot determine what authority is needed or the situation requires
immediate cessation of the in-flight action, use soft revocation.

### When to soft-revoke

- Authority is questioned or unclear.
- Action may exceed granted scope but is not clearly prohibited.
- Implementor detects potential objective ambiguity.
- External condition changes (e.g., dependency becomes unavailable).

### Soft revocation procedure

1. **Stop** the current action immediately.
2. **Preserve state:** do not discard work, do not make further changes.
3. **Report:** state what was being done, why it was stopped, and what the
   current state is.
4. **Await instructions:** do not proceed until human or orchestrator provides
   direction.

### Example (hypothetical)

```text
SOFT REVOCATION

Stopped: Attempting to edit docs/specs/template.md
Reason: Task handoff specified "src/.opencode/workflow-docs/autonomy/*.md"
  but this file is outside that scope. Unclear whether index discipline
  requires updating it.
Current state: src/.opencode/workflow-docs/autonomy/*.md files created.
  docs/specs/template.md unchanged.
Awaiting: Clarification on whether to update specs template.
```

**Note:** This is a hypothetical example; `docs/specs/template.md` may or may
not exist depending on current repository state.

## Hard revocation

Hard revocation: terminate session, work is suspect, revert or discard unless
independently evaluated.

### When to hard-revoke

- Security boundary violation detected (e.g., attempt to access `.env` files).
- Destructive operation attempted (e.g., force-push, `--no-verify`).
- Human explicitly terminates the session.
- Agent behavior indicates loss of control (repeated constraint violations,
  incoherent output).

### Hard revocation procedure

1. **Terminate** the session immediately.
2. **Flag work as suspect:** all changes from this session are untrusted.
3. **Revert or discard:** unless a human or independent reviewer evaluates the
   work and confirms it is safe.
4. **Do not reuse context:** start a fresh session if work must continue.

### Example

```text
HARD REVOCATION

Terminated: document-author session attempting "git push --force"
Reason: Force-push is a hard security boundary. Always denied.
Work status: Suspect. All changes from this session require independent
  evaluation before acceptance.
Next: Start new session. Re-implement from scratch or evaluate existing
  changes with fresh reviewer.
```

## Supervision model

### Direct parent supervises direct children

- Orchestrator supervises document-author and reviewer sessions.
- Document-author does not supervise any other agents (no delegation by default,
  I4).
- Reviewers do not supervise any agents (read-only, independent).

### What supervision means

- Parent assigns tasks and defines authority boundaries.
- Parent receives completion packets and review findings.
- Parent escalates to human when necessary.
- Parent does **not** micromanage; agents operate autonomously within granted
  authority.

### No timed status reports

Current OpenCode limitations do not support timed status reports or periodic
check-ins. Supervision is event-driven:

- Completion packet signals task completion.
- Authority request signals a gap.
- Blocked status signals an impasse.
- Soft/hard revocation signals a problem.

Do not implement polling or periodic status updates; they add friction without
corresponding benefit in this architecture.

## Intervention triggers

The human or orchestrator should intervene when:

| Signal | Meaning | Action |
| --- | --- | --- |
| Observable scope drift | Agent is working outside task scope | Clarify scope or re-delegate |
| Repeated speculation | Agent is guessing rather than escalating | Reinforce escalation protocol |
| Disregard for constraints | Agent is ignoring stated boundaries | Hard revoke and re-delegate with explicit constraints |
| Context degradation | Agent is confused or repeating mistakes | Start new session |
| Security boundary test | Agent is probing prohibited actions | Hard revoke and investigate |

### Intervention is not failure

Intervention is a normal part of the workflow. It signals that the autonomy
model needs adjustment, not that the agent is broken. Use intervention as
feedback to refine task handoffs, permission configuration, or normative
guidance.

## Session lifetime summary

| Phase | Authority state | Duration |
| --- | --- | --- |
| Pre-delegation | Standing only | Permanent |
| Delegation | Standing + task-granted | Until task accepted/abandoned/superseded |
| Implementation | Standing + task-granted | Until completion packet returned |
| Review | Standing (read-only) | Until review findings submitted |
| Remediation | Standing + task-granted (reactivated) | Until remediation complete |
| Acceptance | Standing only (task authority expired) | Permanent |
| Post-commit reset | Standing only | Permanent (until next delegation) |

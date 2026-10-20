# Autonomy Principles

Foundational invariants governing all authority in this harness. These are
non-negotiable constraints; every permission, task handoff, and skill assignment
must satisfy them.

## Six fundamental invariants

### I1. Authority cannot expand downward

A delegating agent cannot grant authority it does not itself possess. An
orchestrator without edit permission cannot authorize a subagent to edit. A task
handoff cannot broaden the delegatee's capability beyond the delegator's scope.

**Enforcement:** Permission configuration defines the ceiling. Task grants are
always subsets of standing role authority plus explicit workflow-state
exceptions.

### I2. Authority is bounded by the approved objective

Every grant of authority is constrained by the specific objective it serves.
Authority to modify module X for task Y does not extend to module Z or task W,
even if the agent technically could access them.

**Enforcement:** Task handoffs specify target modules, files, or scope. Agents
self-bound to the stated objective. Reviewers verify scope adherence.

### I3. Least privilege resolves ambiguity

When uncertain whether an action is authorized, assume it is not. Request
clarification rather than acting on assumed authority. The cost of a denied
request is lower than the cost of an unauthorized action.

**Enforcement:** Escalation protocol (see [Escalation Protocol](./escalation-protocol.md)).
Permission defaults to deny; grants are explicit.

### I4. Authority is non-delegable by default

An agent granted authority for a task cannot re-delegate that authority to
another agent unless explicitly permitted. Task delegation is a top-down
operation; lateral or downward delegation requires human approval.

**Enforcement:** OpenCode `task` permission controls which agents can spawn
which subagents. Default is deny-all with explicit allowlists.

### I5. Objective ambiguity belongs to the human

When the approved objective is ambiguous, contradictory, or silent on a
necessary decision, the question escalates to the human. Agents do not resolve
objective ambiguity by interpretation; they surface it.

**Enforcement:** Orchestrator conducts Socratic interview. Agents escalate via
structured request (see [Escalation Protocol](./escalation-protocol.md)).

### I6. Newer valid instructions supersede older ones

When a newer instruction conflicts with an older one, and the newer instruction
is valid (issued by an authorized source within scope), the newer instruction
takes precedence. This prevents stale rules from blocking legitimate work.

**Enforcement:** Workflow reset after each commit (see [AGENTS.md](../../../../AGENTS.md)).
Plan approval supersedes prior assumptions. Human override supersedes agent
interpretation.

## Invariant conflict resolution

When invariants appear to conflict, I1 (no downward expansion) and I5
(ambiguity → human) take precedence as safety invariants; the others resolve
within the boundary those two establish.

## The authority equation

Authority = **capability** × **scope** × **purpose** × **delegation constraint**

All four factors must be satisfied simultaneously:

| Factor | Meaning | Example |
| --- | --- | --- |
| Capability | The agent has the technical permission | `edit: allow` for document-author |
| Scope | The action falls within the granted resource boundary | Edit limited to changed-file list |
| Purpose | The action serves the approved objective | Edit implements an approved plan task |
| Delegation constraint | The action is not prohibited by delegation rules | Task grant does not re-delegate to another agent |

If any factor is absent, the action is unauthorized regardless of the other
three.

## Agent-agnostic design

These principles apply to every agent type without exception. No principle
references a specific agent by name as a special case. When a new agent type is
introduced:

1. Define its standing role authority (see [Authority Types](./authority-types.md)).
2. Verify every grant satisfies all four authority equation factors.
3. Confirm the six invariants hold under the new agent's permission set.
4. Test with representative prompts before deploying.

## Technical enforcement vs. normative guidance

| Principle | Primarily enforced by | Supporting mechanism |
| --- | --- | --- |
| I1 (no downward expansion) | Technical | Permission ceiling in configuration |
| I2 (objective-bounded) | Normative | Task handoff scope + reviewer verification |
| I3 (least privilege) | Both | Permission defaults + escalation protocol |
| I4 (non-delegable) | Technical | Task allowlists in configuration |
| I5 (ambiguity → human) | Normative | Orchestrator Socratic interview + escalation |
| I6 (newer supersedes) | Normative | Workflow reset + plan approval discipline |

Technical enforcement is deterministic and verifiable. Normative guidance
requires judgment and is verified by review. Both are authoritative.

## Security boundaries

The following remain technically enforced regardless of autonomy model changes:

- Secret file access (`.env` files): always denied.
- Destructive git operations (force-push, `--no-verify`, `--mirror`): always denied.
- Edit isolation: reviewers cannot edit.
- Bash isolation: reviewers cannot execute bash.
- Delegation control: task and skill allowlists are explicit.
- Human approval: commits and pushes require explicit human chat approval plus
  fresh OpenCode `once` confirmation.
- OpenCode `--auto` / auto-approve / persistent `always` approval: always denied.

These are not autonomy decisions; they are hard security constraints.

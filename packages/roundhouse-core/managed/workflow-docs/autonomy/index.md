# Autonomy and Delegated Authority Model

Defines how authority flows, contracts, and expires across every agent in this
harness. Agent-agnostic: applies to orchestrator, document-author, reviewer,
and any future agent type.

## When to read

- Designing or modifying agent permissions, task handoffs, or skill allowlists.
- Evaluating whether a requested action falls within granted authority.
- Handling an authority boundary question or escalation.
- Determining session lifetime, supervision, or revocation behavior.

## Documents

| Document | Purpose |
| --- | --- |
| [Principles](./principles.md) | Six fundamental invariants and the authority equation. Read when reasoning about whether an action is authorized. |
| [Authority Types](./authority-types.md) | Standing, task-granted, and workflow-state-derived authority. Read when classifying a requested action or defining agent permissions. |
| [Escalation Protocol](./escalation-protocol.md) | Structured request format and decision tree for authority gaps. Read when an agent lacks clear authority for a necessary action. |
| [Session Lifetime](./session-lifetime.md) | Task lifecycle, authority expiration, revocation, and supervision. Read when managing session boundaries or evaluating intervention triggers. |

## Enforcement spectrum

| Category | Mechanism | Examples |
| --- | --- | --- |
| Technically enforced | OpenCode permissions, mode constraints | Secret file denial, edit isolation, bash denial for reviewers, destructive git denial |
| Normatively guided | Instructions, skills, workflow structure | Routine vs. persistent classification, dependency escalation, external access judgment |

Technical enforcement is the hard boundary. Normative guidance shapes behavior
within that boundary. Both are authoritative; neither substitutes for the other.

## Parent

[Docs Index](../../../../docs/index.md)

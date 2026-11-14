---
name: behavioral-completeness
description: Review lens for specifications. Assesses specification completeness, missing scenarios, edge cases, and error conditions.
---

# Behavioral Completeness Review Lens

## Lens stance

Evaluate whether a specification covers the full behavioral surface of the
feature or system it describes. A complete specification leaves no reasonable
question about "what happens when..." unanswered.

## Review criteria

### Scenario coverage

- Does every public behavior have at least one Gherkin scenario?
- Are happy paths covered?
- Are error paths covered?
- Are boundary conditions covered?

### Missing scenarios

Look for common omissions:

- Empty input.
- Maximum input.
- Concurrent access.
- Timeout and retry.
- Authentication and authorization failures.
- Partial failure (some data valid, some invalid).
- Idempotency (same request sent twice).
- Ordering dependencies (does order matter?).

### Edge cases

- What happens at the boundaries of valid input?
- What happens with unexpected but plausible input?
- What happens when dependencies are unavailable?
- What happens under load?

### Error conditions

- Are all error responses specified?
- Are error messages defined?
- Is error recovery behavior specified?
- Are transient vs. permanent errors distinguished?

### State transitions

- Are all valid state transitions covered?
- Are invalid state transitions specified (and rejected)?
- Are the conditions for each transition explicit?

### Data invariants

- What invariants must hold at all times?
- Are invariants testable?
- What happens when an invariant is violated?

### Completeness heuristics

Ask:

1. What can the user do? Is every action specified?
2. What can go wrong? Is every failure specified?
3. What can change? Is every state transition specified?
4. What must be true? Is every invariant specified?
5. What must not happen? Is every prohibition specified?

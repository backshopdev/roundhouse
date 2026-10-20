---
name: specification
description: Use when authoring or reviewing a specification. Covers purpose, scope, terminology, constraints, quality attributes, public contracts, Gherkin scenarios with tags and stable IDs, open questions, and branch truth rules.
---

# Specification

## Purpose

A specification defines expected system behavior in a machine-checkable and
human-readable form. It is the authority for what the system does, not how it
does it.

## Required sections

### Purpose and scope statement

State what this specification defines and why it exists. One paragraph that
orients the reader.

### Scope

Define the boundaries of this specification:

- What is included.
- What is explicitly excluded.
- Dependencies on other specifications or decisions.

### Terminology

Define domain-specific terms used in this specification. Avoid ambiguity by
pinning term meanings early.

### Constraints

List hard constraints that the implementation must satisfy:

- Regulatory requirements.
- Performance bounds.
- Compatibility requirements.
- Resource limits.

### Quality attributes

Specify non-functional requirements:

- Performance targets (latency, throughput).
- Reliability targets (availability, recovery time).
- Security requirements.
- Scalability expectations.

Make these measurable where possible.

### Public contracts

Reference or inline the public interfaces this specification defines:

- API endpoints.
- Data schemas.
- Event contracts.
- Configuration interfaces.

Link to contract documents in `docs/contracts/` where applicable.

### Gherkin scenarios

Express behavior as Gherkin scenarios. Each scenario must have:

1. **Stable ID:** A unique `@id=SCEN-NNN` tag. IDs are never reused, even if a
   scenario is deleted.
2. **Classification tag:** Exactly one of `@unit` or `@integration`.
   - `@unit`: Testable in isolation without external dependencies.
   - `@integration`: Requires interaction with external systems or components.
3. **Given-When-Then structure:** Clear preconditions, action, and observable
   outcome.

Example:

```gherkin
@id=SCEN-001 @unit
Scenario: User authenticates with valid credentials
  Given a registered user with email "user@example.com"
  When the user submits valid credentials
  Then the system returns an authentication token
  And the token expires after 24 hours
```

### Open questions

List unresolved questions that may affect the specification. Track these
explicitly rather than burying uncertainty in prose.

### Branch truth rules

If behavior differs by configuration, feature flag, or deployment context,
state the rules clearly:

- Which branches exist.
- What determines which branch is active.
- How behavior differs per branch.

## Metadata

- **Stable ID:** `SPEC-YYYYMMDD-NN` (must match filename).
- **Last modified:** ISO 8601 date.
- **Status:** `Active`, `Superseded`, or `Retired`.

## Quality criteria

- Every public behavior has at least one Gherkin scenario.
- Every scenario has a unique, non-reused `@id`.
- Every scenario has exactly one `@unit` or `@integration` tag.
- Scenarios are testable: preconditions, actions, and outcomes are observable.
- Open questions are explicit, not hidden in prose.
- The specification is self-contained: a reader can understand the behavior
  without external context beyond linked references.

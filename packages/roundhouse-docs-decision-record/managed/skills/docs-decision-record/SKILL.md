---
name: decision-record
description: Use when authoring or reviewing a decision record. Covers context, decision drivers, alternatives, decision, rationale, consequences, assumptions, reconsider triggers, and supersession links.
---

# Decision Record

## Purpose

A decision record captures a significant decision — architectural, design, or
process — along with the context that motivated it, the alternatives
considered, the chosen option, and the consequences that follow.

## Required sections

### Context

Describe the situation that prompted the decision. What problem, opportunity,
or constraint triggered the need for a decision? Include relevant background
that a future reader needs to understand why this decision was made.

### Decision drivers

List the forces that shaped the decision. Drivers are constraints, quality
attributes, business goals, or technical requirements that influenced the
choice. Make them explicit so future readers can evaluate whether the decision
still holds when drivers change.

### Alternatives considered

For each alternative:

- Name and brief description.
- Advantages and disadvantages relative to the drivers.
- Why it was not chosen.

Include at least two alternatives plus the chosen option. "Do nothing" is a
valid alternative when appropriate.

### Decision

State the chosen option clearly and unambiguously. A reader should be able to
identify the decision without reading the full document.

### Rationale

Explain why this option was chosen over the alternatives. Connect the rationale
to the decision drivers. Show the trade-off reasoning, not just the conclusion.

### Consequences

Describe the expected outcomes — both positive and negative. Include:

- What becomes easier or possible.
- What becomes harder or impossible.
- What risks are introduced or mitigated.
- What follow-up work is required.

### Assumptions

List the assumptions underlying the decision. If an assumption proves false,
the decision may need revisiting.

### Reconsider triggers

Identify conditions that should trigger reconsideration of this decision.
Examples: a driver changes, a better alternative emerges, an assumption proves
false, a dependency changes.

### Supersession links

When this decision is superseded:

- Set status to `Superseded`.
- Add `Superseded by: <replacement-id>` metadata.
- The replacement decision must include a reciprocal `Supersedes: <this-id>`
  link.

## Metadata

- **Stable ID:** `DEC-YYYYMMDD-NN` (must match filename).
- **Last modified:** ISO 8601 date.
- **Status:** `Active`, `Superseded`, or `Retired`.

## Quality criteria

- A reader unfamiliar with the project can understand the decision and why it
  was made.
- The decision is specific enough to guide implementation.
- The rationale connects to drivers, not just preferences.
- Consequences are honest about both benefits and costs.
- Reconsider triggers are concrete, not vague.

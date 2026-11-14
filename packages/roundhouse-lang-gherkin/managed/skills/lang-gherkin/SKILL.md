---
name: lang-gherkin
description: Use when authoring or reviewing Gherkin scenarios. Provides the language craft — Given-When-Then structure, step atomicity, active voice, and the scenario conventions that keep scenarios readable and unambiguous.
---

# Lang Gherkin

## Expert stance

Write Gherkin scenarios that read as specifications, not test scripts. A
well-formed scenario states preconditions, actions, and outcomes in language a
non-programmer can verify.

## Structure

- Every scenario follows Given-When-Then structure.
- Preconditions (Given) are distinct from actions (When) and outcomes (Then).
- Each step is atomic (one action per step).
- Steps are written in active voice.

## Preconditions (Given)

- Preconditions are specific and observable.
- Preconditions set up the minimum state needed.
- Preconditions are reproducible.
- Preconditions avoid implementation details.

## Actions (When)

- The action describes a single user or system action.
- The action is specific enough to implement.
- The action avoids prescribing implementation.

## Outcomes (Then)

- Outcomes are observable and verifiable.
- Each Then clause asserts one thing.
- Outcomes are specific (not vague like "it works").
- Outcomes are independent of implementation.

## Common anti-patterns

- **Implementation coupling:** Steps describe how, not what.
- **Vague outcomes:** "Then the system behaves correctly."
- **Missing preconditions:** Steps assume state not set up.
- **Multiple actions:** "When the user clicks save and then navigates away."
- **Untestable scenarios:** Scenarios that require human judgment to verify.

## Acceptance-contract review

When scenarios serve as acceptance contracts — assessing testability, tag
appropriateness (`@unit` / `@integration`), and stable-ID conventions — apply
the review lens in `software-testing-gherkin`.

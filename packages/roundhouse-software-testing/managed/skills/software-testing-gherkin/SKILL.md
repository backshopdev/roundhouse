---
name: software-testing-gherkin
description: Use when reviewing Gherkin scenarios as acceptance contracts. The testability review lens — scenario testability, @unit/@integration tag appropriateness, and stable-ID conventions.
---

# Software Testing Gherkin

## Lens stance

Evaluate whether Gherkin scenarios are testable and correctly classified as
acceptance contracts. A good scenario can be directly translated into an
automated test without ambiguity. The Gherkin language craft itself
(structure, atomicity, voice) is `lang-gherkin`'s subject; this lens judges
the scenarios as test artifacts.

## Review criteria

### Testability

- Can this scenario be automated?
- Does the scenario require external context not described in the steps?
- Are there hidden dependencies?
- Can the scenario run in isolation (for @unit) or does it need integration?

### Tag appropriateness

- **@unit:** The scenario can be tested without external dependencies (no
  database, no network, no file system). Fast and isolated.
- **@integration:** The scenario requires interaction with external systems or
  components. Slower and dependent on infrastructure.
- Is the tag choice correct? A scenario tagged @unit that requires a database
  is misclassified.
- Does every scenario have exactly one of @unit or @integration?

### ID uniqueness

- Does every scenario have an `@id` tag?
- Is the ID unique across all specifications?
- Is the ID stable (does not change when the scenario is edited)?
- Is the ID format consistent (e.g., `SCEN-001`)?

## Testing strategy

Scenario suites are a testing-strategy surface, not just documentation:

- The @unit/@integration split is the execution-strategy boundary — keep the
  fast isolated suite large and the integration suite deliberate.
- A scenario that cannot be automated is a specification smell: either the
  behavior is vague or the scenario is testing human judgment.
- Stable IDs are what make scenario-level review comments and regression
  traces possible; an unstable ID breaks the trace, not just the link.

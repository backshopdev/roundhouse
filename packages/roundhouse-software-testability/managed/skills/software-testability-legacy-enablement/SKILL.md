---
name: test-enablement
description: Use when normal testing techniques are blocked by current code structure and legacy-code enablement is required. Specializes design-for-testability for Feathers-style seams.
---

# Test Enablement

A specialization of `design-for-testability` for legacy-code enablement. Use
when current code structure prevents normal testing techniques. Distinct from
greenfield testability guidance: this skill covers the gap between "code was
designed for testability" and "code must be made testable before further
changes."

## When to use

- The code under change is inadequately tested and current structure blocks
  normal testing (constructor injection, replaceable collaborators, pure
  functions).
- The task requires adding tests to legacy code as a safety net before further
  changes.
- The task explicitly authorizes legacy-code enablement techniques.
- DO NOT load for greenfield code where modern/idiomatic testing techniques
  apply.
- DO NOT load for routine test additions to already-testable code.

## Preferred order

1. **Use ordinary modern/idiomatic testing techniques where possible** —
   constructor injection, replaceable collaborators, pure functions,
   deterministic behavior. These are covered by `design-for-testability`.
2. **Use Feathers-style legacy-code test-enablement techniques only when
   current structure prevents normal testing** — characterization tests,
   dependency breaking, sprout and wrap. These are the focus of this skill.
3. **Escalate if adequate enablement would require broader restructuring than
   authorized** — return a blocking question rather than improvising outside
   scope.

## Legacy-code enablement techniques

### Characterization tests

When you cannot easily unit test legacy code, write characterization tests:
call the code with specific input, observe the output, assert the output
matches (even if you do not understand why). Use these tests as a safety net
while refactoring. Characterization tests capture actual behavior, not
intended behavior.

### Dependency breaking

To test legacy code, you must break its dependencies: identify the dependency
(global state, direct instantiation, singleton), introduce an interface or
seam, inject the dependency, replace with a test double. This is refactoring.
Do it in small, safe steps, verified by characterization tests.

### Sprout and wrap

Sprout: add new, testable code alongside legacy code. Call the new code from
the legacy code. Wrap: create a testable wrapper around legacy code. Call the
wrapper instead of the legacy code directly.

## Boundary with design-for-testability

- `design-for-testability` covers testability as a design property for
  greenfield and well-structured code.
- `test-enablement` (this skill) covers legacy-code enablement when current
  structure blocks normal testing.
- Load `design-for-testability` first; load `test-enablement` only when the
  former is insufficient.
- Do not duplicate content from `design-for-testability`; reference it
  instead.

## Warning signs

- **Using legacy-code seams where normal dependency injection was available** —
  a quality regression. Constructor injection, replaceable collaborators, and
  pure functions are preferred when the code structure permits.
- **Permanent seams** — Feathers-style seams are transitional scaffolding, not
  preferred architecture. Plan to remove them once the code is testable
  through normal means.
- **Characterization tests as the final state** — characterization tests
  capture actual behavior, not intended behavior. They are a safety net, not
  a substitute for understanding.
- **Refactoring without a safety net** — never refactor legacy code without
  characterization tests in place first.

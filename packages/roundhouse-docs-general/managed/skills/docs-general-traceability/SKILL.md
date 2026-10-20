---
name: requirements-traceability
description: Review lens for implementation plans. Assesses scenario-to-test mapping, traceability matrix completeness, and missing mappings.
---

# Requirements Traceability Review Lens

## Lens stance

Evaluate whether every specified behavior has a clear implementation path and
test location. Traceability ensures nothing falls through the cracks between
specification and implementation.

## Review criteria

### Traceability matrix

- Does the plan include a scenario traceability matrix?
- Does every scenario in the related specification(s) appear in the matrix?
- Does every matrix row map to a specific work package and task?
- Does every matrix row identify a test location?

### Missing mappings

Look for:

- Scenarios in the spec not in the matrix.
- Matrix rows with no task assigned.
- Matrix rows with no test location.
- Test locations that do not exist or are vague.

### Coverage completeness

- Are all @unit scenarios mapped to unit test locations?
- Are all @integration scenarios mapped to integration test locations?
- Are error scenarios mapped to error-handling tests?
- Are boundary conditions mapped to boundary tests?

### Test location quality

- Are test locations specific (file path, not just "tests/")?
- Do test locations follow the project's naming convention?
- Are test locations plausible (unit tests in unit directories, etc.)?

### Bidirectional traceability

- Can you trace from spec → plan → code → test?
- Can you trace from test → code → plan → spec?
- If a scenario changes, can you find all affected work?

### Gap analysis

Ask:

1. Are there scenarios with no implementation task?
2. Are there implementation tasks with no corresponding scenario?
3. Are there tests with no corresponding scenario?
4. Are there scenarios with no test?

Each gap is a risk. Document it explicitly if intentional.

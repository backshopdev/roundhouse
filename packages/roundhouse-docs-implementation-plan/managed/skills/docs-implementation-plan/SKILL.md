---
name: implementation-plan
description: Use when authoring or reviewing an implementation plan. Covers objective, related specs and decisions, current-state findings, intended shape, work packages, dependencies, parallelism, change map, prescriptiveness levels, scenario traceability, documentation stubs, and verification criteria.
---

# Implementation Plan

## Purpose

An implementation plan decomposes a specification into concrete work packages
and tasks. It bridges the gap between "what the system should do" (spec) and
"how we build it" (code).

## Required sections

### Objective

State what this plan achieves. Link to the specification(s) it implements.

### Related specifications and decisions

List the specifications and decision records that inform this plan:

- Specifications: which behaviors are being implemented.
- Decisions: which architectural or design decisions constrain the approach.

### Current-state findings

Summarize relevant findings from the discovery phase:

- What exists today.
- What constraints or debt affects the approach.
- What the codebase already provides that can be reused.

### Intended shape

Describe the high-level approach:

- New components or modules.
- Modified components.
- Components left unchanged.
- Data model changes.
- Interface changes.

Use a Mermaid diagram where it clarifies the structure.

### Work packages

Decompose the work into packages and tasks:

- **Work package:** `WP-NN` — a coherent unit of work.
- **Task:** `T-NN` — a specific action within a work package.

For each work package:

- Description and scope.
- Tasks with estimated effort.
- Dependencies on other work packages.
- Parallelism opportunities (what can run concurrently).

### Dependencies

Map dependencies between work packages:

- Internal dependencies (WP-02 depends on WP-01).
- External dependencies (third-party libraries, team availability).

### Change map

List every file that will be created, modified, or deleted:

- New files with purpose.
- Modified files with change summary.
- Deleted files with rationale.

### Prescriptiveness levels

For each work package or task, indicate the prescriptiveness level:

- **Required:** Must be implemented exactly as specified. No deviation without
  plan amendment.
- **Expected:** Should be implemented as specified. Deviation allowed with
  justification documented.
- **Discretion:** Suggested approach. The implementer may choose a different
  approach if justified.

### Scenario traceability matrix

Map each specification scenario to the work package and task that implements
it:

| Scenario ID | Work package | Task | Test location |
| --- | --- | --- | --- |
| SCEN-001 | WP-01 | T-02 | tests/unit/auth.test.js |

This matrix ensures every specified behavior has an implementation path and a
test location.

### Documentation stubs

Identify documentation that must be created or updated as part of this plan:

- New decision records needed.
- Specifications to update.
- Architecture documents to create.
- Implementation maps to update.

### Verification criteria

Define how to verify the plan is complete:

- All scenarios implemented and tested.
- All documentation updated.
- All acceptance criteria met.
- `docs-check` passes.
- Lint and test suites pass.

## Metadata

- **Stable ID:** `PLAN-YYYYMMDD-NN` (must match filename).
- **Last modified:** ISO 8601 date.
- **Status:** `Draft`, `Ready`, `In progress`, `Completed`, `Abandoned`, or
  `Partially completed`.

## Lifecycle

- `Draft` → `Ready`: Plan reviewed and approved for implementation.
- `Ready` → `In progress`: Implementation started.
- `In progress` → `Completed`: All work done and verified.
- `In progress` → `Abandoned`: Work stopped, not to be resumed.
- `In progress` → `Partially completed`: Some work done, remainder abandoned
  or deferred.

Terminal plans (`Completed`, `Abandoned`) move to `plans/archive/`.

# Archived Implementation Plans Template

Last modified: 2026-09-04
Status: Archived

Use this template when moving a **completed or abandoned implementation plan**
into the `plans/archive/` subtree. Archived plans are kept for historical
reference only and are not maintained. Do **not** use this template for new
plans — use the active template instead.

## Active template

The canonical structure for an implementation plan is defined by the active
template. Archived copies retain that structure for fidelity; only the status
metadata and lifecycle metadata change. See
[`../template.md`](../template.md) for the full active form.

## Required metadata

- `Status: Completed`, `Status: Abandoned`, or
  `Status: Partially completed` — all terminal plan statuses.
- `Last modified` date in ISO 8601 format (`YYYY-MM-DD`).

## When to archive

Move a plan to `archive/` when it reaches a terminal status: every work
package is closed (`Completed`), the work was halted without completion
(`Abandoned`), or execution ended with outstanding tasks
(`Partially completed`). The archived file keeps its original stable ID as the
filename; only its location changes.

## Minimal archived form

A minimal archived plan preserves:

- The H1 title and stable ID (`PLAN-YYYYMMDD-NN: Title`).
- The metadata block (`Last modified`, `Status`).
- The `## Objective` and `## Related specifications and decisions` sections.
- A `## Outcome` section summarizing what was actually delivered (or why the
  plan was abandoned).
- A `## Verification` section noting the final state of the verification
  criteria from the active template.

Optional sections (`## Current-state findings`, `## Intended shape`,
`## Work packages`, `## Change map`, `## Scenario traceability matrix`,
`## Documentation stubs`) may be retained verbatim or summarized.

## Index discipline

Archived plans appear in [`index.md`](./index.md) under
`## Archived plans` and are removed from the active parent index. The
docs-check script enforces that a document appears in at most one navigation
surface.

# Archived Specifications Template

Last modified: 2026-09-04
Status: Archived

Use this template when moving a **superseded or retired specification** into the
`specs/archive/` subtree. Archived specifications are kept for historical
reference only and are not maintained. Do **not** use this template for new
specifications — use the active template instead.

## Active template

The canonical structure for a specification is defined by the active template.
Archived copies retain that structure for fidelity; only the status metadata
and lifecycle metadata change. See
[`../template.md`](../template.md) for the full active form.

## Required metadata

- `Status: Superseded` (with `Superseded by: SPEC-YYYYMMDD-NN` link) or
  `Status: Retired` (terminal).
- `Last modified` date in ISO 8601 format (`YYYY-MM-DD`).
- A reciprocal `Supersedes` link if the archived spec replaced a prior one.

## When to archive

Move a specification to `archive/` when its status transitions to
`Superseded` (replaced by a newer spec) or `Retired` (no longer authoritative
and not replaced). The archived file keeps its original stable ID as the
filename; only its location changes.

## Minimal archived form

A minimal archived specification preserves:

- The H1 title and stable ID (`SPEC-YYYYMMDD-NN: Title`).
- The metadata block (`Last modified`, `Status`).
- The `## Purpose` and `## Scope` sections from the active template.
- The `## Public contracts` section, if any.
- A `## Supersession` section linking to the replacement (or noting retirement
  with no successor).

Optional sections (`## Terminology`, `## Constraints`, `## Quality attributes`,
`## Scenarios`, `## Open questions`, `## Branch truth rules`) may be retained
verbatim or summarized, depending on how much historical context is useful.

## Index discipline

Archived specifications appear in
[`index.md`](./index.md) under `## Archived specifications` and are removed
from the active parent index. The docs-check script enforces that a document
appears in at most one navigation surface.

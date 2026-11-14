# Archived Decision Records Template

Last modified: 2026-09-04
Status: Archived

Use this template when moving a **superseded or retired decision record** into
the `decisions/archive/` subtree. Archived decision records are kept for
historical reference only and are not maintained. Do **not** use this template
for new decisions — use the active template instead.

## Active template

The canonical structure for a decision record is defined by the active
template. Archived copies retain that structure for fidelity; only the status
metadata and lifecycle metadata change. See
[`../template.md`](../template.md) for the full active form.

## Required metadata

- `Status: Superseded` (with `Superseded by: DEC-YYYYMMDD-NN` link) or
  `Status: Retired` (terminal).
- `Last modified` date in ISO 8601 format (`YYYY-MM-DD`).
- A reciprocal `Supersedes` link if the archived decision replaced a prior one.

## When to archive

Move a decision record to `archive/` when its status transitions to
`Superseded` (replaced by a newer decision that revisits the same question) or
`Retired` (no longer authoritative, no successor). The archived file keeps its
original stable ID as the filename; only its location changes.

## Minimal archived form

A minimal archived decision record preserves:

- The H1 title and stable ID (`DEC-YYYYMMDD-NN: Title`).
- The metadata block (`Last modified`, `Status`).
- The `## Context` and `## Decision` sections from the active template.
- The `## Rationale` section, condensed if lengthy.
- A `## Supersession` section linking to the replacement (or noting retirement
  with no successor).

Optional sections (`## Decision drivers`, `## Alternatives considered`,
`## Consequences`, `## Assumptions`, `## Reconsider triggers`) may be retained
verbatim or summarized.

## Index discipline

Archived decision records appear in
[`index.md`](./index.md) under `## Archived decisions` and are removed from the
active parent index. The docs-check script enforces that a document appears in
at most one navigation surface.

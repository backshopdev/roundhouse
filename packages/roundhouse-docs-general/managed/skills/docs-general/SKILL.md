---
name: docs-general
description: Use when authoring, reviewing, or navigating repository documentation, or judging documentation quality. Carries the dictum that documentation gaps are a blocking finding and that docs are first-class repo inhabitants updated along with the code, plus the repo-artifact-system conventions: metadata, stable IDs, index discipline, archive rules, and lifecycle status.
---

# Docs General

## The dictum

Documentation gaps are a blocking finding. Documentation is part of
implementation, not deferred follow-up: docs are first-class repo inhabitants
updated along with the code they document, in the same changeset. A code or
configuration change without its documentation synchronization is incomplete;
deferred documentation work is an explicit KTLO item, never silent debt.

## Expert stance

Apply senior documentation-quality and documentation-architecture judgment.
The repository is the canonical source of truth; external surfaces (Wiki,
portals, generated sites) are publication targets, not independent authorities.
This skill carries the general documentation-quality practice and encodes the
repo-artifact-system conventions — metadata, stable IDs, index discipline,
archive rules, and lifecycle status — that keep the documentation tree
navigable, consistent, and machine-checkable.

## Metadata requirements

Every durable document (decisions, specs, plans, architecture, implementation
maps, contracts, KTLO items) must include a `Last modified` metadata field in
ISO 8601 date format (`YYYY-MM-DD`) at the top of the file, immediately after
the frontmatter or as the first line. The only exception is `index.md`, which
does not require `Last modified`.

Example:

```markdown
Last modified: 2026-08-31

# DEC-20260831-01: Adopt event-sourced audit log
```

## Stable ID conventions

Every durable document receives a stable identifier that never changes once
assigned:

| Document type | ID prefix | Format | Example |
| --- | --- | --- | --- |
| Decision record | `DEC` | `DEC-YYYYMMDD-NN` | `DEC-20260831-01` |
| Specification | `SPEC` | `SPEC-YYYYMMDD-NN` | `SPEC-20260829-01` |
| Implementation plan | `PLAN` | `PLAN-YYYYMMDD-NN` | `PLAN-20260831-01` |
| Architecture document | `ARCH` | `ARCH-YYYYMMDD-NN` | `ARCH-20260831-01` |
| Implementation map | `IMPL` | `IMPL-YYYYMMDD-NN` | `IMPL-20260831-01` |
| Contract | `CON` | `CON-YYYYMMDD-NN` | `CON-20260831-01` |
| KTLO item | `KTLO` | `KTLO-YYYYMMDD-NN` | `KTLO-20260831-01` |

The date portion reflects the creation date. The sequence number (`NN`) is
zero-padded and increments per day per type. The stable ID must agree with the
filename: `DEC-20260831-01.md` contains `DEC-20260831-01`.

## Filename conventions

- Filenames use the stable ID as the base name: `DEC-20260831-01.md`.
- Templates use `template.md`.
- Indexes use `index.md`.
- All filenames are lowercase except for the ID prefix.

## Index structure rules

1. Every directory containing Markdown files must have an `index.md`.
2. Each `index.md` links to:
   - Its parent directory's `index.md` (one level up).
   - Every sibling Markdown file in the same directory (excluding itself).
   - Every immediate child directory that contains Markdown (via that child's
     `index.md`).
3. Indexes do not link multiple levels deep. An index in `docs/decisions/`
   links to `docs/index.md` (parent), sibling documents, and
   `docs/decisions/archive/index.md` (immediate child) — but not to documents
   inside `archive/`.
4. All links are relative. No absolute paths.

## Link discipline

- Use relative links exclusively.
- Index links to siblings use bare filenames: `[DEC-20260831-01](DEC-20260831-01.md)`.
- Index links to children use directory names: `[Archive](archive/index.md)`.
- Index links to parent use `../index.md`.
- Cross-references within documents use relative paths from the document's
  location.

## Index entry formats

Every `index.md` enumerates its content with one of three patterns. Selection
is by directory role: populated tables for durable document collections,
bullet lists for directories whose items already carry rich inline metadata,
and section navigation for top-level indexes that only list sub-areas.

### Pattern selection

- **Populated table** — for directories listing durable documents (decisions,
  specs, plans, architecture, implementation maps, contracts, archives).
  Renders well in Markdown viewers; sort/filter-friendly; agent-parseable.
- **Bullet list** — for directories listing inline metadata per item (KTLO
  items, literature notes) where the items themselves carry rich tags
  (`[template]` / `[project]`, retrieval status, principle codes) that do not
  fit cleanly into table cells.
- **Section navigation** — for top-level indexes that list sub-areas rather
  than specific files. Verification only; no row-format rules apply.

### Populated table

The canonical column order is `Title | Description | Status | Date`.

- **Title** is a relative link to the file using the document's title text
  (e.g. `[GitHub Packages full-template distribution v0.5.0](SPEC-20260903-01.md)`).
  The Title cell draws from the H1 or, when a more descriptive title is
  available, from the document's Purpose/Context. The link text should be
  scannable and identify the document clearly. No `Slug` column; the link
  itself carries the path.
- **Description** is 1–2 sentences (≤40 tokens) sourced from the linked
  file's Purpose, Description, or Context section. It is the document's
  summary, not the stable ID.
- **Status** matches the valid values for the document's type (see
  `## Lifecycle status`).
- **Date** is the linked file's `Last modified` line in ISO 8601
  (`YYYY-MM-DD`).

Example (from `docs/specs/index.md`):

```markdown
| Title | Description | Status | Date |
|-------|-------------|--------|------|
| [GitHub Packages full-template distribution v0.5.0](SPEC-20260903-01.md) | Defines v0.5.0 private npm distribution to GitHub Packages and the `init`/`update` lifecycle for the Roundhouse template. | Active | 2026-09-03 |
```

### Bullet list

The canonical shape separates fields with em-dashes:

```markdown
- [<Title>](<file>.md) — <1–2 sentence description> — `<metadata>` — <YYYY-MM-DD>
```

- **Title** is a relative link to the file. Reference-style indexes
  (literature notes, external sources) may use a curated "Publication —
  Title" format in the link text for scannability, even when the linked
  note's H1 uses a different format like "Source Note: Title (Author)". The
  curated format must still uniquely identify each source.
- **Description** is 1–2 sentences (≤40 tokens) sourced from the linked
  file's first paragraph or purpose section.
- **Metadata** is one or more backtick-quoted tags preserved from the item's
  existing inline metadata (e.g. `` `[template]` ``, `` `[project]` ``,
  retrieval status, principle codes). Multiple metadata fields are joined
  with em-dashes.
- **Date** is the linked file's last-modified or retrieval date in ISO 8601.

Example (from `references/index.md`):

```markdown
- [AI Hero — A Complete Guide to AGENTS.md](./aihero-complete-guide-to-agents-md.md) — Synthesizes instruction-budget, progressive-disclosure, and context-staleness arguments for minimal always-loaded `AGENTS.md` files. — `[template]` — retrieved (full) — informs GP01, GP02, GP07 — 2026-08-30
```

Example (from `ktlo/index.md`):

```markdown
- [Coding standards](./KTLO-20260829-01.md) — Placeholder KTLO enumerating code-style and naming conventions for template consumers; awaits substantive content from the template repo. — `[template]` — 2026-08-29
```

### Empty placeholder

A directory whose durable documents have not yet been authored renders as
the canonical table header plus a single italicized row that points at the
area's `template.md`:

```markdown
| Title | Description | Status | Date |
|-------|-------------|--------|------|
| _No <items> yet. Use [template.md](template.md) to create one._ |  |  |  |
```

The italicized row occupies the Title cell only; the remaining cells are
empty. The wording adapts to the directory's document type ("No
architecture documents yet.", "No decisions yet.", "No KTLO items yet.").

### Section navigation

Top-level indexes that only point to sub-areas (e.g. `docs/index.md`,
`src/docs/index.md`) use a simple bullet list where each bullet links to a
child directory's `index.md` and carries a short description of the
sub-area. No column rules apply; the bullet is verified for link resolution
and parent-link presence only.

Example (from `src/docs/index.md`):

```markdown
- [Architecture](architecture/index.md) — System architecture and design.
- [Decisions](decisions/index.md) — Decision records and rationale.
```

## Archive rules

- Terminal plans (status: Completed, Abandoned) and terminal specs (status:
  Superseded, Retired) move to an `archive/` subtree within their parent
  directory.
- Archived documents remain linked from the archive `index.md` but are removed
  from the active parent `index.md`.
- A document must not appear in both active and archive navigation
  simultaneously.
- Archive directories follow the same index and link rules as active
  directories.

## Lifecycle status

Every document with a lifecycle carries a `status` metadata field. Valid values
by type:

| Document type | Valid statuses |
| --- | --- |
| Decision record | `Active`, `Superseded`, `Retired` |
| Specification | `Active`, `Superseded`, `Retired` |
| Implementation plan | `Draft`, `Ready`, `In progress`, |
| | `Completed`, `Abandoned`, `Partially completed` |
| Architecture document | `Active`, `Superseded`, `Retired` |
| Implementation map | `Active`, `Stale` |
| Contract | `Active`, `Superseded`, `Retired` |
| KTLO item | `Active`, `Resolved` |

Status transitions:

- Decision: `Active` → `Superseded` (with link to replacement) → `Retired`.
- Spec: `Active` → `Superseded` (with link to replacement) → `Retired`.
- Plan: `Draft` → `Ready` → `In progress` → `Completed` | `Abandoned` |
  `Partially completed`.
- Architecture: `Active` → `Superseded` → `Retired`.
- Implementation map: `Active` → `Stale` (when code diverges).
- Contract: `Active` → `Superseded` → `Retired`.
- KTLO: `Active` → `Resolved`.

## Supersession and replacement links

- A superseded decision must include a `Superseded by` link pointing to the
  replacement decision. The replacement must include a reciprocal `Supersedes`
  link.
- A superseded spec must include a `Superseded by` link. The replacement must
  include a reciprocal `Supersedes` link.
- These links are machine-checkable for reciprocity.

## Mermaid guidance

Mermaid diagrams are first-class documentation tools. They provide visual
structure that complements prose.

- Validate Mermaid syntax before committing. The `docs-check` script validates
  Mermaid blocks.
- Every Mermaid diagram must be accompanied by prose that conveys its essential
  meaning. A reader should understand the diagram's purpose even if rendering
  fails.
- Use Mermaid for: architecture diagrams, sequence diagrams, state machines,
  flowcharts, entity relationships, and dependency graphs.
- Keep diagrams focused. One concept per diagram. Split large diagrams into
  multiple focused views.

## Docs-as-code principles

- The repository is the canonical source. Wiki pages, generated sites, and
  exported PDFs are publication targets derived from repository content.
- All documentation changes go through the same review workflow as code changes.
- Documentation is versioned alongside code.
- Machine-checkable invariants (links, IDs, metadata, status) are enforced by
  `docs-check`, not by convention alone.
- Publication is a separate step that occurs after commit and push, mediated by
  the `docs-publish` skill.

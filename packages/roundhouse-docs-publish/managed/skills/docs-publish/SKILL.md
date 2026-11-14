---
name: docs-publish
description: Use when publishing repository documentation to an external surface such as a Wiki. Defines the publication boundary, diff review, and source-traceability requirements.
---

# Docs Publish

## Purpose

This skill defines the publication workflow for repository documentation.
Publication produces an external projection (Wiki, generated site) from
approved repository content. The repository remains the canonical source;
publication is a derived artifact.

## Principles

1. **Repository is canonical.** All authoritative content lives in the
   repository. Published pages are projections, not independent sources.
2. **Publication follows commit.** Content must be committed and pushed before
   publication. Never publish uncommitted work.
3. **Diff is reviewable.** Before publishing, display the proposed Wiki diff so
   the human can review what will change.
4. **Source traceability.** Every published page identifies its source path and
   the commit from which it was derived.
5. **Orchestrator-mediated.** Publication is initiated through the orchestrator
   after human approval. Subagents do not publish independently.

## Workflow

1. **Confirm committed.** Verify all documentation changes are committed and
   pushed.
2. **Build projection.** Generate the proposed Wiki content from repository
   sources.
3. **Display diff.** Show the human the proposed changes: new pages, modified
   pages, deleted pages.
4. **Human approval.** The human reviews the diff and approves publication.
5. **Publish.** Apply the approved changes to the publication target.
6. **Record provenance.** Each published page records:
   - Source path in the repository (e.g., `docs/decisions/DEC-20260831-01.md`).
   - Commit SHA from which it was derived.
   - Publication timestamp.

## Publication targets

The specific publication target (Wiki, static site, PDF) depends on the
consuming repository's configuration. This skill defines the workflow boundary;
the target implementation is repository-specific.

## What is published

- Decision records (Active status).
- Specifications (Active status).
- Architecture documents (Active status).
- Implementation maps (Active status).
- Contract reference documentation.
- KTLO items (Active status).

Archived, superseded, and retired documents are not published unless explicitly
requested.

## What is not published

- Implementation plans (internal working documents).
- Draft documents.
- Agent scratch space.
- Internal indexes and navigation structures (these are repository-only).

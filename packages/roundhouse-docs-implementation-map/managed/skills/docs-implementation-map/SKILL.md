---
name: implementation-map
description: Use when authoring or reviewing an implementation map. Covers purpose, capability-to-code navigation, entry points, key files and symbols, responsibilities, test locations, extension points, hazards, and Mermaid diagrams.
---

# Implementation Map

## Purpose

An implementation map provides capability-to-code navigation for the codebase.
It helps a reader understand where a capability lives, how to find relevant
code, and what to watch out for when modifying it.

## Required sections

### Purpose and scope

State what this implementation map covers. Link to the architecture document
and specifications it relates to.

### Capability-to-code navigation

For each major capability or feature:

- Capability name and description.
- Entry point: where requests or operations begin.
- Key files: the most important source files.
- Key symbols: classes, functions, modules that implement the capability.
- Test locations: where tests for this capability live.

Present as a table or structured list for quick scanning.

### Entry points

Describe the system's entry points:

- HTTP endpoints and their handlers.
- Message consumers and their handlers.
- CLI commands and their implementations.
- Scheduled jobs and their triggers.

For each entry point, trace the path to the core logic.

### Key files and symbols

For each significant module or component:

- File path.
- Primary responsibility.
- Public API (exports, interfaces).
- Dependencies (imports, collaborators).

### Responsibilities

Clarify what each module or component owns:

- What data it manages.
- What invariants it enforces.
- What it does not do (explicit non-responsibilities).

### Test locations

Map capabilities to their test locations:

- Unit tests: path and naming convention.
- Integration tests: path and naming convention.
- End-to-end tests: path and naming convention.

### Extension points

Identify where the system is designed to be extended:

- Plugin interfaces.
- Configuration hooks.
- Strategy patterns.
- Event hooks.

For each extension point, describe how to extend and what constraints apply.

### Hazards

Document known hazards in the code:

- Complex or fragile code paths.
- Performance-sensitive sections.
- Thread-safety concerns.
- Legacy code with hidden assumptions.
- Areas where changes have high risk.

### Mermaid diagrams

Use diagrams to clarify:

- Module dependency graphs.
- Request flow through the system.
- Data model relationships.

Every diagram must be accompanied by prose.

## Metadata

- **Stable ID:** `IMPL-YYYYMMDD-NN` (must match filename).
- **Last modified:** ISO 8601 date.
- **Status:** `Active` or `Stale`.

## Maintenance

Implementation maps become stale when code changes. Update the map when:

- New capabilities are added.
- Module responsibilities change.
- Entry points are added or removed.
- Hazards are discovered or resolved.

Mark the map as `Stale` when it no longer accurately reflects the codebase and
cannot be immediately updated.

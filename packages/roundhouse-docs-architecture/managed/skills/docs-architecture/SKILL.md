---
name: architecture-document
description: Use when authoring or reviewing an architecture document. Covers purpose, system context, components, contracts, data and control flow, runtime topology, cross-cutting concerns, and Mermaid diagrams.
---

# Architecture Document

## Purpose

An architecture document describes the system's structure: components, their
responsibilities, the contracts between them, and the flows of data and control.
It provides the mental model needed to understand, modify, and extend the
system.

## Required sections

### Purpose and scope

State what this architecture document covers and its scope. Link to related
specifications and decisions.

### System context

Describe the system's environment:

- External actors (users, systems, services).
- Integration points.
- System boundaries.

Use a C4 Context diagram (Mermaid) to visualize the system in its environment.

### Components

For each major component:

- Name and responsibility.
- Public interfaces (what it exposes).
- Dependencies (what it requires).
- Technology choices.

Use a C4 Container diagram (Mermaid) to show component relationships.

### Contracts

Define the contracts between components:

- Synchronous: API contracts (REST, gRPC, function signatures).
- Asynchronous: Event contracts (message schemas, topic names).
- Data: Shared data schemas, database boundaries.

Link to contract documents in `docs/contracts/` where applicable.

### Data flow

Describe how data moves through the system:

- Primary data flows with direction and transformation.
- Data ownership (which component is authoritative for what data).
- Consistency boundaries.

Use a data flow diagram (Mermaid) where it clarifies the flow.

### Control flow

Describe how control moves through the system:

- Request processing paths.
- Error propagation.
- Retry and fallback behavior.

Use sequence diagrams (Mermaid) for critical paths.

### Runtime topology

Describe the runtime deployment:

- Process boundaries.
- Deployment units.
- Communication protocols.
- Scaling characteristics.

Use a deployment diagram (Mermaid) where applicable.

### Cross-cutting concerns

Address concerns that span multiple components:

- **Security:** Authentication, authorization, encryption.
- **Observability:** Logging, metrics, tracing.
- **Error handling:** Strategy for failures at each layer.
- **Configuration:** How configuration is managed and propagated.
- **Data integrity:** Transactions, consistency models.

## Mermaid diagrams

- Every diagram must be accompanied by prose that conveys its essential meaning.
- Validate Mermaid syntax before committing.
- Keep diagrams focused: one concept per diagram.
- Use consistent naming and styling across diagrams.

## Metadata

- **Stable ID:** `ARCH-YYYYMMDD-NN` (must match filename).
- **Last modified:** ISO 8601 date.
- **Status:** `Active`, `Superseded`, or `Retired`.

## Quality criteria

- A reader can understand the system structure from this document alone.
- Every component has a clear responsibility and boundary.
- Contracts are explicit and testable.
- Diagrams complement prose, not replace it.
- Cross-cutting concerns are addressed, not assumed.

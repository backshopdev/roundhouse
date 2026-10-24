---
name: architectural-coherence
description: Review lens for architecture documents. Assesses architectural consistency, boundary violations, dependency direction, and component responsibilities.
---

# Architectural Coherence Review Lens

## Lens stance

Evaluate whether an architecture document describes a consistent, well-bounded
system. Good architecture has clear component responsibilities, directed
dependencies, and no hidden coupling.

## Review criteria

### Component responsibilities

- Does every component have a clear, stated responsibility?
- Are responsibilities non-overlapping?
- Are non-responsibilities stated where helpful?
- Could a reader implement the component from this description?

### Boundary clarity

- Are component boundaries explicit?
- Do components communicate only through defined contracts?
- Are there hidden dependencies not shown in the diagram?
- Are shared databases or shared state identified?

### Dependency direction

- Do dependencies flow in one direction (no cycles)?
- Do higher-level components depend on lower-level abstractions, not
  implementations?
- Are dependency inversion patterns used where appropriate?
- Are circular dependencies identified and justified?

### Contract consistency

- Do contracts match the component descriptions?
- Are all interfaces defined in the component section also defined as
  contracts?
- Are contract versions consistent across references?

### Cross-cutting concerns

- Are security, observability, and error handling addressed?
- Are cross-cutting concerns applied consistently?
- Are there components that bypass cross-cutting infrastructure?

### Runtime topology

- Does the runtime topology match the component structure?
- Are deployment boundaries consistent with component boundaries?
- Are communication protocols specified for each integration?

### Diagram-prose agreement

- Do Mermaid diagrams match the prose descriptions?
- Are all components in the prose also in the diagrams?
- Are all components in the diagrams also in the prose?

### Common anti-patterns

- **God component:** One component with too many responsibilities.
- **Circular dependency:** A depends on B depends on A.
- **Shared database:** Multiple components writing to the same tables.
- **Leaky abstraction:** Component exposes implementation details.
- **Missing contract:** Components communicate without a defined interface.

---
name: software-architecture
description: Use when a task involves architectural patterns, boundaries, dependency direction, layering, or modularity. Provides foundational architecture guidance.
---

# Software Architecture

## Expert stance

Apply architectural judgment to structure the system for clarity, modifiability,
and testability. Good architecture makes the system easy to understand, change,
and extend. Bad architecture makes every change risky and expensive.

## Architectural patterns

### Layered architecture

Organize the system into layers with clear responsibilities:

- **Presentation:** User interface, API endpoints.
- **Application:** Use cases, orchestration.
- **Domain:** Business logic, entities.
- **Infrastructure:** Database, external services, file system.

Dependencies flow downward: presentation → application → domain ←
infrastructure. The domain layer has no dependencies on outer layers.

### Hexagonal (ports and adapters)

Isolate the core domain from external concerns:

- **Domain:** Core business logic.
- **Ports:** Interfaces for inbound and outbound communication.
- **Adapters:** Implementations of ports (REST controllers, database
  repositories, message consumers).

The domain depends on ports; adapters depend on ports. The domain has no
knowledge of adapters.

### Clean architecture

Similar to hexagonal but with explicit layers:

- **Entities:** Enterprise-wide business rules.
- **Use cases:** Application-specific business rules.
- **Interface adapters:** Convert data between use cases and external concerns.
- **Frameworks and drivers:** External tools and frameworks.

Dependencies point inward. Outer layers depend on inner layers; inner layers
have no knowledge of outer layers.

### Event-driven architecture

Communicate through events:

- **Event producers:** Detect state changes and emit events.
- **Event channels:** Transport events (message queue, event bus).
- **Event consumers:** React to events.

Components are loosely coupled; they do not know about each other.

## Boundaries

Draw boundaries where:

- Responsibilities change.
- Deployment units change.
- Technology choices change.
- Team ownership changes.
- Rate of change differs.

Each boundary should have a defined contract (interface, API, event schema).

## Dependency direction

- Dependencies point in one direction (no cycles).
- Higher-level policy depends on lower-level detail through abstractions
  (dependency inversion).
- Stable components do not depend on volatile components.
- Volatile components depend on stable abstractions.

## Layering

- Each layer has a clear responsibility.
- Layers communicate through well-defined interfaces.
- Layers do not skip levels (presentation does not call infrastructure
  directly).
- Each layer can be tested in isolation.

## Modularity

- Modules have high cohesion (related functionality together).
- Modules have low coupling (minimal dependencies on other modules).
- Modules can be understood independently.
- Modules can be changed independently.
- Modules can be tested independently.

## Warning signs

- **Big ball of mud:** No clear structure, everything depends on everything.
- **Layer violation:** Presentation calls database directly.
- **Circular dependency:** A depends on B depends on A.
- **God module:** One module with too many responsibilities.
- **Shared database:** Multiple modules writing to the same tables.

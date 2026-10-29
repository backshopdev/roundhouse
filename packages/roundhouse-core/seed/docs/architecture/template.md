# ARCH-YYYYMMDD-NN: Architecture Title

Last modified: YYYY-MM-DD
Status: Active

## Purpose

<!-- State what this architecture document covers and its scope. -->

Related specifications:

- SPEC-YYYYMMDD-NN

Related decisions:

- DEC-YYYYMMDD-NN

## System context

<!-- Describe the system's environment: external actors, integration points,
system boundaries. -->

```mermaid
graph TB
    User[User] --> System[System]
    System --> External[External Service]
```

## Components

### Component A

- **Responsibility:** Description.
- **Public interfaces:** Interface description.
- **Dependencies:** Component B.
- **Technology:** Technology choice.

### Component B

- **Responsibility:** Description.
- **Public interfaces:** Interface description.
- **Dependencies:** None.
- **Technology:** Technology choice.

```mermaid
graph TD
    A[Component A] -->|REST| B[Component B]
```

## Contracts

- CON-YYYYMMDD-NN: Contract between Component A and Component B.

## Data flow

<!-- Describe how data moves through the system. -->

```mermaid
flowchart LR
    A[Input] --> B[Transform] --> C[Output]
```

## Control flow

<!-- Describe how control moves through the system for critical paths. -->

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Component A
    participant B as Component B
    C->>A: Request
    A->>B: Internal call
    B-->>A: Response
    A-->>C: Response
```

## Runtime topology

<!-- Describe the runtime deployment: process boundaries, deployment units,
communication protocols. -->

## Cross-cutting concerns

### Security

- Authentication: Description.
- Authorization: Description.

### Observability

- Logging: Description.
- Metrics: Description.
- Tracing: Description.

### Error handling

- Strategy: Description.

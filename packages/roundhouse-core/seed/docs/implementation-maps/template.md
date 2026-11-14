# IMPL-YYYYMMDD-NN: Implementation Map Title

Last modified: YYYY-MM-DD
Status: Active

## Purpose

<!-- State what this implementation map covers. -->

Related architecture: ARCH-YYYYMMDD-NN.

## Capability-to-code navigation

| Capability | Entry point | Key files | Symbols | Tests |
| --- | --- | --- | --- | --- |
| Cap 1 | `src/routes/a.js` | `src/services/a.js` | `Svc` | `tests/unit/` |
| Cap 2 | `src/handlers/a.js` | `src/models/a.js` | `Mdl` | `tests/integ/` |

## Entry points

### HTTP endpoints

- `GET /api/resource` → `src/routes/resource.js:handler`
- `POST /api/resource` → `src/routes/resource.js:createHandler`

### Message consumers

- Topic `events.created` → `src/consumers/created.js:consume`

## Key files and symbols

### `src/services/resource.js`

- **Responsibility:** Business logic for resources.
- **Public API:** `create()`, `get()`, `update()`, `delete()`.
- **Dependencies:** `src/models/resource.js`, `src/events/emitter.js`.

### `src/models/resource.js`

- **Responsibility:** Data access for resources.
- **Public API:** `find()`, `save()`, `remove()`.
- **Dependencies:** Database connection.

## Responsibilities

- **Resource service:** Owns resource business rules and validation.
- **Resource model:** Owns data persistence and retrieval.

## Test locations

- **Unit tests:** `tests/unit/` — test individual modules in isolation.
- **Integration tests:** `tests/integration/` — test module interactions.
- **End-to-end tests:** `tests/e2e/` — test full user workflows.

## Extension points

- **Plugin interface:** `src/plugins/interface.js` — implement to add new
  plugins.
- **Event hooks:** `src/events/hooks.js` — subscribe to lifecycle events.

## Hazards

- `src/services/legacy.js`: Complex logic with hidden assumptions. Approach
  with caution; add characterization tests before modifying.
- `src/utils/date.js`: Timezone handling is fragile. Always use UTC internally.

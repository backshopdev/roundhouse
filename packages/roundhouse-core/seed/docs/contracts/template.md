# CON-YYYYMMDD-NN: Contract Title

Last modified: YYYY-MM-DD
Status: Active

## Purpose

<!-- State what this contract defines and who it is for. -->

## Overview

Brief description of the interface.

## Authentication

<!-- Describe how to authenticate with this interface. -->

- Mechanism: API key / OAuth / JWT.
- How to obtain credentials: Description.
- How to include in requests: Description.

## Endpoints

### `GET /api/resource`

**Description:** Retrieve a resource.

**Request:**

- Headers: `Authorization: Bearer <token>`
- Parameters: `id` (path, required)

**Response (200):**

```json
{
  "id": "string",
  "name": "string"
}
```

**Errors:**

- `401`: Authentication required.
- `404`: Resource not found.

### `POST /api/resource`

**Description:** Create a resource.

**Request:**

- Headers: `Authorization: Bearer <token>`
- Body:

```json
{
  "name": "string"
}
```

**Response (201):**

```json
{
  "id": "string",
  "name": "string"
}
```

**Errors:**

- `400`: Invalid request.
- `401`: Authentication required.

## Workflows

### Create and retrieve a resource

1. `POST /api/resource` with name.
2. Note the returned `id`.
3. `GET /api/resource/{id}` to retrieve.

## Error semantics

- All errors return a JSON body with `code` and `message`.
- `4xx` errors are client errors; do not retry without fixing the request.
- `5xx` errors are server errors; retry with exponential backoff.

## Compatibility

- **Versioning:** URI versioning (`/v1/`, `/v2/`).
- **Breaking changes:** Announced 6 months in advance.
- **Deprecation:** Marked with `Deprecated` header.

## Generated reference

- OpenAPI specification: `contracts/CON-YYYYMMDD-NN.yaml`

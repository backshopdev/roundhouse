---
name: openapi
description: Use when authoring or reviewing OpenAPI specifications. Covers OpenAPI 3.x structure, validation, examples, and best practices.
---

# OpenAPI

## Purpose

This skill provides guidance on authoring OpenAPI 3.x specifications for REST
API contracts.

## Structure

An OpenAPI specification includes:

- **info:** API metadata (title, version, description).
- **servers:** Base URLs for the API.
- **paths:** Endpoint definitions with operations.
- **components:** Reusable schemas, parameters, responses, security schemes.
- **security:** Global security requirements.

## Authoring guidelines

### Paths and operations

- Use nouns for resource paths: `/users`, `/orders`, `/products`.
- Use HTTP methods for actions: `GET` (read), `POST` (create), `PUT` (replace),
  `PATCH` (partial update), `DELETE` (remove).
- Keep paths lowercase and hyphenated.
- Use path parameters for resource identifiers: `/users/{userId}`.

### Request and response schemas

- Define schemas in `components/schemas` for reuse.
- Use `$ref` to reference shared schemas.
- Provide `example` values for every schema.
- Mark required fields explicitly.
- Use `nullable: true` for optional fields that can be null.

### Status codes

- `200`: Successful request with response body.
- `201`: Resource created.
- `204`: Successful request with no response body.
- `400`: Invalid request (validation error).
- `401`: Authentication required.
- `403`: Authenticated but not authorized.
- `404`: Resource not found.
- `409`: Conflict (duplicate, state conflict).
- `422`: Unprocessable entity (semantic validation error).
- `500`: Internal server error.

### Examples

- Provide at least one example per schema.
- Examples should be realistic, not trivial.
- Use `examples` (plural) for multiple variants.

## Validation

Validate OpenAPI specifications before committing:

```bash
npx --yes @stoplight/spectral-cli lint api.yaml
```

Or use online validators for quick checks.

## Best practices

- Keep specifications focused. One API per file.
- Use tags to group related operations.
- Write clear descriptions for every operation, parameter, and schema.
- Document error responses consistently.
- Use `deprecated: true` for endpoints being phased out.
- Provide migration guidance in descriptions when deprecating.

## Metadata

OpenAPI files in `docs/contracts/` should reference the parent contract
document. The contract document (`CON-YYYYMMDD-NN.md`) is the authority; the
OpenAPI file is the machine-readable projection.

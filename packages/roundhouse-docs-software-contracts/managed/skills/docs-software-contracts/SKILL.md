---
name: docs-software-contracts
description: Use when authoring human-readable documentation for software contracts — the human-authored guide and the generated reference. Covers workflows, authentication, error semantics, compatibility, deterministic generation, and validation; generated docs serve a mixed agent+human audience.
---

# Docs Software Contracts

## Expert stance

Contract documentation has two complementary layers, and both audiences —
human integrators and agents — read them. The human-authored contract guide
explains how to use a contract; the generated reference is a deterministic
projection of the machine-readable contract. Neither substitutes for the
other: the guide carries judgment and narrative, the generated reference
carries exhaustive fidelity to the contract.

## The human-authored contract guide

A contract guide is a human-authored document that explains how to use a
contract. It complements the machine-readable contract (OpenAPI, JSON Schema)
with narrative guidance, examples, and workflow descriptions.

### When to write a contract guide

Write a contract guide when:

- The contract is complex and needs narrative explanation.
- Multiple workflows use the contract in different ways.
- Authentication or authorization is non-trivial.
- Error handling requires guidance beyond status codes.
- Compatibility or migration concerns exist.

### Required sections

#### Overview

Brief description of what the contract provides and who it is for.

#### Authentication

Describe how to authenticate with the API or service:

- Authentication mechanism (API key, OAuth, JWT, etc.).
- How to obtain credentials.
- How to include credentials in requests.
- Token refresh and expiration.

#### Workflows

Describe common workflows using the contract:

- Step-by-step instructions.
- Example requests and responses.
- Error handling at each step.

#### Error semantics

Explain how errors work:

- Error response format.
- Common error codes and their meanings.
- Retry strategies for transient errors.
- When to contact support.

#### Compatibility

Describe compatibility guarantees:

- Versioning policy.
- Breaking change policy.
- Deprecation process.
- Migration guides for major versions.

#### Usage patterns

Provide practical guidance:

- Rate limiting and throttling.
- Pagination.
- Filtering and sorting.
- Batch operations.
- Caching strategies.

#### Links to generated reference

Link to the machine-readable contract:

- OpenAPI specification (if applicable).
- JSON Schema definitions.
- Generated client libraries.

### Guide quality criteria

- A developer can integrate with the contract using only this guide.
- Examples are realistic and tested.
- Error handling is explicit, not assumed.
- Compatibility guarantees are clear.

## The generated reference

The generated documentation is a projection of the contract, not an
independent source.

### Principles

1. **Deterministic.** Given the same contract input, the generated output is
   always identical. No timestamps, random ordering, or non-deterministic
   elements.
2. **On-demand.** Generation happens when needed, not on a schedule. The
   generated output is not stored in the repository; it is derived at
   publication time.
3. **Validated.** Generated output is validated against the source contract to
   ensure fidelity.
4. **Traceable.** Every generated page identifies its source contract and the
   commit from which it was derived.

### Generation workflow

1. **Read contract.** Parse the machine-readable contract (OpenAPI YAML/JSON,
   JSON Schema).
2. **Validate contract.** Ensure the contract is valid according to its schema.
3. **Generate documentation.** Produce human-readable HTML or Markdown from the
   contract.
4. **Validate output.** Check that the generated documentation covers all
   endpoints, schemas, and examples in the contract.
5. **Publish.** Include the generated documentation in the publication target
   (Wiki, static site).

### What is generated

From OpenAPI:

- Endpoint listing with methods, paths, and descriptions.
- Request and response schemas with examples.
- Authentication requirements.
- Error responses.

From JSON Schema:

- Field listing with types, constraints, and descriptions.
- Example values.
- Nested object structure.

### What is not generated

- Narrative guidance (workflows, best practices). This belongs in the contract
  guide.
- Tutorials or how-to content.
- Architecture or design rationale.

### Tools

Common tools for generating documentation from contracts:

- **OpenAPI:** Redoc, Swagger UI, Stoplight Elements.
- **JSON Schema:** json-schema-viewer, custom generators.

Choose tools that produce deterministic output and support the required output
format.

### Validation

After generation, validate:

- Every endpoint in the contract appears in the documentation.
- Every schema in the contract appears in the documentation.
- Examples are present and valid.
- Links between schemas resolve correctly.

## The mixed audience

Write both layers for human integrators and agents alike: the guide's
narrative and the generated reference's structure are both machine-parseable
inputs to agent work. Keep section headings stable, examples realistic, and
the guide's link to the generated reference explicit so an agent can traverse
from narrative to exhaustive detail without guessing.

## Metadata

Contract documentation lives alongside the contract it documents. If the
contract is `CON-20260831-01`, the guide is part of that contract's
documentation.

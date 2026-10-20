---
name: json-schema
description: Use when authoring or reviewing JSON Schema definitions. Covers JSON Schema structure, validation, examples, and best practices.
---

# JSON Schema

## Purpose

This skill provides guidance on authoring JSON Schema definitions for data
contracts, event schemas, and configuration validation.

## Structure

A JSON Schema defines the structure and validation rules for JSON data:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://example.com/schemas/user.json",
  "title": "User",
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "email": { "type": "string", "format": "email" },
    "name": { "type": "string", "minLength": 1 }
  },
  "required": ["id", "email", "name"],
  "additionalProperties": false
}
```

## Authoring guidelines

### Type definitions

- Use `type` to specify the data type: `string`, `number`, `integer`, `boolean`,
  `object`, `array`, `null`.
- Use `format` for string formats: `email`, `uri`, `uuid`, `date`, `date-time`.
- Use `enum` for fixed sets of values.
- Use `oneOf`, `anyOf`, `allOf` for composition.

### Object schemas

- Define `properties` for each field.
- List `required` fields explicitly.
- Set `additionalProperties: false` to reject unknown fields (strict mode) or
  `true` to allow them (lenient mode).
- Use `propertyNames` to constrain field names.

### Array schemas

- Use `items` to define the schema for array elements.
- Use `minItems` and `maxItems` to constrain array length.
- Use `uniqueItems: true` to enforce uniqueness.

### String schemas

- Use `minLength` and `maxLength` for length constraints.
- Use `pattern` for regex validation.
- Use `format` for semantic validation (email, URI, etc.).

### Number schemas

- Use `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` for range
  constraints.
- Use `multipleOf` for divisibility constraints.

### Reusable definitions

- Use `$defs` (or `definitions` in older drafts) for reusable subschemas.
- Use `$ref` to reference definitions within the schema or external schemas.

## Validation

Validate JSON data against schemas:

```bash
npx --yes ajv-cli validate -s schema.json -d data.json
```

Validate the schema itself:

```bash
npx --yes ajv-cli compile -s schema.json
```

## Best practices

- Always include `$schema` to specify the draft version.
- Include `$id` for schema identification and referencing.
- Provide `title` and `description` for documentation.
- Include `examples` for each schema.
- Use `default` values where appropriate.
- Keep schemas focused: one schema per concept.
- Version schemas when making breaking changes.

## Metadata

JSON Schema files in `docs/contracts/` should reference the parent contract
document. The contract document is the authority; the schema file is the
machine-readable projection.

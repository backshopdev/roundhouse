---
name: contract-completeness
description: Review lens for contracts. Assesses contract completeness, internal consistency, spec alignment, consumer usability, and example validation.
---

# Contract Completeness Review Lens

## Lens stance

Evaluate whether a contract is complete, consistent, and usable by consumers. A
good contract leaves no ambiguity about the interface and provides enough
information for a consumer to integrate correctly.

## Review criteria

### Completeness

- Are all endpoints or operations defined?
- Are all request and response schemas defined?
- Are all error responses defined?
- Are all authentication requirements defined?
- Are all parameters (path, query, header, body) defined?

### Internal consistency

- Do schema references resolve?
- Are there conflicting definitions (same name, different schema)?
- Are required fields consistently marked?
- Are data types consistent across similar fields?
- Do examples validate against their schemas?

### Spec alignment

- Does the contract implement all behaviors in the related specification?
- Are all specification scenarios covered by the contract?
- Are specification constraints reflected in schema validation?
- Are specification quality attributes achievable with this contract?

### Consumer usability

- Can a consumer understand the contract without reading the source code?
- Are descriptions clear and complete?
- Are examples provided for every schema?
- Are examples realistic (not trivial placeholders)?
- Is the API surface intuitive (consistent naming, predictable behavior)?

### Example validation

- Do request examples validate against request schemas?
- Do response examples validate against response schemas?
- Are error examples provided for common error cases?
- Are edge-case examples provided where helpful?

### Versioning

- Is the contract versioned?
- Is the versioning scheme documented?
- Are breaking changes identified?
- Is migration guidance provided for breaking changes?

### Common anti-patterns

- **Missing error responses:** Only happy path defined.
- **Vague descriptions:** "Returns the user" without specifying format.
- **Inconsistent naming:** `userId` in one place, `user_id` in another.
- **Missing examples:** Schemas without example values.
- **Overloaded endpoints:** One endpoint doing too many things.
- **Undocumented constraints:** Validation rules not in the schema.

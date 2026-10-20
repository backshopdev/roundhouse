---
name: contract-design
description: Use when making decisions about contract design. Covers general contract design principles, decision-making, when to use contracts, and contract location and authority.
---

# Contract Design

## Purpose

This skill provides guidance on designing contracts between system components.
It covers principles, decision-making, and structural conventions.

## Contract design principles

1. **Explicit over implicit.** Contracts should be machine-readable and
   unambiguous. Prefer OpenAPI, JSON Schema, or Protocol Buffers over prose
   descriptions.
2. **Consumer-oriented.** Design contracts from the consumer's perspective.
   What does the consumer need? What can the consumer reasonably validate?
3. **Versioned.** Contracts evolve. Plan for versioning from the start. Use
   semantic versioning for breaking changes.
4. **Minimal.** Include only what is necessary. Every field is a commitment.
   Removing a field is a breaking change; adding a required field is a breaking
   change.
5. **Testable.** Contracts should be validateable. Provide examples and schemas
   that can be checked automatically.

## When to use contracts

Use explicit contracts when:

- Two or more components communicate across a boundary (process, team,
  deployment).
- The interface is public or shared.
- Multiple consumers depend on the interface.
- The interface is likely to evolve.

Informal agreements (conventions, comments) are sufficient when:

- The boundary is internal to a single module.
- There is exactly one producer and one consumer in the same codebase.
- The interface is trivial and unlikely to change.

## Contract location and authority

- Contracts live in `docs/contracts/`.
- Each contract has a stable ID (`CON-YYYYMMDD-NN`).
- The contract document is the authority for the interface.
- Generated code (OpenAPI clients, schema validators) is derived from the
  contract, not the other way around.
- If generated code and the contract disagree, the contract is correct.

## Contract types

- **API contracts:** REST, gRPC, GraphQL — defined in OpenAPI or similar.
- **Data contracts:** Schemas for stored data — defined in JSON Schema.
- **Event contracts:** Message schemas for async communication — defined in
  JSON Schema or similar.
- **Configuration contracts:** Expected configuration shape — defined in JSON
  Schema.

## Decision-making

When designing a contract, decide:

1. **Synchronous or asynchronous?** Does the consumer wait for a response?
2. **Request-response or event-driven?** Does the producer know the consumer?
3. **Schema-first or code-first?** Do you write the contract first and generate
   code, or write code and extract the contract?
4. **Versioning strategy?** How do you handle breaking changes?
5. **Validation level?** What is validated at the boundary vs. internally?

Document these decisions in a decision record.

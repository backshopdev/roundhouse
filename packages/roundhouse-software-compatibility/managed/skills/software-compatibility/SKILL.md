---
name: api-compatibility
description: Use when a task involves API versioning, breaking changes, compatibility review, or contract diffing. Provides foundational API compatibility guidance.
---

# API Compatibility

## Expert stance

APIs are contracts. Once published, consumers depend on them. Changing an API
is not just a code change; it is a coordination event that affects every
consumer. Manage compatibility deliberately.

## Versioning strategies

### URI versioning

Include the version in the URL path: `/v1/users`, `/v2/users`.

- **Pros:** Explicit, easy to route, easy to understand.
- **Cons:** URL changes, harder to maintain multiple versions.

### Header versioning

Include the version in a custom header: `API-Version: 2`.

- **Pros:** Clean URLs, flexible.
- **Cons:** Less visible, harder to cache.

### Content negotiation

Use the `Accept` header: `Accept: application/vnd.myapi.v2+json`.

- **Pros:** RESTful, standards-based.
- **Cons:** Complex, hard to understand for non-experts.

### Semantic versioning

Use semver (major.minor.patch) for library APIs:

- **Major:** Breaking changes.
- **Minor:** New functionality, backward compatible.
- **Patch:** Bug fixes, backward compatible.

## Breaking changes

A breaking change is any change that causes existing consumers to fail or
behave incorrectly.

### Breaking changes include

- Removing an endpoint.
- Removing a field from a response.
- Adding a required field to a request.
- Changing the type of a field.
- Changing the meaning of a field.
- Changing the format of a field (e.g., date format).
- Changing error codes or messages.
- Changing authentication or authorization rules.

### Non-breaking changes include

- Adding a new endpoint.
- Adding an optional field to a request.
- Adding a field to a response.
- Adding a new optional query parameter.
- Loosening validation (accepting more input).

## Compatibility review

Before releasing an API change, review for compatibility:

1. **List all changes.** What endpoints, fields, parameters, or behaviors
   changed?
2. **Classify each change.** Breaking or non-breaking?
3. **Identify affected consumers.** Who uses the changed API?
4. **Assess impact.** What happens to consumers if they do not update?
5. **Plan migration.** How will consumers transition?
6. **Communicate.** Notify consumers of breaking changes with advance notice.

## Contract diffing

Compare API contracts to detect changes:

- Use OpenAPI diff tools to compare specifications.
- Review every change for compatibility.
- Document breaking changes in release notes.
- Provide migration guides for breaking changes.

## Deprecation

When retiring an API:

1. **Announce deprecation.** Notify consumers with advance notice (e.g., 6
   months).
2. **Mark as deprecated.** Use `deprecated: true` in OpenAPI, add deprecation
   headers.
3. **Provide migration path.** Document how to migrate to the new API.
4. **Monitor usage.** Track how many consumers still use the deprecated API.
5. **Sunset.** Remove the API after the deprecation period.

## Warning signs

- Silent breaking changes (no version bump, no announcement).
- Undocumented API changes.
- Multiple incompatible versions running simultaneously without migration plan.
- Consumers surprised by API changes.
- No deprecation process.

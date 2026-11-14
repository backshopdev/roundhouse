---
name: lang-javascript
description: Use when a task involves JavaScript or TypeScript. Provides foundational guidance on modern JavaScript patterns, the TypeScript type system, async programming, error handling, and testing approaches.
---

# JavaScript and TypeScript

## Expert stance

Apply modern JavaScript (ES2020+) best practices, with TypeScript's static
types where the project uses them. JavaScript is a multi-paradigm language used
in browsers, servers (Node.js), and beyond; TypeScript adds static types that
catch errors at compile time and improve developer experience. The JavaScript
discipline is the base; the TypeScript discipline layers on top of it.

## Core concepts

### Variables and types

- Use `const` by default; `let` when reassignment is needed; avoid `var`.
- Prefer primitive types; use objects and arrays for structured data.
- Use `typeof`, `instanceof`, and `Array.isArray()` for type checks.
- Understand type coercion; prefer explicit conversion.

### Type annotations (TypeScript)

- Annotate function parameters and return types.
- Let TypeScript infer types when obvious.
- Use `interface` for object shapes; use `type` for unions, intersections, and
  aliases.
- Avoid `any`; use `unknown` when the type is truly unknown.

### Interfaces vs. types (TypeScript)

- **Interfaces:** Extendable, good for object shapes, support declaration
  merging.
- **Types:** More flexible, support unions, intersections, mapped types,
  conditional types.
- Prefer `interface` for public APIs; use `type` for complex type logic.

### Functions

- Prefer arrow functions for callbacks and short functions.
- Use default parameters instead of `||` for defaults.
- Use rest parameters (`...args`) for variadic functions.
- Use destructuring for function parameters.

### Async programming

- Use `async/await` for asynchronous code; it is clearer than callbacks or
  `.then()` chains.
- Handle errors with `try/catch` in async functions.
- Use `Promise.all()` for parallel operations.
- Use `Promise.race()` for timeouts.
- Avoid mixing callbacks and promises.

### Error handling

- Throw errors for exceptional conditions; do not use errors for control flow.
- Use custom error classes for domain-specific errors.
- Always handle promise rejections (unhandled rejections crash Node.js).
- Use error boundaries in React.

### Modules

- Use ES modules (`import`/`export`) for new code.
- Use CommonJS (`require`/`module.exports`) only when required by the
  environment.
- Avoid circular dependencies.

### Generics (TypeScript)

- Use generics for reusable, type-safe functions and components.
- Constrain generics with `extends` when needed.
- Use generic defaults for common cases.

```typescript
function identity<T>(value: T): T {
  return value;
}

function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### Utility types (TypeScript)

- `Partial<T>`: All properties optional.
- `Required<T>`: All properties required.
- `Readonly<T>`: All properties read-only.
- `Pick<T, K>`: Select a subset of properties.
- `Omit<T, K>`: Exclude a subset of properties.
- `Record<K, V>`: Object with keys K and values V.

### Narrowing (TypeScript)

- Use type guards (`typeof`, `instanceof`, `in`) to narrow types.
- Use discriminated unions for state machines.
- Use assertion functions for runtime checks.

## Best practices

- Use strict mode (`"use strict"` or ES modules).
- Prefer immutability; avoid mutating objects and arrays.
- Use `Map` and `Set` for key-value collections and unique values.
- Use optional chaining (`?.`) and nullish coalescing (`??`).
- Use `for...of` for iterables; avoid `for...in` for arrays.
- Lint with ESLint; format with Prettier.
- Enable `strict` mode in `tsconfig.json` (TypeScript).
- Use `const` assertions (`as const`) for literal types (TypeScript).
- Use template literal types for string patterns (TypeScript).
- Avoid type assertions (`as`); prefer type guards (TypeScript).
- Use `satisfies` operator for validation without widening (TypeScript).
- Keep types close to their usage; avoid global type files (TypeScript).

## Testing

- **Unit tests:** Jest, Vitest, or Node.js built-in test runner.
- **Assertion libraries:** Built-in `assert`, Chai, or Jest matchers.
- **Mocking:** `jest.mock()`, `vi.mock()`, or manual mocks.
- **Coverage:** Aim for meaningful coverage, not 100%.
- Test behavior, not implementation.
- Use `ts-jest` or `vitest` for TypeScript-aware testing (TypeScript).
- Test type-level logic with `tsd` or `expectType` (TypeScript).
- Type-check tests; do not use `@ts-ignore` in tests (TypeScript).

## Common patterns

- **Factory functions:** Create objects without `new`.
- **Module pattern:** Encapsulate state with closures.
- **Observer pattern:** Event emitters for pub-sub.
- **Middleware pattern:** Compose functions (Express, Koa).
- **Branded types:** Prevent mixing similar types, e.g. `UserId` vs. `OrderId`
  (TypeScript).
- **Builder pattern:** Chainable, type-safe object construction (TypeScript).
- **Result type:** Explicit error handling without exceptions (TypeScript).
- **Tagged unions:** Model state machines with discriminated unions
  (TypeScript).

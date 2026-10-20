---
name: design-for-testability
description: Use when a task involves testable design, constructor injection, replaceable collaborators, or characterization tests for legacy code. Provides foundational testability guidance.
---

# Design for Testability

## Expert stance

Testability is a design property, not a testing technique. Code that is easy to
test is easy to understand, change, and maintain. Design for testability from
the start; retrofitting tests is expensive and often incomplete.

## Testable design principles

### Constructor injection

Pass dependencies through the constructor, not through global state or direct
instantiation.

```javascript
// Bad: hard to test
class OrderService {
  process(order) {
    const db = new Database(); // hidden dependency
    db.save(order);
  }
}

// Good: testable
class OrderService {
  constructor(db) {
    this.db = db; // injected dependency
  }
  process(order) {
    this.db.save(order);
  }
}
```

### Replaceable collaborators

Use interfaces (or duck typing in dynamic languages) so dependencies can be
replaced with test doubles.

```javascript
// Interface (explicit or implicit)
interface PaymentGateway {
  charge(amount, card): Promise<Receipt>;
}

// Production implementation
class StripeGateway implements PaymentGateway { ... }

// Test double
class FakeGateway implements PaymentGateway { ... }
```

### Pure functions

Prefer functions with no side effects. Pure functions are trivially testable:
same input, same output, no setup required.

```javascript
// Pure: easy to test
function calculateTax(amount, rate) {
  return amount * rate;
}

// Impure: harder to test
function calculateTax(amount) {
  const rate = fetchCurrentTaxRate(); // hidden dependency
  return amount * rate;
}
```

### Deterministic behavior

Avoid randomness, time-dependent logic, and external state in core logic.
Inject these as dependencies.

```javascript
// Bad: non-deterministic
function generateId() {
  return Math.random().toString(36);
}

// Good: deterministic, injectable
class IdGenerator {
  generate() { ... }
}

// Production: real random
class RandomIdGenerator implements IdGenerator { ... }

// Test: predictable
class SequentialIdGenerator implements IdGenerator { ... }
```

## Testing legacy code

Legacy code is code without tests. Adding tests to legacy code is challenging
because it was not designed for testability.

### Characterization tests

When you cannot easily unit test legacy code, write characterization tests:

1. Call the code with specific input.
2. Observe the output.
3. Assert the output matches (even if you do not understand why).
4. Use these tests as a safety net while refactoring.

Characterization tests capture actual behavior, not intended behavior. They
tell you "this is what the code does," which is the starting point for
understanding and improving it.

### Breaking dependencies

To test legacy code, you must break its dependencies:

1. Identify the dependency (global state, direct instantiation, singleton).
2. Introduce an interface or seam.
3. Inject the dependency.
4. Replace with a test double.

This is refactoring. Do it in small, safe steps, verified by characterization
tests.

### Sprout and wrap

- **Sprout:** Add new, testable code alongside legacy code. Call the new code
  from the legacy code.
- **Wrap:** Create a testable wrapper around legacy code. Call the wrapper
  instead of the legacy code directly.

## Warning signs

- **Constructor creates dependencies:** `new Database()` inside a constructor.
- **Global state:** Singletons, module-level variables, environment variables.
- **Static methods:** Hard to override in tests.
- **Side effects in getters:** Reading a property changes state.
- **Time-dependent logic:** `new Date()` scattered throughout the code.
- **Random behavior:** `Math.random()` in business logic.

## Specialization

For legacy-code enablement scenarios where current structure blocks normal testing techniques, see the `test-enablement` skill. It specializes this skill's guidance for Feathers-style seams (characterization tests, dependency breaking, sprout and wrap) and is loaded only when normal testing techniques are insufficient.

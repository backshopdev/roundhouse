---
name: software-design
description: Use when a task involves SOLID principles, deep modules, information hiding, or local reasoning. Provides foundational design guidance.
---

# Software Design

## Expert stance

Apply design judgment to create modules that are easy to understand, change,
and test. Good design hides complexity behind simple interfaces. Bad design
leaks complexity into every caller.

## SOLID pragmatically

### Single Responsibility Principle

A module should have one, and only one, reason to change.

- **Pragmatic interpretation:** A class or module should be responsible to one
  stakeholder. If two people want it changed for different reasons, it has two
  responsibilities.
- **Application:** Split classes that serve multiple masters. Extract
  interfaces that represent distinct responsibilities.

### Open-Closed Principle

Modules should be open for extension but closed for modification.

- **Pragmatic interpretation:** You should be able to add new behavior without
  changing existing code.
- **Application:** Use abstractions (interfaces, abstract classes) to allow new
  implementations. Use strategy pattern, decorator pattern, or plugin
  architecture.

### Liskov Substitution Principle

Subtypes must be substitutable for their base types.

- **Pragmatic interpretation:** If you replace a base class with a subclass,
  the program should still work correctly.
- **Application:** Do not weaken preconditions or strengthen postconditions in
  subtypes. Do not throw exceptions that the base type does not throw.

### Interface Segregation Principle

Many specific interfaces are better than one general-purpose interface.

- **Pragmatic interpretation:** Clients should not depend on methods they do
  not use.
- **Application:** Split fat interfaces into smaller, role-specific interfaces.
  Prefer composition over inheritance.

### Dependency Inversion Principle

Depend on abstractions, not concretions.

- **Pragmatic interpretation:** High-level policy should not depend on
  low-level detail. Both should depend on abstractions.
- **Application:** Define interfaces in the high-level module; implement them in
  the low-level module. Use dependency injection.

## Deep modules

A good module provides powerful functionality behind a simple interface. The
interface is the "tip of the iceberg"; the implementation is the deep, hidden
part.

- **Shallow module:** Interface is almost as complex as the implementation.
  Little value added.
- **Deep module:** Simple interface hides complex implementation. High
  value-to-complexity ratio.

Design for depth: hide complexity, provide simple abstractions.

## Information hiding

Each module should encapsulate a design decision and hide it from other
modules.

- **What to hide:** Implementation details, data structures, algorithms,
  ordering assumptions.
- **What to expose:** Only what is necessary for clients to use the module.
- **Benefit:** Changes to hidden details do not affect clients.

## Local reasoning

A developer should be able to understand a module without reading other
modules.

- **Clear interfaces:** The interface tells you everything you need to know to
  use the module.
- **Minimal dependencies:** The module depends on few other modules.
- **Self-contained:** The module's behavior is determined by its own code, not
  by distant configuration or state.

## Testability

Design for testability:

- **Constructor injection:** Pass dependencies through the constructor.
- **Replaceable collaborators:** Use interfaces so dependencies can be mocked.
- **Pure functions:** Prefer functions with no side effects.
- **Deterministic behavior:** Same input produces same output.

## Warning signs

- **God class:** Too many responsibilities, too many dependencies.
- **Feature envy:** A method uses another class's data more than its own.
- **Data clump:** The same group of data appears everywhere.
- **Long parameter list:** Too many parameters indicate missing abstraction.
- **Inappropriate intimacy:** Classes are too dependent on each other.

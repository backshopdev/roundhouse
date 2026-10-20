---
name: react
description: Use when a task involves React. Provides foundational guidance on React patterns, component design, state management, hooks, and testing approaches.
---

# React

## Expert stance

Apply React best practices for building user interfaces. React is a library for
building component-based UIs with a unidirectional data flow.

## Core concepts

### Components

- **Function components:** Prefer function components with hooks.
- **Props:** Pass data down; never mutate props.
- **Composition:** Prefer composition over inheritance.
- **Lifting state:** Move shared state to the nearest common ancestor.

### Hooks

- `useState`: Local component state.
- `useEffect`: Side effects (data fetching, subscriptions).
- `useContext`: Share data without prop drilling.
- `useReducer`: Complex state logic.
- `useMemo`: Memoize expensive computations.
- `useCallback`: Memoize functions.
- `useRef`: Mutable values that persist across renders.

### State management

- **Local state:** `useState` for component-specific state.
- **Shared state:** Context or state libraries (Zustand, Jotai, Redux).
- **Server state:** React Query, SWR, or Apollo for data fetching.
- **Form state:** React Hook Form, Formik, or controlled components.

### Rendering

- **Conditional rendering:** Use ternary operators or `&&` for simple cases.
- **List rendering:** Use `.map()` with unique `key` props.
- **Fragments:** Use `<>...</>` to group elements without extra DOM nodes.

## Best practices

- Keep components small and focused.
- Extract custom hooks for reusable logic.
- Avoid unnecessary re-renders with `React.memo`, `useMemo`, `useCallback`.
- Handle loading, error, and empty states explicitly.
- Use TypeScript for prop types and state types.
- Prefer declarative over imperative code.

## Testing

- **Unit tests:** Test components in isolation with React Testing Library.
- **Integration tests:** Test component interactions.
- **E2E tests:** Test user workflows with Playwright or Cypress.
- **Snapshot tests:** Use sparingly; prefer behavioral assertions.
- Test behavior, not implementation details.

## Common patterns

- **Compound components:** Share state between related components.
- **Render props:** Pass rendering logic as a function.
- **Higher-order components:** Wrap components to add behavior (prefer hooks).
- **Controlled vs. uncontrolled:** Prefer controlled components for forms.
- **Error boundaries:** Catch rendering errors gracefully.

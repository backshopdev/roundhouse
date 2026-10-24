---
name: lang-css
description: Use when a task involves CSS. Provides foundational guidance on CSS architecture, selectors, layout, responsive design, and maintainability.
---

# CSS

## Expert stance

Apply CSS best practices for maintainable, scalable stylesheets. CSS is the
language for styling web pages; its architecture decisions compound across
every component a project ships.

## Core concepts

### CSS architecture

- **BEM (Block-Element-Modifier):** `.block__element--modifier` naming.
- **ITSS (Inception, Transformation, State, Theme):** Layered architecture.
- **Cube CSS:** Composition, utility blocks, exceptions.
- **Utility-first:** Tailwind CSS approach.

Choose an architecture that fits the project scale and team.

### Selectors

- Prefer class selectors over element or ID selectors.
- Avoid overly specific selectors (e.g., `div.container ul li a`).
- Use descendant combinators sparingly.
- Use `:is()` and `:where()` for complex selectors.

### Layout

- **Flexbox:** One-dimensional layouts (rows or columns).
- **Grid:** Two-dimensional layouts (rows and columns).
- **Container queries:** Style based on container size, not viewport.
- **Logical properties:** Use `margin-inline-start` instead of `margin-left`.

### Responsive design

- Use mobile-first approach (min-width media queries).
- Use relative units (`rem`, `em`, `%`, `vw`, `vh`).
- Use `clamp()` for fluid typography.
- Test at multiple breakpoints.

## Best practices

- Use CSS custom properties (variables) for theming.
- Avoid `!important`; increase specificity instead.
- Avoid inline styles; use classes.
- Use `box-sizing: border-box` globally.
- Reset or normalize browser defaults.
- Lint with Stylelint.

## Testing

- Visual regression testing with Playwright, Percy, or Chromatic.
- Snapshot testing for component styles.
- Test at multiple viewports.
- Test with high-contrast mode and dark mode.

## Common patterns

- **Stack:** Vertical spacing between elements.
- **Cluster:** Horizontal grouping of elements.
- **Switcher:** Responsive layout that switches between row and column.
- **Repel:** Space-between layout with wrapping.

## Sass

When the project uses Sass, apply the specialization guidance in
`lang-css-sass` (variables, nesting, mixins, functions, partials, and the
`@use`/`@forward` module system) on top of this base.

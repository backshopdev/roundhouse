---
name: lang-css-sass
description: Use when a task involves Sass specifically. Specializes lang-css with the Sass layer — variables, nesting, mixins, functions, partials, and the @use/@forward module system.
---

# CSS Sass

## Expert stance

Apply Sass best practices on top of the CSS base (`lang-css`). Sass adds
variables, nesting, and mixins to CSS; use them to reduce duplication, not to
replace CSS judgment.

## Sass features

- **Variables:** `$color-primary: #007bff;`
- **Nesting:** Nest selectors, but limit depth to 3 levels.
- **Mixins:** Reusable style blocks with parameters.
- **Functions:** Custom functions for calculations.
- **Partials:** Split styles into `_partial.scss` files.
- **Import:** Use `@use` and `@forward` (not `@import`).

## Sass-specific judgment

- Nesting depth is the classic Sass failure mode: keep it shallow and prefer
  flat class selectors (the `lang-css` selector rules still apply).
- Variables and mixins are for genuine reuse; a mixin used once is a
  distraction.
- `@use`/`@forward` give explicit module boundaries — one namespace per
  partial, no implicit global cascade of imports.
- Compiled output is still CSS: audit it with the `lang-css` best practices
  (specificity, `!important`, inline styles) rather than trusting the source
  to be clean.

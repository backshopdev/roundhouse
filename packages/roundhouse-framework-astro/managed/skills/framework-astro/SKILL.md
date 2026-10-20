---
name: astro
description: Use when a task involves Astro. Provides foundational guidance on Astro patterns, component islands, content collections, and build optimization.
---

# Astro

## Expert stance

Apply Astro best practices for content-focused websites. Astro is a static site
generator that supports multiple frontend frameworks through component islands.

## Core concepts

### Component islands

Astro renders HTML at build time by default. Interactive components ("islands")
are hydrated on the client:

- Use `client:load`, `client:visible`, `client:idle` to control hydration.
- Default to no client JavaScript; hydrate only when necessary.
- Mix frameworks (React, Vue, Svelte) in the same project.

### Content collections

Organize content in `src/content/`:

- Define schemas with Zod for type safety.
- Use Markdown and MDX for content.
- Query content with the Content Collections API.
- Validate content at build time.

### Layouts

Create reusable page layouts:

- Define a default layout in `src/layouts/`.
- Pass content via slots.
- Use frontmatter to configure layouts.

### Routing

Astro uses file-based routing:

- `src/pages/index.astro` → `/`
- `src/pages/about.astro` → `/about`
- `src/pages/blog/[slug].astro` → `/blog/:slug` (dynamic route)

## Best practices

- Prefer static rendering; use SSR only when necessary.
- Use `<Image />` component for automatic optimization.
- Use `Astro.fetchContent()` or Content Collections for data.
- Minimize client-side JavaScript.
- Use view transitions for SPA-like navigation.

## Testing

- Test components with framework-specific tools (React Testing Library, etc.).
- Test builds with `astro build` and check output.
- Use Playwright for end-to-end testing.
- Validate content schemas at build time.

## Common patterns

- **MDX:** Use MDX for interactive content with embedded components.
- **RSS:** Generate RSS feeds from content collections.
- **Sitemap:** Use `@astrojs/sitemap` for automatic sitemap generation.
- **i18n:** Use dynamic routes for multi-language sites.

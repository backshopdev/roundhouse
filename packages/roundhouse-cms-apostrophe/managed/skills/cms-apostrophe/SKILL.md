---
name: apostrophe-cms
description: Use when a task involves ApostropheCMS. Provides foundational guidance on ApostropheCMS patterns, widget and module design, templating, and testing approaches.
---

# ApostropheCMS

## Expert stance

Apply ApostropheCMS best practices for content management, widget design, and
template authoring. ApostropheCMS is a Node.js CMS built on MongoDB with a
focus on in-context editing and structured content.

## Core concepts

### Modules

Everything in ApostropheCMS is a module. Modules define content types, widgets,
pages, and services.

- **Piece types:** Structured content (blog posts, products, events).
- **Page types:** Templates for pages (home, article, landing).
- **Widgets:** Reusable content blocks (rich text, image, slideshow).
- **Services:** Backend logic (APIs, background tasks).

### Templates

ApostropheCMS uses Nunjucks templates:

- Keep templates thin; push logic into modules.
- Use `area` and `singleton` for editable regions.
- Use `apos.image` for responsive images.
- Use macros for reusable template fragments.

### Widgets

Widgets are the building blocks of page content:

- Define the widget schema (fields the editor fills in).
- Provide a template for rendering the widget.
- Keep widgets focused and composable.
- Test widgets in isolation with mock data.

## Best practices

- Use `apos.hardened` for user-generated content to prevent XSS.
- Use projections to limit MongoDB queries to needed fields.
- Use `apos.task` for background jobs.
- Use `apos.http` for external API calls.
- Configure caching for expensive queries.

## Testing

- Test piece modules with `apos.test`.
- Test widgets with fixture data.
- Test API routes with supertest.
- Use `apos.db` for test database setup and teardown.

## Common patterns

- **Relationships:** Use `relationship` fields to link pieces.
- **Projections:** Limit query fields for performance.
- **Permissions:** Use piece-level and field-level permissions.
- **Migrations:** Use `apos.migration` for schema changes.

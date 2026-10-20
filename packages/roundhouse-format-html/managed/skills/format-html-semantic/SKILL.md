---
name: semantic-html
description: Use when a task involves HTML structure. Provides foundational guidance on semantic HTML, document outline, ARIA, and accessibility.
---

# Semantic HTML

## Expert stance

Apply semantic HTML best practices. Semantic HTML conveys meaning and structure
to browsers, assistive technologies, and search engines. It is the foundation
of accessible, maintainable web pages.

## Core concepts

### Document structure

- Use `<header>`, `<nav>`, `<main>`, `<footer>` for page regions.
- Use `<article>` for self-contained content.
- Use `<section>` for thematic grouping.
- Use `<aside>` for tangential content.
- Use one `<h1>` per page; use `<h2>`–`<h6>` for subsections.

### Text content

- Use `<p>` for paragraphs.
- Use `<strong>` for important text (not just bold).
- Use `<em>` for emphasized text (not just italic).
- Use `<mark>` for highlighted text.
- Use `<time>` for dates and times with `datetime` attribute.
- Use `<abbr>` for abbreviations with `title` attribute.

### Lists

- Use `<ul>` for unordered lists.
- Use `<ol>` for ordered lists.
- Use `<dl>` for definition lists (term-description pairs).
- Nest lists for hierarchical content.

### Links and navigation

- Use `<a>` for hyperlinks with meaningful link text.
- Use `rel` attributes for external links (`rel="noopener noreferrer"`).
- Use `href="#"` only for JavaScript-triggered actions (prefer `<button>`).
- Use skip links for keyboard navigation.

### Forms

- Use `<label>` for every input, linked with `for` attribute.
- Use `<fieldset>` and `<legend>` for grouped inputs.
- Use appropriate `type` attributes (`email`, `tel`, `url`, `number`).
- Use `required`, `pattern`, `min`, `max` for validation.
- Use `<button type="submit">` for form submission.

### Media

- Use `<img>` with meaningful `alt` text.
- Use `<figure>` and `<figcaption>` for images with captions.
- Use `<video>` and `<audio>` with fallback content.
- Use `<picture>` and `<source>` for responsive images.

## Best practices

- Write valid HTML; validate with the W3C validator.
- Use the minimum markup needed; avoid div soup.
- Keep markup shallow; avoid unnecessary nesting.
- Use ARIA only when semantic HTML is insufficient.
- Test with screen readers and keyboard navigation.

## ARIA

- Prefer semantic HTML over ARIA.
- Use `role`, `aria-label`, `aria-labelledby`, `aria-describedby` when needed.
- Do not change ARIA roles dynamically unless necessary.
- Test ARIA with assistive technologies.

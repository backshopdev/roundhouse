---
name: software-accessibility
description: Use when a task involves accessibility requirements or inclusive design. Provides the technology-agnostic base — accessibility as a quality attribute, inclusive design judgment, and assistive-technology testing practice.
---

# Software Accessibility

## Expert stance

Apply inclusive design judgment. Accessibility is not a feature; it is a
quality attribute that affects all users. Design for the widest range of
abilities from the start, regardless of the technology surface.

## Inclusive design practices

- Involve users with disabilities in design and testing.
- Test with assistive technologies, not only with default configurations.
- Test with keyboard-only navigation wherever input is possible.
- Test with zoom and high-contrast modes wherever rendering is configurable.
- Use automated accessibility checkers (axe, Lighthouse) but do not rely on
  them alone — automated coverage is a floor, not the practice.
- Treat accessibility findings as quality defects, not enhancement requests.

## General warning signs

- Interaction paths that assume one input modality.
- Information conveyed by a single sensory channel (color alone, sound alone).
- Time-limited content without an extension mechanism.
- Missing error identification or recovery paths.
- Custom components that bypass the platform's accessibility machinery.

## Web-bound work

When the surface is web technology, apply the specialization guidance in
`software-accessibility-web`: the WCAG conformance baseline, semantic HTML and
ARIA requirements, and the web-specific testing and pattern guidance.

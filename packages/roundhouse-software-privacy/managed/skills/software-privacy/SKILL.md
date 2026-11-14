---
name: software-privacy
description: Use when a task involves privacy considerations, data lifecycle, data minimization, user rights, or consent. Provides foundational privacy guidance for systems that process personal data.
---

# Software Privacy

## Expert stance

Apply privacy judgment. Personal data carries obligations beyond its
engineering utility: collect the minimum, retain it for the shortest defensible
period, and honor the user's rights over it. Privacy is a design property, not
an afterthought.

## Privacy considerations

### Data lifecycle

- What personal data is collected?
- What is the legal basis for processing?
- How long is data retained?
- How is data disposed of?

### Data minimization

- Is all collected data necessary?
- Can data be pseudonymized or anonymized?
- Are there fewer data collection points?

### User rights

- Can users access their data?
- Can users correct their data?
- Can users delete their data?
- Can users export their data?

### Consent

- Is consent obtained before collecting data?
- Can consent be withdrawn?
- Is consent granular (not all-or-nothing)?

## Warning signs

- Personal data collected "because we might need it later".
- Retention periods undefined or indefinite.
- Deletion requests with no executable path.
- Consent bundled into terms of service (all-or-nothing).
- Personal data replicated into logs, caches, or analytics without a lifecycle.
- Pseudonymization confused with anonymization.

## Security-bound work

When the task concerns threat modeling, authentication, authorization, data
protection, or secrets management, apply the companion guidance in
`software-security`.

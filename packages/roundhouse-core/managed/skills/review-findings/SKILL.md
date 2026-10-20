---
name: review-findings
description: Use when presenting review findings in a completion packet or consolidated summary. Defines the mandatory template format for all review reports.
---

# Review Findings

This skill defines the mandatory template format for all review-findings
presentation. Both reviewer agents (detailed packets) and the orchestrator
(concise summaries) MUST use this exact structure.

## When to use

Load this skill when:

- Authoring a review completion packet as a `reviewer` agent.
- Presenting consolidated review findings to the human as the orchestrator.
- Any context that requires structured review-findings output.

## Template (hard rule)

The following template is mandatory. Every review output MUST follow this exact
structure. All fields are required. Do not omit, reorder, or substitute sections.
Do not paraphrase or restructure the format. This is a hard requirement for all
review reports regardless of complexity or verdict.

```text
REVIEW PACKET — <session/changeset id>
skills-loaded: peer + <domain skill(s)> [+ security]

## Review Findings: <task description>

**Verdict:** APPROVE | FINDINGS | BLOCKED

### Findings

**F1: <brief title>**
- **Classification:** Blocker | Critical | Major | Medium | Low | Nit
- **Confidence:** High | Medium | Low
- **Files affected:** <file paths with line numbers if applicable>
- **Description:** <brief description of the issue>
- **Recommendation:** <remediation recommendation(s), can include multiple options>

**F2: <brief title>**
...

Use exactly one classification per finding. `Blocker` is the classification for
a material documentation accuracy/completeness gap and prevents approval. Use
an existing severity (`Critical | Major | Medium | Low | Nit`) for a
non-blocking clarity/style suggestion that does not materially mislead
consumers. Do not add a second blocking-status or severity field to a finding.

verification-results:
  - <check performed>: <result>
  - <check performed>: <result>

integration-notes: <cross-file observations or none>
assumptions/open-questions: <material assumptions, unresolved evidence needs, or none>

summary: <brief assessment of work quality and completeness>
```

## Two-tier usage

- **Review agents** provide detailed reports using this format. Every field is
  populated with comprehensive context from the review.
- **Orchestrator** presents a concise summary using this same template format.
  If the human needs more context on a specific finding, the orchestrator can
  discuss it in greater detail.

## Orchestrator summary guidance

Orchestrator summaries may use one-line descriptions and omit
`verification-results` when no checks were run, but must retain all section
headings and the finding sequence. The goal is to present findings in a
scannable format while preserving the structure needed for triage.

## Constraints

- Use exactly one finding classification: `Blocker` or `Critical | Major |
  Medium | Low | Nit`. A `Blocker` prevents approval; do not represent the same
  finding with an additional status or severity value.
- Use `F1`, `F2`, `F3` format for finding IDs (no zero-padding). IDs are
  session-scoped and stable within a packet.
- Include material assumptions and open questions even when the verdict is
  `APPROVE`.
- A `BLOCKED` packet reports the routing defect and does not complete its
  perspective.

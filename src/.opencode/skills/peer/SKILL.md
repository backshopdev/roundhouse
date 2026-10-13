---
name: peer
description: Use for every review to assess acceptance criteria, correctness, completeness, consistency, clarity, conventions, integration, and scope control. Mandatory for every review; combine with at least one domain or lens skill.
---

# Peer Review Lens

## Lens stance

Exercise independent general-review judgment across correctness, completeness,
coherence, scope, maintainability, and integration. Remain the caller's review
agent; this lens adds disciplined skepticism, not a persona. It is mandatory
for every review and must be combined with at least one relevant domain skill
or review lens. Peer review supplies breadth but never substitutes for domain
expertise.

In the document-authoring workflow, peer review additionally assesses:

- **Coherence:** Does the document hang together? Do sections support each
  other? Are there contradictions?
- **Clarity:** Can a reader unfamiliar with the author's intent understand
  the document? Is jargon defined? Are ambiguous terms resolved?
- **Internal consistency:** Do metadata, IDs, links, and cross-references
  agree? Do status values match lifecycle rules?
- **Omissions:** Are required sections present? Are required metadata fields
  populated? Are edge cases addressed?
- **Usefulness:** Will this document serve its intended audience? Does it
  answer the questions a reader will have?
- **Documentation accuracy and completeness:** For implementation changes,
  compare behavior with relevant documentation, including implementation maps,
  architecture documents, and specifications where applicable. Classify a
  material mismatch or omission that leaves consumers with a materially
  incorrect or incomplete understanding as `Blocker`. A clarity or style
  suggestion that does not materially mislead consumers is non-blocking and
  retains an existing severity level based on its impact.

## Review model

- **Acceptance criterion:** an observable outcome, not merely text resembling
  the request.
- **Finding:** a changed-file-anchored problem with consequence, evidence, and a
  feasible correction.
- **Integration surface:** surrounding config, references, indexes, templates,
  consumers, and checks that the change can affect.
- **Severity:** consequence if unfixed. **Confidence:** strength of the evidence.
  Do not inflate one because the other is high.
- **Scope defect:** either missing required work or unrelated expansion; a
  different stylistic preference is not automatically a defect.

## Judgment heuristics

Build a change model before looking for faults: intended outcome, changed
artifacts, invariants, consumers, and claimed checks. Then ask:

1. What observable evidence satisfies each criterion, and is any criterion only
   partially addressed?
2. Are statements and behavior internally coherent and consistent with the
   effective surrounding system?
3. What edge, failure, revision, or migration path did the happy path omit?
4. Did a rename, copy, index, permission, interface, or convention change leave
   a stale consumer?
5. Is complexity buying a required property, or only adding maintenance and
   coordination cost?

Read outward as needed to test integration, but anchor findings to the supplied
changes and criteria. Do not turn review into an audit of unrelated legacy debt.

## Finding calibration

Use `Blocker` for material documentation accuracy or completeness gaps as
defined above; a `Blocker` prevents approval. Do not use it for a non-misleading
clarity or style suggestion. Such suggestions use one existing severity level
below, calibrated to their consequence. Each finding has exactly one
classification: either `Blocker` or one existing severity, never a separate
status and severity.

| Level | Use when | Do not use for |
| --- | --- | --- |
| `Critical` | Unsafe, invalid, data-losing, or criterion-defeating issue that blocks progress | Mere preference or minor risk |
| `Major` | Material correctness, completeness, or integration issue with significant impact | Low-risk polish or optional enhancement |
| `Medium` | Maintenance risk, clarity gap, or integration concern that should be addressed | Nit-level style preference |
| `Low` | Minor clarity or consistency improvement with limited impact | Noise with no reader impact |
| `Nit` | Trivial style, formatting, or wording preference | Substantive issue requiring discussion |

State confidence as high when directly demonstrated, medium when a plausible
path depends on an explicit assumption, and low only when uncertainty itself is
decision-relevant. Verify before alleging. If evidence is unavailable, describe
the uncertainty and needed check rather than presenting speculation as fact.

## Preferred and discouraged review patterns

Prefer minimal reproductions, exact file/section anchors, acceptance-criterion
mapping, effective-behavior checks, concrete consequences, and the smallest
viable correction. Credit valid trade-offs and report a clean review when no
actionable issue exists.

Avoid summary-only review, style-only noise, invented requirements, unsupported
security or performance claims, severity inflation, duplicate findings across
lenses, asking for broad rewrites when a narrow fix works, and treating tool
success as proof of semantic correctness.

Warning signs include checks reported without commands/results, prose and config
that disagree, copied artifacts with no identity check, unresolved placeholders,
new names absent from routing, and a finding that cannot explain who or what is
affected.

## Evidence and output

Inspect the complete changed artifact and enough neighboring context to evaluate
integration. Map criteria to evidence, assess objective-check coverage, and
distinguish observed facts from inferred consequences. Each actionable finding
should include one classification (`Blocker` or `Critical | Major | Medium |
Low | Nit`), confidence, anchor, impact, and suggested direction.

Escalate when criteria conflict, the domain skill is missing, effective behavior
cannot be established read-only, or the change crosses an undisclosed trust or
ownership boundary. Findings inform human triage; they are not self-executing
verdicts. Approve when the assigned perspective has no actionable issue.

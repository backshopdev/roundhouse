---
name: investigation
description: Use when material uncertainty arises that could challenge, invalidate, or expand approved plan or specification assumptions. Performs read-only investigation; preserves context for future sessions.
---

# Investigation

This is a read-only investigation skill for material uncertainty capable of
challenging approved assumptions. It is distinct from routine exploration
within approved scope. The investigation is performed by the calling agent
under a tight read-only discipline; the skill itself supplies structure,
preserves knowledge, and standardizes the Discovery Request shape returned to
the orchestrator or planning layer.

## When to use

- An uncertainty could expand, invalidate, or fundamentally alter the
  approved plan or specification.
- A code area is inadequately documented and must be understood before
  further work.
- A discovery during implementation changes the operating context for the
  work.
- DO NOT load for routine exploration (reading files, checking docs,
  understanding context within approved scope) or tasks answerable from
  current skill knowledge.

## Read-only discipline (prose-only)

The calling agent must refrain, for the duration of the investigation, from:

- File edits
- Task delegation
- Webfetch (websearch remains allowed for external context)
- Bash beyond read-only git inspection (`git log`, `git show`, `git diff`)

The calling agent's permission configuration is not tightened by loading this
skill. Enforcement relies on the agent's self-discipline, peer review, and the
orchestrator's gate discipline. Any persistent side effects produced during an
investigation must be surfaced in the completion packet under `ATTENTION-FLAGS`.

## Discovery Request structure

When formal Discovery is required, return a Discovery Request with these
four elements:

- **Unknown**: the specific question or area of uncertainty.
- **Why it matters**: the consequence for the approved plan/spec.
- **Potential impact on plan/spec assumptions**: how resolution could
  change the work.
- **Proposed investigation**: the steps required to resolve the
  uncertainty, with scope and method.

## Knowledge preservation

If Discovery establishes understanding of inadequately documented code:

- Capture understanding in appropriate comments/docs while context is fresh.
- Future sessions should not need to re-purchase this understanding.
- Discovery does not authorize structural refactoring merely because code
  is difficult to read. Surface readability debt as KTLO.

## Return

Findings return in the calling agent's completion packet under the
`discovery` field. Routine exploration is NOT reported as formal Discovery.

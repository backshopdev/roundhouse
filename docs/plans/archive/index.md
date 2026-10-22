# Implementation Plans Archive

Completed and abandoned implementation plans are moved here for historical
reference.

## Parent

- [Plans](../index.md)

## Archived plans

| Title | Description | Status | Date |
|-------|-------------|--------|------|
| [Phase 1 — freeze and characterize current behavior](PLAN-20261018-01.md) | Implement the Phase 1 baseline fixture tooling, the sync-layer test-gap fill, and the baseline summary per SPEC-20261017-01. | Completed | 2026-10-19 |
| [Phase 2 — workspace scaffolding](PLAN-20261019-01.md) | Implements SPEC-20261019-01: the root conversion, the 28-package scaffold, the versionless-root smoke check, the test-suite rework, and the same-changeset fixture regeneration in one commit. | Completed | 2026-10-19 |
| [Phase 3 — composer](PLAN-20261019-02.md) | Implements SPEC-20261019-02: the 18-fixture inventory, the composer library modules, the CLI surface, the SCEN-052..066 suite, the stub-envelope migration, and the same-changeset fixture regeneration in one commit. | Completed | 2026-10-19 |
| [Phase 4 — Core decoupling and skill extraction](PLAN-20261019-03.md) | Implements the Phase 4 definition: the socratic-interview and task-planning Core skills, the grep-grounded agent-prompt and routing-table decoupling, the KTLO closure, and the same-changeset fixture regeneration in one commit. | Completed | 2026-10-19 |
| [Phase 5+6 — atomic cutover](PLAN-20261019-04.md) | Implements SPEC-20261019-03: the template instantiation, the fixture-driven moves with the rename wave, the five new packages, the composer-backed tooling wrappers, the root's self-hosting composition, the suite adaptations, and the exit-1 fixture regeneration in one commit. | Completed | 2026-10-20 |
| [Phase 9 — publishing infrastructure and CI](PLAN-20261019-06.md) | Implements the Phase 9 definition: Changesets adoption (exactly pinned, nothing published), the DR-03 check catalog as npm scripts with the check-all aggregate, the files allowlists, the thin CI workflow, the retired legacy publish workflow, and the documented deprecation command in one commit. | Completed | 2026-10-20 |
| [PR #4 review remediation — CI drift honesty, skill identity, stale references](PLAN-20261021-01.md) | Remediates the five Copilot review findings on PR #4: the CI committed-artifact drift check (`check-render`), the 21 skill frontmatter-identity fixes with composer validation and the SPEC-20261019-02 amendment (SCEN-074), the three stale-reference doc fixes, the review-lesson KTLO item, and the integration recompose/fixture/changeset — one commit on `feature/composable-workflow`. | Completed | 2026-10-21 |
| [test-commit.js real-commit hazard — case drop and startup guard](PLAN-20261021-02.md) | Closes KTLO-20261019-01: drops the hazardous inline multi-line npm-mode-a case, adds a fail-safe startup guard that skips the shell-transport subtests whenever the repo index is staged, resolves the KTLO item after the criterion run (a non-empty-index run performing no real commit), and regenerates the fixture — one commit on `feature/composable-workflow`. | Completed | 2026-10-21 |
| [Docs hygiene and retirement — the references charter, the fixture tooling's retirement, plan/spec archivals](PLAN-20261021-03.md) | Executes the ruled docs-hygiene changeset: codifies the `references/` charter (literature only) and deletes the four migration artifacts + two fixture scripts, archives three plans and two specs per the terminal patterns, rewords the live references to the retired tooling, records the SPEC-20261016-01 audit, creates two KTLO items, and retires the fixture-regeneration close discipline — one commit on `feature/composable-workflow`. | Completed | 2026-10-21 |
| [Implement GitHub Packages distribution](PLAN-20260903-01.md) | Implemented v0.5.0 GitHub Packages distribution and the full-template lifecycle per SPEC-20260903-01; shipped v0.5.1 and v0.6.0; later superseded by the package-family migration (DEC-20261017-01..04). | Completed | 2026-10-21 |
| [Standardize index.md structure across the repo](PLAN-20260904-01.md) | Aimed at codifying index row-format rules; superseded by the package-family migration — the target skill was dissolved, the index conversion landed by other means, and the codification is now KTLO-20261021-03's subject. | Superseded | 2026-10-21 |
| [Phase 7 — composition matrix](PLAN-20261019-05.md) | Implements the Phase 7 definition: the reworked seven-installation matrix with the invariant assertions and the negative dependency cases, the pre-migration comparison record, and — under the combined Phases 7-8 ruling — the residual-reference sweep and husk deletion, in one commit. Landed at 03bad7b and re-verified 2026-10-21. | Completed | 2026-10-21 |

## Template

- [Plan template](template.md) — canonical skeleton for new implementation plans.

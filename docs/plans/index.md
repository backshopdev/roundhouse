# Plans Index

Implementation plans + architecture/implementation maps. One file per plan.

| Title | Description | Status | Date |
|-------|-------------|--------|------|
| [Implement GitHub Packages full-template lifecycle v0.5.0](PLAN-20260903-01.md) | Implement v0.5.0 GitHub Packages distribution and the full-template lifecycle (`init`/`update`) for Roundhouse. | In progress | 2026-09-03 |
| [Standardize index.md structure across the repo](PLAN-20260904-01.md) | Bring every `index.md` file in the repo under a small, consistent set of patterns. | Ready | 2026-09-04 |
| [Phase 7 — composition matrix](PLAN-20261019-05.md) | Implements the Phase 7 definition: the reworked seven-installation matrix with the invariant assertions and the negative dependency cases, the pre-migration comparison record, and — under the combined Phases 7-8 ruling — the residual-reference sweep and husk deletion, in one commit. | Ready | 2026-10-20 |
| [Docs hygiene and retirement — the references charter, the fixture tooling's retirement, plan/spec archivals](PLAN-20261021-03.md) | Executes the ruled docs-hygiene changeset: codifies the `references/` charter (literature only) and deletes the four migration artifacts + two fixture scripts, archives three plans and two specs per the terminal patterns, rewords the live references to the retired tooling, records the SPEC-20261016-01 audit, creates two KTLO items, and retires the fixture-regeneration close discipline — one commit on `feature/composable-workflow`. | Ready | 2026-10-21 |

## Templates and archive

- [Plan template](template.md) — canonical skeleton for new implementation plans.
- [Plan archive](archive/index.md) — completed and abandoned plans.

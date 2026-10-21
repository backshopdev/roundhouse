# Plans Index

Implementation plans + architecture/implementation maps. One file per plan.

| Title | Description | Status | Date |
|-------|-------------|--------|------|
| [Implement GitHub Packages full-template lifecycle v0.5.0](PLAN-20260903-01.md) | Implement v0.5.0 GitHub Packages distribution and the full-template lifecycle (`init`/`update`) for Roundhouse. | In progress | 2026-09-03 |
| [Standardize index.md structure across the repo](PLAN-20260904-01.md) | Bring every `index.md` file in the repo under a small, consistent set of patterns. | Ready | 2026-09-04 |
| [Phase 7 — composition matrix](PLAN-20261019-05.md) | Implements the Phase 7 definition: the reworked seven-installation matrix with the invariant assertions and the negative dependency cases, the pre-migration comparison record, and — under the combined Phases 7-8 ruling — the residual-reference sweep and husk deletion, in one commit. | Ready | 2026-10-20 |
| [test-commit.js real-commit hazard — case drop and startup guard](PLAN-20261021-02.md) | Closes KTLO-20261019-01: drops the hazardous inline multi-line npm-mode-a case, adds a fail-safe startup guard that skips the shell-transport subtests whenever the repo index is staged, resolves the KTLO item after the criterion run (a non-empty-index run performing no real commit), and regenerates the fixture — one commit on `feature/composable-workflow`. | Ready | 2026-10-21 |

## Templates and archive

- [Plan template](template.md) — canonical skeleton for new implementation plans.
- [Plan archive](archive/index.md) — completed and abandoned plans.

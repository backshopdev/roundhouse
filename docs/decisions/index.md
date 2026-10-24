# Decision Records

| Title | Description | Status | Date |
|-------|-------------|--------|------|
| [Markdown linting via `npx`, no `package.json`](DEC-20260829-01.md) | Adopt `markdownlint-cli2` invoked via `npx` (no `package.json` install footprint) for the workflow harness's objective lint signal. | Active | 2026-08-29 |
| [Pin to Node 24 LTS](DEC-20260905-01.md) | Align `engines.node` and `.github/workflows/publish.yml` `node-version` to Node 24 LTS after GitHub Actions began deprecating Node 20 on hosted runners. | Active | 2026-09-05 |
| [Commit messages flow through a Node-based commit script](DEC-20260906-01.md) | All agentic commit messages must be written via `scripts/commit` (Node, byte-exact UTF-8) to avoid PowerShell encoding corruption that has corrupted two commits during PLAN-20260904-02 execution. | Active | 2026-09-06 |
| [Adopt composable package architecture](DEC-20261017-01.md) | Roundhouse becomes a private npm-workspace monorepo of independently versioned `@backshop/roundhouse-*` packages with a consumer CLI (`init`/`compose`/`verify`); four-agent workflow remains Core-owned; `opencode.json` becomes a composed artifact. Children: package contract, migration strategy, Phase 1 commitments. | Active | 2026-10-19 |
| [Package contract and composition rules](DEC-20261017-02.md) | Lock the package contract: naming taxonomy, kinds, layout, artifact classes (managed / seed / composed), strict ownership rules, agent path reservation to Core, normalized capability model with composer translation, `.roundhouse/manifest.json` shape. | Active | 2026-10-19 |
| [Migration strategy and ordering](DEC-20261017-03.md) | Tooling-first atomic-content-cutover across 9 phases over multiple changesets; new packages authoritative in one changeset; legacy `@backshopdev/roundhouse` publishes nothing new — softened 2026-10-19 to at most `npm deprecate` on already-published versions (no final 1.0.0 release; no known external consumers). | Active | 2026-10-19 |
| [Phase 1 commitments](DEC-20261017-04.md) | Phase 1 generates baseline fixtures (paths, SHA-256, managed/seed/root-only classification), extends `test-sync.js` with symlink/junction + path-escape + root-seed-preservation coverage, extracts Socratic into a Core `socratic-interview` skill (Phase 4), adds Core `task-planning` skill, treats existing root seed files as already-seeded. | Active | 2026-10-19 |

## Templates and archive

- [Decision template](template.md) — canonical skeleton for new decision records.
- [Decision archive](archive/index.md) — superseded and retired decision records.

One row per durable decision. Chat history is not the record — this index + the linked file are (GP02). Links are relative, same-directory only (index discipline).

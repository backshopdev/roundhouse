# Decision Records

| Title | Description | Status | Date |
|-------|-------------|--------|------|
| [Markdown linting via `npx`, no `package.json`](DEC-20260829-01.md) | Adopt `markdownlint-cli2` invoked via `npx` (no `package.json` install footprint) for the workflow harness's objective lint signal. | Active | 2026-08-29 |
| [Pin to Node 24 LTS](DEC-20260905-01.md) | Align `engines.node` and `.github/workflows/publish.yml` `node-version` to Node 24 LTS after GitHub Actions began deprecating Node 20 on hosted runners. | Active | 2026-09-05 |
| [Commit messages flow through a Node-based commit script](DEC-20260906-01.md) | All agentic commit messages must be written via `scripts/commit` (Node, byte-exact UTF-8) to avoid PowerShell encoding corruption that has corrupted two commits during PLAN-20260904-02 execution. | Active | 2026-09-06 |

One row per durable decision. Chat history is not the record — this index + the linked file are (GP02). Links are relative, same-directory only (index discipline).

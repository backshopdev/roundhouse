# Roundhouse

A reusable multi-agent workflow for [OpenCode](https://opencode.ai) for structured document authoring. The root of this repository uses the template to maintain and evolve itself.

## Overview

Human + agent collaboration produces a better whole. This workflow pairs human judgment with agent execution through:

- **Human-in-the-loop gates** at every consequential transition
- **Socratic interviewing** that surfaces assumptions before generation
- **Independent parallel review** sessions with authoritative human triage
- **Skill-based architecture** that loads expertise on demand, not all at once

Other approaches work well for their use cases. This is a deliberate choice: we believe the dialogue, gates, and review cycles produce better outcomes than autonomous generation — even when the latter is faster. The partnership itself is the value, and the speed bumps are intentional.

The reusable template lives in `src/`. The root of this repository deploys that template and uses it to maintain and evolve itself — the workflow is docs-as-code by construction.

## Installing the private package

This workflow is distributed as the private npm package
`@backshopdev/roundhouse` through GitHub Packages. Confirm the published
version with
`npm view @backshopdev/roundhouse version --registry=https://npm.pkg.github.com`.
The package
contains only the runtime files, root `README.md` and `LICENSE` package
metadata, npm metadata, and the complete
reusable `src/` template: top-level workflow guidance, consumer-intended
`scratch/`, `docs/` index/template artifacts, `ktlo/`, `.opencode/`, and
`opencode.json`. Root documentation, references, guiding principles, and
maintenance scripts are not published. The root README is included because npm
treats it as package metadata; it is not deployed to consumers. The package
allowlist is `package/`, `src/`, `README.md`, and `LICENSE` (with `package.json`
included automatically by npm), and the root `.npmignore` is intentionally
empty.
It has no `postinstall` deployment; npm installation alone never writes to a
consumer repository. Consumers explicitly run:

```bash
npx @backshopdev/roundhouse init
npx @backshopdev/roundhouse update
```

`init` creates missing template files only and reports skipped existing files.
The consumer-facing `scratch/` directory is a temporary place where agents may
save state and artifacts between sessions; it is seeded by `init` and `update`
and then left consumer-owned.
`.opencode/` is always package-owned: consumer customization there is
unsupported, and `update` intentionally overwrites it and removes stale
managed entries. A file occupying the managed `.opencode` root is rejected
before any mutation; replace it with a directory before retrying. `opencode.json` is likewise managed. Update creates missing
seed files but preserves existing files outside `.opencode/`, such as README,
AGENTS, BUILDING, TESTING, CONTRIBUTING, AGENTIC_WORKFLOW, `docs/`, and
`ktlo/`. Future breaking changes may require
explicit migration logic; the latest released version of
`@backshopdev/roundhouse` does not add version-specific migrations.
Preview either command without changing files with `--dry-run`.

Configure npm for private consumption (repository push access and package read
access are distinct):

```ini
@backshopdev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_TOKEN
```

The token needs package read permission (classic tokens use `read:packages`)
and the account must be granted access to the package. Fork this repository if
you need to customize the workflow rather than editing deployed files.

## Adopting the Template

To use this workflow in your own repository:

1. Run `npx @backshopdev/roundhouse init`.
2. Customize the seed files and template docs for your project.
3. Run `npx @backshopdev/roundhouse update` for a released workflow
   version; only managed workflow files are intentional overwrites.

What you get:

- Four agent roles (orchestrator, document-author, implementor, reviewer) configured in `opencode.json` with prompt files in `.opencode/agents/`
- Skills for planning, commit conventions, peer review, security, and domain-specific authoring
- A structured docs layout (`docs/decisions/`, `docs/specs/`, `docs/plans/`, `docs/architecture/`, `docs/contracts/`, `docs/implementation-maps/`)
- Markdown validation via `markdownlint-cli2` (config not included; adopters provide their own) and a docs-check script

The `.opencode/` directory and `opencode.json` are the workflow engine — agents, skills, and plugin configuration. Copy them from `src/` when you want to adopt the full workflow, or start with just the docs and add `.opencode/` and `opencode.json` later as your needs mature.

## Workflow at a Glance

The template workflow in `src/` runs as follows. The orchestration loop:

```text
@orchestrator (plan + Gate 1) → @document-author (author + checks) → human
work approval → parallel @reviewer sessions → human triage → commit gate
```

Four agent roles with distinct authority:

- **Orchestrator** — the human interface; runs Socratic planning, enforces gates, delegates work, composes review perspectives from skills, consolidates findings, and manages commit approval. Never edits files.
- **Implementor** — implements executable software changes (code, tests, configuration) in isolated context; applies a test-first default for behavioral changes, loads implementation expertise through skills, runs objective checks, and returns a completion packet. Accepted human or reviewer changes return here; the plan stays approved unless the human explicitly reopens it. Investigation of material uncertainty is performed in-session via the `investigation` skill, not by a separate agent.
- **document-author** — implements the approved plan in isolated context; loads relevant skills, runs objective checks, and returns a completion packet. Accepted human or reviewer changes return here; the plan stays approved unless the human explicitly reopens it.
- **Reviewer** — independent read-only sessions in parallel, each loading `peer` plus a domain skill (`harness`, `literature-note`, or `opencode-configuration`); `security` joins when changes touch sensitive areas. The orchestrator presents findings to the human, who triages and may dismiss any — findings are inputs, not verdicts.

Two human gates control every changeset:

- **Gate 1 — plan approval:** the human signs off on the plan before substantive work begins (unless an approved written plan already exists in the repo).
- **Gate 2 — commit approval:** after human work approval and independent review, the human approves the commit message and confirms the exact command.

### Skill Architecture

Skills load on demand — they sharpen judgment without creating another actor, session, or handoff. The root workflow has seven skills across three categories:

- **Foundation** — planning-structure, commit-convention
- **Artifact authoring** — harness, literature-note, opencode-configuration
- **Review lens** — peer, security

The template in `src/` expands to five categories with 41 skills, adding cross-cutting concern skills (security-privacy, accessibility, quality-attributes) and technology skills (react, typescript, astro, and others).

For full workflow mechanics — role detail, HITL gate enforcement, permission model, objective checks, and key rules — see [AGENTIC_WORKFLOW.md](AGENTIC_WORKFLOW.md).

## Repository Structure

- **Root** — deployed instance of the template; uses itself to maintain the template. Contains `AGENTS.md`, `AGENTIC_WORKFLOW.md`, `CONTRIBUTING.md`, `guiding-principles.md`, `opencode.json`, `.markdownlint-cli2.jsonc`, and other files. Root `.opencode/` and `opencode.json` are deployed (gitignored) copies of `src/`.
- **`src/`** — complete reusable template payload. Its `docs/` and `ktlo/`
  contain only reusable indexes/templates; root repository-specific durable
  docs remain outside the package.
- **`.opencode/`** (root) — deployed (gitignored) copy of `src/.opencode/`; agents (orchestrator, document-author, reviewer), skills (planning-structure, commit-convention, peer, security, harness, literature-note, opencode-configuration), and plugin configuration.
- **`docs/`** — durable artifacts: decisions, specs, and plans
- **`ktlo/`** — keep-the-lights-on operational items (domain conventions, coding standards, sync procedures)
- **`references/`** — literature notes that informed the guiding principles
- **`guiding-principles.md`** — eight principles (GP01–GP08) extracted from considered sources

## Guiding Principles

Eight principles shape every design decision in this workflow:

1. **Progressive disclosure** — start simple, layer complexity as needed
2. **Single source of truth** — all artifacts in dedicated directories, never scattered
3. **Human in loop** — orchestrator is entry point, yields after each gate
4. **Independent parallel review** — multiple reviewers, human triage
5. **Socratic interview** — surface assumptions before generation
6. **Question, not command** — an invitation to converse, not a work order
7. **Tooling enforces the checkable** — linters handle the verifiable; prose is for judgment
8. **Human leads, agent as near-equal partner** — the human is tiebreaker, but agent judgment carries substantial weight

See [guiding-principles.md](guiding-principles.md) for the full extraction with sources.

## Key Files

### Template (in `src/`)

- **AGENTS.md** — concise introduction and entry point; the first file agents and humans read
- **AGENTIC_WORKFLOW.md** — complete workflow mechanics: roles, gates, checks, permissions, rules
- **CONTRIBUTING.md** — how changes are made, reviewed, and committed; Conventional Commits standard with examples
- **BUILDING.md** — build instructions and prerequisites
- **TESTING.md** — testing procedures and conventions
- **README.md** — project overview and adoption guide
- **opencode.json** — agent definitions and permission rules
- **.opencode/** — agents, skills, and workflow configuration

### Root-only development artifacts

- **guiding-principles.md** — eight principles (GP01–GP08) with source attribution and operationalization notes
- **.markdownlint-cli2.jsonc** — markdownlint config tuned for dense prose; silence cosmetic rules, keep correctness guards
- **references/** — literature notes that informed the guiding principles
- **LICENSE** — project license and published package metadata
- **.gitignore** — git ignore rules

The root `README.md` is also published as npm package metadata, but deployment
copies only packaged `src/` contents, so `init` and `update` never deploy it.

## Releasing

Maintainers update `package.json`, create the matching `vX.Y.Z` release tag
(for example `v0.6.0`), and push that tag. The release workflow validates the
tag against `package.json` and publishes to `https://npm.pkg.github.com` with
only package write permission. Consumers need package read access and an npm
token with `read:packages`; repository push access is separate. Fork this
repository to customize the template rather than editing deployed files. Do
not publish or require credentials during development.

The workflow intentionally listens for every `v*` tag because GitHub Actions
tag globs cannot express the full semantic-version shape. Invalid v-prefixed
tags therefore schedule the validation job and fail strict tag/version checks;
they are never published.

Validation runs without package write permission, and publication is a separate
job that runs only after validation succeeds. As a manual GitHub repository
setting, maintainers must protect `v*` release tags (or an equivalent ruleset)
so only authorized maintainers can create, update, or delete them. Optionally,
configure the publish job to require an approved GitHub release environment and
reviewer before publication. These tag-protection and environment controls are
not configured by this repository workflow.

## Requirements

- **[OpenCode](https://opencode.ai)**
- **Node.js 24+** (matches `engines.node` in `package.json`) — to run the deployment CLI
- **Node.js** — for `markdownlint-cli2` (run via `npx`)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution process, HITL gate detail, and commit message standard.

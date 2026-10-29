# Roundhouse

A reusable multi-agent workflow for [OpenCode](https://opencode.ai) for structured document authoring. The root of this repository uses the template to maintain and evolve itself.

## Overview

Human + agent collaboration produces a better whole. This workflow pairs human judgment with agent execution through:

- **Human-in-the-loop gates** at every consequential transition
- **Socratic interviewing** that surfaces assumptions before generation
- **Independent parallel review** sessions with authoritative human triage
- **Skill-based architecture** that loads expertise on demand, not all at once

Other approaches work well for their use cases. This is a deliberate choice: we believe the dialogue, gates, and review cycles produce better outcomes than autonomous generation — even when the latter is faster. The partnership itself is the value, and the speed bumps are intentional.

The workflow's authoritative source is the workspace packages under `packages/` — each package carries its `roundhouse.json` envelope plus its `managed/` content, and the Core package carries the `seed/` scaffolding and the `opencode-template.json`. The root of this repository composes itself from those packages via the composer — the workflow is docs-as-code by construction.

## The package family

Roundhouse is organized as the `@backshop/roundhouse-*` package family. The foundation pair is `@backshop/roundhouse-cli` — the composer, whose `roundhouse` bin provides the `init`, `compose`, and `verify` commands — and `@backshop/roundhouse-core` — the Core machinery: the four agent prompts, the Core skills, the workflow docs, the seed scaffolding, and the `opencode-template.json`. The remaining 31 packages are capability packages per the skill taxonomy — the `docs-*`, `format-*`, `framework-*`, `lang-*`, `protocol-*`, and `software-*` families plus `cms-apostrophe` and `backshopdev-planning` — each contributing its skills from its `managed/` tree.

Compose your consumer:

```bash
npx roundhouse init      # first composition of a fresh consumer
npx roundhouse compose   # recompute, update managed artifacts, regenerate
npx roundhouse verify    # report every drift class; writes nothing
```

`init` and `compose` write the managed `.opencode/` tree, the composed `opencode.json`, and the `.roundhouse/manifest.json` composition record; seed files are created when missing and never overwritten.

## Packaging

Packaging and distribution details will be documented here once the npm publishing tooling is in place.

## Adopting the Template

What you get:

- Four agent roles (orchestrator, document-author, implementor, reviewer) configured in `opencode.json` with prompt files in `.opencode/agents/`
- Skills for planning, commit conventions, peer review, security, and domain-specific authoring
- A structured docs layout (`docs/decisions/`, `docs/specs/`, `docs/plans/`, `docs/architecture/`, `docs/contracts/`, `docs/implementation-maps/`)
- Markdown validation via `markdownlint-cli2` (config not included; adopters provide their own) and a docs-check script

The `.opencode/` directory and `opencode.json` are the workflow engine — agents, skills, and configuration, composed from the packages' `managed/` trees by the composer. Adopt the full workflow via the repo-based path — clone/workspace + compose — or start with just the docs and add the composed engine later as your needs mature (the supported path is `init`).

## Workflow at a Glance

The workflow runs as follows. The orchestration loop:

```text
@orchestrator (plan + Gate 1) → @document-author (author + checks) → human
work approval → parallel @reviewer sessions → human triage → commit gate
```

Four agent roles with distinct authority:

- **Orchestrator** — the human interface; runs Socratic planning, enforces gates, delegates work, composes review perspectives from skills, consolidates findings, and manages commit approval. Never edits files.
- **Implementor** — implements executable software changes (code, tests, configuration) in isolated context; applies a test-first default for behavioral changes, loads implementation expertise through skills, runs objective checks, and returns a completion packet. Accepted human or reviewer changes return here; the plan stays approved unless the human explicitly reopens it. Investigation of material uncertainty is performed in-session via the `investigation` skill, not by a separate agent.
- **document-author** — implements the approved plan in isolated context; loads relevant skills, runs objective checks, and returns a completion packet. Accepted human or reviewer changes return here; the plan stays approved unless the human explicitly reopens it.
- **Reviewer** — independent read-only sessions in parallel, each loading `peer` plus a domain skill (`harness`, `docs-literature-note`, or `opencode-configuration`); `security` joins when changes touch sensitive areas. The orchestrator presents findings to the human, who triages and may dismiss any — findings are inputs, not verdicts.

Two human gates control every changeset:

- **Gate 1 — plan approval:** the human signs off on the plan before substantive work begins (unless an approved written plan already exists in the repo).
- **Gate 2 — commit approval:** after human work approval and independent review, the human approves the commit message and confirms the exact command.

### Skill Architecture

Skills load on demand — they sharpen judgment without creating another actor, session, or handoff. The root workflow's core skill set is enumerated in the skill allowlist; see `AGENTIC_WORKFLOW.md` for the full routing table.

For full workflow mechanics — role detail, HITL gate enforcement, permission model, objective checks, and key rules — see [AGENTIC_WORKFLOW.md](AGENTIC_WORKFLOW.md).

## Repository Structure

- **Root** — the self-hosting consumer; uses the workflow to maintain the workflow. Contains `AGENTS.md`, `AGENTIC_WORKFLOW.md`, `CONTRIBUTING.md`, `guiding-principles.md`, `opencode.json`, `.markdownlint-cli2.jsonc`, and other files. Root `.opencode/` is the composer's managed output (gitignored); `opencode.json` is the composed render and `.roundhouse/manifest.json` the composition record (both committed).
- **`packages/`** — the authoritative source: 33 workspace members, each with its `roundhouse.json` envelope and `managed/` content; the Core package additionally carries the `seed/` scaffolding and the `opencode-template.json`.
- **`.opencode/`** (root) — the composer's managed output (gitignored): agents (orchestrator, document-author, implementor, reviewer), the installed skills, and configuration.
- **`docs/`** — durable artifacts: decisions, specs, plans, architecture, contracts, implementation-maps
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

### Packages (the authoritative source)

- **`packages/roundhouse-core/seed/`** — the consumer scaffolding: `AGENTS.md`, `AGENTIC_WORKFLOW.md`, `README.md`, `CONTRIBUTING.md`, `BUILDING.md`, `TESTING.md`, `docs/`, `ktlo/`, `scratch/README.md`
- **`packages/roundhouse-core/managed/`** — the harness content: the four agent prompts, the Core skills, the workflow docs, and `docs-check.js`
- **`packages/roundhouse-core/opencode-template.json`** — the Core template the rendered `opencode.json` derives from
- **`packages/roundhouse-<subject>/managed/skills/<id>/SKILL.md`** — the family packages' skills under their taxonomy IDs
- **`packages/roundhouse-cli/`** — the composer: the `roundhouse` bin and the library modules (discovery, template/graph validation, rendering, materialization, manifest)

### Root-only development artifacts

- **guiding-principles.md** — eight principles (GP01–GP08) with source attribution and operationalization notes
- **.markdownlint-cli2.jsonc** — markdownlint config tuned for dense prose; silence cosmetic rules, keep correctness guards
- **references/** — literature notes that informed the guiding principles
- **LICENSE** — project license
- **.gitignore** — git ignore rules

## Requirements

- **[OpenCode](https://opencode.ai)**
- **Node.js 24+** (matches `engines.node` in `package.json`) — to run the composer/`roundhouse`-bin
- **Node.js** — for `markdownlint-cli2` (run via `npx`)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contribution process, HITL gate detail, and commit message standard.

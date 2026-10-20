# Building This Project

> **UNCONFIGURED TEMPLATE** — This file contains placeholder guidance only.
> Do not treat any command, prerequisite, or path below as a current project
> fact. Populate every section with verified information from your repository
> before relying on it. An agent MUST NOT execute or assume any instruction
> here until a human confirms the populated content.

## Prerequisites

<!-- Replace each bullet with verified prerequisites for YOUR repository. -->

- <!-- e.g., Node.js <version>, Python <version>, Go <version> -->
- <!-- e.g., Required CLI tools (name + install source) -->
- <!-- e.g., Access credentials or endpoint configuration -->

## Initial Setup

<!-- Replace with the verified setup steps for YOUR repository. -->

1. <!-- e.g., Clone: `git clone <your-repo-url>` -->
2. <!-- e.g., Install dependencies: `<your-install-command>` -->
3. <!-- e.g., Configure environment: `<your-config-step>` -->

## Build Commands

<!-- Replace with verified build commands for YOUR repository.
     Only list commands that exist in your build scripts or Makefile. -->

- <!-- e.g., `npm run build` / `make build` / `cargo build` -->
- <!-- e.g., `npm run lint` / `make lint` -->

## First Workflow Run

1. Describe your goal to the `orchestrator` agent.
2. If non-trivial, the pipeline will route through:
   - Orchestrator: plan + Socratic interview, then Gate 1 sign-off.
   - document-author: executes the approved plan and returns a completion
     packet.
   - Reviewer Agent: independent parallel sessions composed from peer, domain,
     and conditional security skills.
3. Check `docs/` for artifacts at each stage.

## Adding Project-Specific KTLO

1. Add items to `ktlo/` marked `[project]`.
2. Update `ktlo/index.md` with your new items.
3. Reference both template and project KTLO in documentation.

## Customizing the Workflow

- Modify `AGENTS.md` for project-specific agent descriptions.
- Update `opencode.json` for your model configurations.
- Replace `docs/` content with your project documentation.

## How to Populate This File

During repository setup, replace every placeholder comment above with verified
commands and prerequisites from your repository. Remove this "How to Populate"
section and the UNCONFIGURED TEMPLATE banner only after a human confirms that
every instruction is accurate and executable.

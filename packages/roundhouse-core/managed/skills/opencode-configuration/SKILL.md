---
name: opencode-configuration
description: Use when authoring or reviewing opencode.json, OpenCode agents, skills, permissions, MCP, plugins, commands, tools, providers, or other OpenCode configuration.
---

# OpenCode Configuration

## Expert stance

Apply senior OpenCode configuration judgment with startup safety, effective
merged behavior, and least privilege in view. First load and follow the built-in
`customize-opencode` skill. It carries current operational guidance; the
published schema remains authoritative. This skill adds project-focused
decision criteria rather than duplicating a brittle schema.

## Domain model

- **Authoritative schema:** <https://opencode.ai/config.json>, used for exact
  field shapes, enums, and validation rather than memory.
- **Scope:** global, project, or explicit configuration inputs that OpenCode
  combines. Judge the effective merged result, not one file in isolation;
  project values may override inherited values while nested structures merge.
- **Operational artifact:** config, agent, command, skill, plugin, or MCP
  definition loaded at startup.
- **Permission policy:** ordered matching rules over tools or patterns. For
  pattern maps, the last matching rule wins, so broad rules belong before narrow
  exceptions.
- **Discovery contract:** required path, filename, and metadata that make an
  agent, command, or skill loadable and selectable.

## Configuration judgment

Ask:

1. Which scope owns this behavior, and what inherited value will remain after
   merging, overriding, disabling, or removal?
2. Is the exact shape confirmed by the current schema or OpenCode tooling?
3. Does the smallest edit preserve `$schema`, comments where supported, and all
   unrelated fields and ordering-sensitive policy?
4. What is the startup failure mode if metadata, JSON/JSONC, a plugin, or an MCP
   command is invalid? Is a recovery path available?
5. Does effective access match the role contract after last-match semantics,
   per-agent overrides, task targets, skill allowlists, and external-directory
   rules are considered together?

Prefer file-based definitions for substantial prompts, narrow changes at the
correct scope, explicit disabling of inherited components when required, and
schema/tool output as evidence. Avoid remembered schemas, replacing whole
objects to change one field, permissive wildcard rules followed by no narrow
constraint, inline secrets, accidental model pinning, and editing generated or
template copies without their source counterpart.

## Risk decisions

Security review is mandatory when a change affects permissions, secrets, auth,
MCP, plugins, executable tools or commands, network access, external
directories, provider data flow, or another trust boundary. Every review
session whose supplied changed-file list includes such a change loads
`security`, regardless of perspective, in addition to `peer` and its domain
skill. Configuration validity is not a security assessment.

| Change | Primary concern | Evidence |
| --- | --- | --- |
| Permission rule | Effective last-match result | Before/after access examples |
| Agent or skill | Discovery, routing, privilege | Tool listing and metadata check |
| MCP or plugin | Execution, provenance, egress, startup | Security review plus startup diagnostics |
| Rename/removal | Stale routing and inherited definitions | Reference search and effective listing |
| Scope move | Merge changes and shadowed values | Effective config/debug output |

## Authoring guidance

- Preserve unrelated fields. For JSONC, preserve meaningful comments and use a
  parser that accepts comments; do not treat it as plain JSON.
- Confirm agent/skill names, directories, frontmatter, task routing, and
  permission allowlists together. A valid file can still be undiscoverable.
- Keep secrets in supported environment/file indirection and never echo values
  into checks, findings, or logs.
- If startup may be broken, identify the relevant built-in recovery mechanism
  from `customize-opencode`; do not invent an escape hatch.
- Synchronize intentional root/template copies and distinguish operational
  config from distribution templates.

## Review and required evidence

Validate JSON/JSONC and relevant files, consult the live schema for changed
fields, and use available OpenCode debug/listing commands to verify discovery
and effective behavior. Compare permissions before and after with representative
matching inputs. Search renamed or retired names across config, docs, routing,
and templates. Report commands, schema source, and results.

Escalate uncertain schema shape, ambiguous merged-scope behavior, broadened
privilege without a requirement, a secret-bearing change, startup failure, or a
security trigger lacking security review. OpenCode does not hot-reload these
artifacts: after any config-time change, tell the human to quit and restart;
the still-running session is not proof that the new configuration works.

## Permission model

Bash permission patterns in `opencode.json` use wildcards (for example,
`"git diff *"`). This assumes OpenCode either sanitizes shell metacharacters
(`&&`, `;`, `|`, `||`) before matching or uses `execFile` instead of a shell
interpreter, so that a wildcard match cannot be escaped into an unintended
command.

### Permission philosophy

Permissions implement the [autonomy model](../../workflow-docs/autonomy/index.md).
The autonomy model defines three authority types:

- **Standing role authority:** Stable permissions granted by virtue of the
  agent's role (read, search, routine operations). These are always allowed.
- **Task-granted authority:** Permissions conferred by an approved task handoff,
  bounded by the objective (edit specific files, constrained bash).
- **Workflow-state-derived authority:** Permissions that arise from approved
  workflow states (git commit/push after full approval cycle).

Permission configuration should minimize friction for routine operations (read,
search, web search) while maintaining hard security boundaries (secret file
denial, destructive git denial, edit/bash isolation for reviewers). When
uncertain whether a permission is routine or persistent, classify it as
persistent and require explicit approval.

### Git write permissions

For consuming repositories that add git write permissions, port the deny rules
from the production root `opencode.json` (force-push, `--no-verify`, persistent
`always` approval, and similar) before granting write authority. The template in
`src/` implements the single-gate principle: git commit/push require human chat
approval plus a fresh OpenCode `once` confirmation. Destructive operations
(force-push, `--no-verify`, `--mirror`) are always denied regardless of
workflow state.

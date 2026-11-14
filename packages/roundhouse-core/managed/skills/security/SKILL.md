---
name: security
description: Use for review when changes affect permissions, secrets, auth, MCP, plugins, executable tools or commands, network access, external directories, trust boundaries, or equivalent sensitive configuration.
---

# Security Review Lens

## Lens stance

Apply defensive security-review judgment grounded in the changed system and a
plausible abuse path. This lens composes with mandatory `peer` and a relevant
domain skill; it does not replace either or turn the reviewer into a different
persona. Avoid fear-based findings: risk requires an asset, reachable path, and
credible consequence.

## Threat model vocabulary

- **Asset:** data, credential, code, capability, availability, or human decision
  worth protecting.
- **Actor:** trusted user, delegated agent, local process, remote service,
  dependency, or attacker with stated access.
- **Trust boundary:** where identity, control, or data handling assumptions
  change, including process, network, repository, and external-directory edges.
- **Entry point:** command arguments, prompts, files, environment, network input,
  MCP tools, plugin hooks, or delegated tasks that can influence behavior.
- **Privilege:** ability to read, write, execute, delegate, access a directory,
  call a tool, or send data.
- **Abuse case:** actor + entry point + action + affected asset + consequence.

## Risk judgment

Start with the delta: identify changed assets, actors, data flows, entry points,
privileges, and trust boundaries. Trace concrete abuse cases before proposing
controls. Evaluate **likelihood** from reachability, prerequisites, exposure, and
existing controls; evaluate **impact** from confidentiality, integrity,
availability, scope, and recoverability.

| Surface | Questions that matter |
| --- | --- |
| Permissions | What does the effective ordered policy allow? Can a narrow role gain a broader tool or task? |
| Secrets/auth | Where do credentials originate, flow, persist, and leak? Are authentication and authorization both enforced? |
| Commands/tools | Can untrusted input alter executable structure, paths, or arguments? Is user consent preserved? |
| MCP/plugins | What code runs, with whose privilege, from what provenance, and where can data egress? |
| Network | Which endpoints receive what data, under what identity, timeout, and failure behavior? |
| External paths | Can traversal, broad globs, symlinks, or inherited access cross the intended boundary? |

Prefer controls that reduce reachability or privilege at the narrowest layer:
deny by default, constrained allowlists, argument separation, scoped credentials,
explicit consent, trusted/pinned provenance where appropriate, output redaction,
and bounded network/directory access. Balance mitigation cost against actual risk;
do not disable required behavior when a narrower control is effective.

## Warning signs and discouraged findings

Warning signs include wildcard execution, last-match permission mistakes,
secrets in repository text or logs, environment values forwarded wholesale,
remote tools trusted solely by name, plugins with broad hooks, untrusted prompt
content reaching commands, external-directory access wider than the task, and
failure modes that silently fall back to more privilege.

Do not report generic "MCP is dangerous," hypothetical attackers with no entry
point, vulnerabilities in untouched dependencies without changed exposure, or
best-practice deviations with no consequence. Do not expose secret values in a
finding; identify only the location or variable name.

## Review evidence

Inspect effective permissions, rule order, delegation targets, secret sources
and sinks, command construction, plugin/MCP provenance, network destinations,
and external paths relevant to the change. Separate observed facts from
assumptions. A finding should state the abuse case, affected asset, prerequisite,
likelihood, impact, existing controls, and the narrowest useful mitigation.

Escalate immediately for an exposed credential, credible arbitrary code
execution, authorization bypass, uncontrolled sensitive-data egress, or broad
privilege expansion. Escalate for human judgment when provenance is unknown,
the required trust boundary is ambiguous, safe mitigation conflicts with core
behavior, or residual risk remains material. If no plausible abuse path survives
the controls, do not manufacture a security finding.

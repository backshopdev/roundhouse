---
name: backshopdev-planning
description: Use when decomposing work into an implementation plan, acceptance criteria, dependencies, readiness, and explicit human plan approval.
---

# Planning Structure

Structure plans with: objective; in/out scope; thin feature slices; dependencies;
specific acceptance criteria; verification; parallelization; gaps and proposed
defaults; and a readiness score with blockers.

For harness changes, discuss verification with the human through the
orchestrator before plan approval. Each discrete task in that plan must state
the behavior to check, verification method, expected result, and limitations.
For detailed behavioral-validation expertise when planning these changes, use
[harness](../harness/SKILL.md) through a role permitted to load it; do not apply
harness-specific checks to ordinary documentation plans.

Unless a written plan is already human-approved, the orchestrator must obtain
explicit approval before implementation. Revise and re-ask when requested; do
not delegate while Gate 1 is open.

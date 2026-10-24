---
name: task-planning
description: Use when decomposing an approved objective into a lightweight implementation plan — the Gate 1 planning skeleton. The Core default when no fuller planning workflow is installed; a fuller installed planning skill takes precedence when one is discovered via the skill listing.
---

# Task Planning

This skill is the lightweight planning skeleton for turning an approved
objective into a small, reviewable implementation plan. It is the Core
default: when the skill listing reveals a fuller installed planning skill,
that skill takes precedence and this one stands down. The skeleton is
lightweight by design — it is not a reduced version of a fuller methodology;
it covers the minimum a human sign-off needs to judge direction before tokens
are spent.

## The skeleton

A plan built from this skeleton carries exactly these elements:

1. **Objective.** One paragraph: what the work achieves and the resulting
   behavior or state, linked to the source of the objective — the approved
   decision, specification, or human request it implements.
2. **Work packages with acceptance criteria.** Each work package is a
   coherent unit of work with a short description, its tasks, its
   dependencies, and observable acceptance criteria — outcomes, not
   activities. Number the packages and tasks so review can reference them.
3. **Verification criteria.** How completion is verified: the checks that
   must pass, each groundable by an independent observation. Prefer
   deterministic checks over prose-based inspection wherever possible.
4. **The human sign-off gate.** No implementation begins until the human
   explicitly approves the plan. Present the plan, state what approval
   authorizes, and hold for the decision. Questions and requests for advice
   do not authorize work.

## Scope discipline

- State what is included and what is explicitly excluded; excluded items name
  where they belong — a later phase, a different plan, or nowhere.
- Record the plan's provenance: the decisions and prior artifacts it draws
  on, so review can check fidelity against them.
- The skeleton is lightweight by design. When a fuller planning methodology
  is installed (an org workflow layer may provide one), that methodology
  governs instead; this skill stands down rather than competing with it.

## After sign-off

Implementation follows the approved plan; the plan stays approved unless the
human explicitly reopens it. Accepted review findings amend the work, not the
plan, unless the human reopens planning.

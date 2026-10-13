# Guiding Principles (extracted from considered sources)

GP01: Progressive disclosure - start simple, layer complexity as needed
  [Source: AI Hero guide on AGENTS.md; Anthropic "Effective context engineering"; HumanLayer "Writing a good CLAUDE.md"; OpenAI "Using PLANS.md"; Anthropic "Agent Skills"; OpenAI "Build skills"; arXiv 2607.17598v1 "Progressive disclosure for long-context agents"]
- The workflow AGENTS.md should begin with core philosophy and progressive pipeline stages
- Additional details reveal only when the human collaborator yields after each gate
- Prevents context rot by not dumping all information upfront
- **Conditional routing**: every linked resource states **when** it should be read and **what question** it answers (pattern: when → read → purpose). Do not instruct agents to read all linked files by default; each link carries an activation condition.
- **Routing depth**: prefer one routing hop (metadata → full instructions) before actionable content. Add another level only when the additional separation has demonstrated value; deeper nesting can degrade accuracy without improving routing.
- Add workflow complexity only for specific, evidenced problems or needs surfaced through use or identified during design/evaluation; do not add it speculatively.
- Operationalized: AGENTS.md starts compact (≤100-line budget), expands only when task type warrants; skills expose name + description for routing, full SKILL.md loaded on demand

GP02: Single source of truth - all artifacts in dedicated directories, never scattered
  [Source: alexop.dev on progressive disclosure for Claude.md; arXiv 2606.15828 "Configuration smells"]
- All workflow artifacts live in `~/docs/` + `WORKFLOW_STATE.md`
- Chat history is for transitory discussion, not persistent record
- Operationalized: `~/docs/decisions/`, `~/docs/specs/`, `~/docs/plans/` (review findings are ephemeral — triaged in-session, not persisted)
- AGENTS.md references these directories; nothing scattered in conversation history
- **Project synthesis — Authority mapping**: normative rules have one authoritative owner (agent definition, skill, document, script, or configuration). Summaries elsewhere exist for routing only and must not conflict with their authoritative source.
- **Checkable requirements**: deterministically checkable requirements belong in tools or configuration; prose describes *when* to run the check rather than duplicating its rules.

GP03: Human in loop - orchestrator is entry point, yields after each gate
  [Source: Operator working principle]
- No stage advances without passing; failed gates loop back with specific feedback
- Human yields after each gate; orchestrator resumes session at completion
  - Operationalized: pipeline form `@orchestrator` → `@document-author` → composed review sessions → human triage
- Human never bypasses gates; agent enforces gate discipline

GP04: Independent parallel review + human triage
  [Basis: human/project premise (human + agent = better whole); not an externally sourced evidence claim]
- Project implication: use independent review and authoritative human triage;
  this is an operational design decision derived from the premise, not a claim
  established by the sources listed in `references/`
- Review runs as one or more independent `reviewer` sessions in parallel;
  diversity comes from assigned domain and lens skills, not pinned models
- Every session loads `peer` plus a domain skill; risk-sensitive work adds `security`
- Scope is disciplined to the session's changed files + how they intersect the repo; findings are anchored, not blanket audits
- The orchestrator presents findings to the human, who **triages and may dismiss any** — findings are inputs, not verdicts
- Operationalized: orchestrator composes perspectives, preserves provenance,
  reports substantive conflicts as debates, and returns accepted changes to
  `document-author` without reopening the approved plan

GP05: Socratic interview surfaces assumptions before generation
  [Basis: human/project premise (human + agent = better whole); not an externally sourced evidence claim]
- Project implication: use Socratic interviewing to expose assumptions before
  generation; this is an operational design decision derived from the premise,
  not a claim established by the sources listed in `references/`
- The orchestrator surfaces unidentified assumptions, unconsidered use cases,
  and side effects through human-facing Socratic interviewing
- Explicit opinion requests open dialog, don't just state opinion
- Operationalized: the orchestrator alone uses the human-facing Socratic
  interview protocol; independent, read-only review sessions report
  assumptions and findings to the orchestrator and never interview the human
- Opening question: "Could you tell me: what's your primary objective...?"
- When user asks "what do you think?" → agent opens dialog, doesn't just give opinion

GP06: A question is an invitation to converse, not a work order
  [Source: Operator working principle (human + agent = better whole)]
- Curiosity/opinion probes ("is there a...", "should we...", "what do you think...", "let's talk about...") open a dialog first — do NOT jump to editing files
- Explicit build commands ("implement / proceed / apply") are what trigger action
- When implementing touches ground the human is unfamiliar with, surface the tradeoff and pause for questions — the human learning is part of the spec, not a side quest
- The human's first instinct may be wrong and the agent's may be wrong; dialog is how you find out before spending tokens building the wrong thing
- Operationalized: orchestrator "Question-vs-Command" protocol; AGENTS.md Socratic rule; mirrored to consuming repos via `src/`

GP07: Tooling enforces the checkable; prose is for the judgment-based
  [Source: alexop.dev "Stop Bloating Your CLAUDE.md" (backpressure) + AI Hero "Complete Guide to AGENTS.md" (instruction budget); arXiv 2606.15828 "Configuration smells"; arXiv 2602.11988 "Evaluating AGENTS.md"; HumanLayer "Skill issue"]
- If a linter/build can verify a rule, encode it in the tool, not in prose instructions (saves the instruction budget + removes ambiguity)
- Prose is reserved for judgment a tool can't make (intent, fit, harness tuning)
- Operationalized: `markdownlint-cli2` enforces Markdown structure (see `docs/decisions/DEC-20260829-01.md`); `AGENTS.md` states the *trigger*, the config holds the *rules*; the document-author runs the check and reports `verify-status`
- Corollary (drives link discipline): docs should be *navigable* (predictable relative index links) so agents reliably reach the on-demand detail files this principle pushes prose into
- **Move, don't delete**: when condensing, move detail to its authoritative home (skill) where it is preserved but loaded on demand. Bad condensing removes detail to hit a line count, losing specificity that handles retro'd situations. Good condensing moves detail to the right place.
- **Soft line-count guidance**: Project operationalization: AGENTS.md targets ~100 lines (soft guidance), with a hard cap around 125 lines. These thresholds are project decisions, not source-derived; the AI Hero source supports minimal always-loaded context but does not specify exact line counts. Don't split files just to hit a line cap; split only when the new file has a clear activation condition — a file can remain unloaded for unrelated tasks.
- **Signal detection**: accumulation of narrowly specific details in root-level files signals that the content should migrate to a skill. Root/src files should be generalist: universal constraints or routing to broader information.
- **Evaluation through representative prompts**: test harness changes with representative prompts covering general questions, authoring, review, configuration, validation, commit preparation, and build/test tasks. Add or retain instructions only when they address demonstrated failures observed during evaluation.

GP08: The human leads, but the agent's judgment is a near-equal partner
  [Basis: human/project premise (human + agent = better whole); not an externally sourced evidence claim]
- Project implication: the human is the tiebreaker (51%), but the agent's perspective carries substantial weight (49%) and should be taken seriously; this is an operational design decision derived from the premise, not a claim established by the sources listed in `references/`
- When the agent pushes back on a process decision — like skipping a review step or dismissing a finding — that pushback is a critical signal, not a suggestion
- The human may still choose differently, but the agent's perspective deserves serious consideration
- Operationalized: orchestrator pushes back if the human elects to skip a workflow step (e.g., agentic re-review after a trivial fix); the human may override, but the pushback is documented and taken seriously

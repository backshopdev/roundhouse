# KTLO Index

Operational "keep the lights on" items. Links are relative, same-directory only (index discipline).

- [Coding standards](./KTLO-20260829-01.md) — Placeholder KTLO enumerating code-style and naming conventions for template consumers; awaits substantive content from the template repo. — `[template]` — 2026-08-29
- [Domain conventions](./KTLO-20260829-02.md) — Placeholder KTLO listing domain-entity naming and directory conventions for template consumers; awaits substantive content from the template repo. — `[template]` — 2026-08-29
- [Keep `src/` copies in sync with root](./KTLO-20260829-03.md) — Tracks drift between root and `src/` copies of source-of-truth files (e.g., the commit-convention skill). — `[template]` — 2026-08-29
- [Consider adding domain-skills and review-verdicts to commit footers](./KTLO-20260902-01.md) — Explores adding `domain-skills` and `review-verdicts` fields to commit footers to improve agent-provenance traceability. — `[project]` — 2026-09-02
- [Documentation Review Classification](./KTLO-20260903-01.md) — Resolved policy: material documentation accuracy/completeness gaps block approval; non-misleading clarity/style suggestions use existing severity levels. — `[project]` — 2026-10-13
- [Derive package checks from manifest metadata](./KTLO-20260903-02.md) — Replaces hardcoded package smoke-test expectations with manifest-derived checks for resilience to metadata changes. — `[project]` — 2026-09-03
- [Review document-author vs implementor skill allowlist divergence](./KTLO-20260905-01.md) — Tracks the post-WP-02 review of the two agents' skill allowlists (currently mirror each other) so each reflects its actual scope of work. — `[project]` — 2026-09-05
- [Pin dependency versions exactly; pause-and-escalate on every update](./KTLO-20260905-02.md) — Establishes the policy of pinning all dependency versions exactly (no caret/tilde ranges) and treating every dependency update as a deliberate, conscious act — pause-and-escalate, not automatic. — `[project]` — 2026-09-05
- [Establish mentorship posture in the orchestrator for human learning contexts](./KTLO-20260905-03.md) — When the human is working in an area of limited knowledge, the orchestrator adopts a mentorship posture (walking through reasoning explicitly, naming assumptions, explaining the why) rather than delivering bare conclusions. Opt-out path needed; final shape to be determined through the standard Socratic interview → DEC → SPEC → PLAN → product process. — `[project]` — 2026-09-05
- [Prompt-injection trust-boundary investigation](./KTLO-20261009-01.md) — Resolved locally as an OpenCode delivery-path issue: `AGENTS.md` instructions are emitted inside literal `<system-reminder>` blocks; upstream tracking continues, though no fix has landed. — `[project]` — 2026-10-14
- [Skill taxonomy (when the skill set stabilizes, define a proper taxonomy)](./KTLO-20261009-02.md) — Resolved: the nature-based composable skill taxonomy from the 2026-10-17/18 interview landed in the DEC-20261017-02 amendment. — `[project]` — 2026-10-18
- [README accuracy: "seven skills across three categories" claim](./KTLO-20261009-03.md) — Resolved: `README.md` line 117 now uses self-referential wording (no count); the orchestrator skill allowlist holds 21 allows following the 2026-10-17 expansion, making count-based claims permanently fragile. — `[project]` — 2026-10-17
- [`src/AGENTS.md` and `src/AGENTIC_WORKFLOW.md` sync script references](./KTLO-20261009-04.md) — Resolves the pre-existing root-vs-`src/` divergence where root documents reference `npm run sync-roundhouse` but the template copies do not mention the sync script. — `[project]` — 2026-10-09
- [Granular installation options](./KTLO-20261009-05.md) — Explores making the `init`/`update` lifecycle more granular so consumers do not have to adopt the full template; main concern is letting consumers pick which skills to install rather than receiving all 48. — `[project]` — 2026-10-09
- [Assess deferred Git inspection allowances](./KTLO-20261015-01.md) — Records the confirmed `ls-files` gap, separate unresolved staging denial, and deferred inspection candidates requiring later human approval. — `[project]` — 2026-10-15
- [Socratic interview skill: encode the free-form interview style demonstrated in the 2026-10-17/18 taxonomy interview](./KTLO-20261018-01.md) — Resolved: the Phase 4 `socratic-interview` skill encodes all seven style properties as normative sections and carries the orchestrator's extracted interview protocol; the review against this item's list passed and the item closes. — `[project]` — 2026-10-18
- [test-commit.js npm-mode-a can perform a real commit without approval](./KTLO-20261019-01.md) — Tracks the harness hazard where the npm-mode-a test's shell-transported multi-line arguments defeat `--dry-run`, letting a test run commit a non-empty index without approval; demonstrated 2026-10-19 (commit 7f26922, remediated by human-ruled amend). — `[project]` — 2026-10-19

## Templates

- [KTLO template](./template.md) — canonical skeleton for new KTLO items.

- Add new items as `ktlo/KTLO-YYYYMMDD-NN.md` marked `[project]` and linked from this index

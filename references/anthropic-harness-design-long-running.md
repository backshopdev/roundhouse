# Source Note: Harness design for long-running application development (Anthropic)

- **Author**: Prithvi Rajasekaran, Anthropic Labs (engineering blog)
- **Reference Type**: engineering blog post
- **Title**: Harness design for long-running application development
- **Link**: <https://www.anthropic.com/engineering/harness-design-long-running-apps>
- **Published**: 2026-03-24
- **Status**: retrieved 2026-10-15 (full text)
- **Informs principles**: GP01, GP07

## Source claims

Each is attributable to the article unless tagged as inference/implication.

- **Generator/evaluator separation (GAN-inspired):** "I designed a multi-agent structure with a generator and evaluator agent" and "tuning a standalone evaluator to be skeptical turns out to be far more tractable than making a generator critical of its own work." Self-evaluation by generators is unreliable, especially for subjective tasks; separating the judging role from the producing role is the central lever. Even on tasks with verifiable outcomes, an independent evaluator adds value because agents exhibit "poor judgment that impedes their performance."

- **Subjective quality becomes gradable:** "while aesthetics can't be fully reduced to a score... they can be improved with grading criteria that encode design principles and preferences." Four criteria (Design quality, Originality, Craft, Functionality) with explicit weights: design and originality weighted more heavily to push past "AI slop" patterns; craft and functionality already strong by default. Criteria "explicitly penalized highly generic 'AI slop' patterns, and by weighting design and originality more heavily it pushed the model toward more aesthetic risk-taking."

- **Decompose + structured handoffs:** "decomposing the build into tractable chunks, and using structured artifacts to hand off context between sessions." Sprints (10 sprints for a 16-feature spec), per-sprint contracts, per-sprint QA. File-based communication: "one agent would write a file, another agent would read it."

- **Per-criterion hard thresholds with code-cited findings:** "Each criterion had a hard threshold, and if any one fell below it, the sprint failed." Findings surface specific code locations, e.g., "`LevelEditor.tsx:892` requires both `selection` and `selectedEntityId` to be set" — verdict PASS/FAIL plus evidence location in one row.

- **Live-app exercise vs static review:** Evaluator uses Playwright MCP to "click through the running application the way a user would, testing UI features, API endpoints, and database states." The solo-run output was visually impressive but had broken runtime wiring invisible from code reading alone.

- **Meta-principle on harness complexity:** "every component in a harness encodes an assumption about what the model can't do on its own, and those assumptions are worth stress testing, both because they may be incorrect, and because they can quickly go stale as models improve." Complexity must earn its place and be re-examined as models improve.

- **Strategic iteration decisions:** After each evaluation the generator must decide whether to refine the current direction or "pivot to an entirely different aesthetic if the approach wasn't working" — not just iterate mechanically. Iterations are not always linear; later implementations can be worse than earlier ones.

- **Contract negotiation before code:** "Before each sprint, the generator and evaluator negotiated a sprint contract: agreeing on what 'done' looked like for that chunk of work before any code was written... The generator proposed what it would build and how success would be verified, and the evaluator reviewed that proposal... The two iterated until they agreed." Bridges the gap between high-level spec and testable implementation.

- **Context anxiety:** "Some models also exhibit 'context anxiety,' in which they begin wrapping up work prematurely as they approach what they believe is their context limit." Context resets (clearing context entirely with a structured handoff) address this in Sonnet 4.5; compaction alone is not sufficient. Opus 4.6 largely removed the behavior on its own, so context resets could be dropped.

- **Removal iteration methodology:** After an over-aggressive first simplification failed to replicate performance, the author shifted to "removing one component at a time and reviewing what impact it had on the final result." One data point is the Sonnet 4.5 → Opus 4.6 transition, where the sprint construct was removed without performance loss.

- **Few-shot detailed-breakdown score calibration:** "I calibrated the evaluator using few-shot examples with detailed score breakdowns. This ensured the evaluator's judgment aligned with my preferences, and reduced score drift across iterations."

- **Evaluator is one role with many rubrics:** the four criteria are graded by the same evaluator agent with calibrated weights and thresholds — not by separate evaluators per criterion.

## Inference (note author's synthesis)

- **One evaluator, one rubric-bundle is a deliberate design choice:** keeping all criteria under one calibrated skeptic preserves coherent judgment across criteria and lets few-shot calibration propagate consistently. Splitting evaluators per criterion would risk rubric fragmentation and inter-evaluator disagreement that the harness would then have to reconcile — a problem the article avoids but does not name.

- **Hard thresholds are a contract-enforcement tool, not a quality measure:** per-criterion thresholds turn each criterion into a binary go/no-go the generator can act on without judging *how much* it failed. This is structurally different from graded scores (which permit marginal acceptance). The article pairs thresholds with detailed free-text feedback so the generator receives both the verdict and the actionable context.

- **Removal iteration requires impact attribution, not just absence:** the article's lesson from its failed over-aggressive simplification is that without per-component impact attribution, simplification degrades performance silently. This implies that any harness-simplification discipline needs an evaluation method that distinguishes load-bearing from decorative components — a measurement problem the article takes for granted but does not solve.

- **"Components encode model-limit assumptions" is a self-disclosed hypothesis:** the article asserts the meta-principle but presents only one quantitative demonstration (Sonnet 4.5 → Opus 4.6 sprint removal). The hypothesis is plausible but not independently verified.

- **Prompt wording shapes output character in ways authors do not fully anticipate:** "Including phrases like 'the best designs are museum quality' pushed designs toward a particular visual convergence, suggesting that the prompting associated with the criteria directly shaped the character of the output." The Dutch art museum example produced a generic landing page for nine iterations then pivoted to a 3D spatial experience in iteration ten — a creative leap the author had not seen "before from a single-pass generation." Implies that rubric wording is a design lever with second-order effects, not a neutral measurement instrument.

- **Build dominates cost, QA is cheap by comparison:** the DAW run table shows Build (Round 1) at 2 hr 7 min / $71 and QA (Round 1) at 8.8 min / $3 — build is ~24× the cost and ~14× the wall-clock of QA. The harness's evaluator is therefore a high-leverage, low-cost component relative to the generator it grades.

- **Contract granularity matters:** Sprint 3 of the retro game maker alone had 27 criteria covering the level editor. Per-criterion pass/fail evidence surfaces the smallest unit at which the evaluator can act. Implies that contract authoring is itself a non-trivial design task, not a mechanical translation of the spec.

- **Evaluator tuning is its own loop:** "the tuning loop was to read the evaluator's logs, find examples where its judgment diverged from mine, and update the QAs prompt to solve for those issues. It took several rounds of this development loop before the evaluator was grading in a way that I found reasonable." Even with calibration, the evaluator's first version was "inclined to talk itself into deciding [issues] weren't a big deal and approve the work anyway" and tested superficially. LLM-judge reviewers need repeated human review of judgment traces, not just an initial rubric.

## Implications (project consequences)

- **GP01 (progressive disclosure, start simple) — strong support.** The article's removal-iteration methodology plus the "every component encodes an assumption" meta-principle is the most concrete published procedure for GP01's "add complexity for specific, evidenced problems; re-examine as the model improves" rule. Directly grounds the project's "don't add complexity speculatively" sub-bullet of GP01.

- **GP07 (tooling enforces the checkable; prose is for judgment) — strong support.** Per-criterion thresholds with code-cited evidence mirror GP07's preference for machine-checkable requirements in tools rather than prose. Few-shot detailed-breakdown score calibration for the evaluator parallels GP07's "evaluation through representative prompts" — both treat harness tuning as measurement rather than assertion. Calibrated few-shot examples are a tool-like artifact for a judgment the model cannot make unaided.

- **Future QA / review-pass design:** if the project ever adds a subjective LLM-judge review (e.g., for design or integration exercise), it would benefit from the article's few-shot calibration pattern and per-criterion thresholds with evidence locations. The project's current review lenses (peer, security, docs-check) are deterministic or checklist-based; an LLM-judge variant would need calibration examples to align with human judgment.

- **Evaluation methodology for review skills:** "live-app exercise vs static review" is evidence that even structured review can miss integration failures that interactive exercise catches. The project's deterministic checks (markdownlint, JSON validation) cover a bounded class of failure; subjective or integration failures require a separate evaluation loop. Implies the project should not claim its deterministic checks cover integration correctness.

- **Cost framing for any future autonomous-coding experiments:** full harness ~20× solo cost (e.g., $200 vs $9, 6 hr vs 20 min); harness output quality difference was "immediately apparent" but not always proportional. Sets realistic expectations: harness investment pays for autonomous long-running work, not for ordinary tasks.

- **File-based handoffs as authoritative artifacts:** the article's contract and feedback pattern (one agent writes a file, another reads it) treats each handoff as a durable, inspectable artifact rather than transient chat. This is structurally consistent with the project's planning-structure discipline (planning artifacts persisted as files in `docs/plans/`, not in chat). Supports GP02's "single source of truth" for inter-session context, though the article does not use that vocabulary.

## Limitations

- No controlled empirical measurements of cost/benefit across harness variants; the article is a descriptive narrative of one team's iteration, not a comparative study.
- Sprint counts, prompt text, few-shot example counts, and exact criterion weights are not disclosed; the methodology is described qualitatively.
- No discussion of failure recovery (what happens when a sprint contract fails repeatedly), harness determinism, or reproducibility of evaluator judgments across runs.
- Claims about Opus 4.6 removing context anxiety and sprint needs are specific to the cited model versions; transferability to other model families is unstated.
- All examples are fully autonomous multi-hour runs; the article does not address human-in-loop patterns, gating, or human override during a run.
- The article does not validate that its findings generalize beyond frontend/UI app generation (game maker, DAW); transfer to backend-only or systems work is implied but not demonstrated.

## Why it matters here

Provides the strongest published methodological backing for GP01's "add complexity for specific, evidenced problems, and re-examine as models improve" rule: a named, repeatable procedure (removal iteration with impact attribution) plus a self-aware meta-principle. Provides a concrete pattern for GP07's evaluator-as-tooling idea: per-criterion thresholds with code-cited evidence plus few-shot detailed-breakdown calibration. Cost framing (full harness ~20× solo cost, hours of wall-clock) sets realistic expectations for any future autonomous-coding harness experiments the project might consider. The article's autonomous-only framing is a useful counterweight to the project's human-in-loop orientation (GP03, GP06) — the project uses harnesses as augmentation with explicit gates, not as full autonomy. Calibrated few-shot breakdowns for evaluator judgment are the most directly transferable artifact: any future LLM-judge review lens in this project would adopt that calibration pattern.

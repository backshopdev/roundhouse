# Source Note: Groundability, Not Scale Alone (arXiv 2610.01023v1)

- **Author**: Junyu Guo, Shangding Gu, Ming Jin, Javad Lavaei (UC Berkeley + Virginia Tech)
- **Reference Type**: arXiv preprint (v1)
- **Title**: Groundability, Not Scale Alone: When Weak Reviewers Can Audit Strong Coding Agents
- **Link**: <https://arxiv.org/abs/2610.01023v1>
- **Published**: 2026-10-01 (submitted)
- **License**: CC BY 4.0
- **Status**: retrieved 2026-10-15 (full)
- **Informs principles**: GP01, GP07 (strong); GP03, GP04 (qualified)

## Source claims

Paraphrased from the inspected text; no verbatim quotation used without verification.

- **Omission is the dominant failure mode.** Of 101 defective GPT-5.4
  SWE-bench traces, 76 are omissions (missing branch, implementation, or
  check) rather than regressions. Long traces and confident summaries hide
  them.

- **Groundability, not correctness, is the load-bearing concept.** A patch
  can be correct yet un-reviewable if no independent check exists for any
  disputed claim. "Correctness" is a property of the patch; "groundability"
  is a property of the reviewer/patch pair — whether each disputed claim
  has an independent check the reviewer can apply.

- **Organizing evidence alone is insufficient.** Structured but unchecked
  evidence raises both defect catch and over-rejection. Structure helps
  only when the underlying evidence is independently checkable.

- **Weak reviewer + grounded evidence can be decisive.** With official
  execution results as evidence, five of six reviewers (8B–235B parameters)
  improve on both catch and over-rejection. Reviewer parameter count is
  *not* a monotonic predictor of review quality once evidence is grounded.

- **Deployable cascade (Algorithm 1)** stages: (0) no-code-change reject;
  (1) patch-caused static error → reject; (2) generated test that fails on
  base → reject; (3) weak reviewer with 5-vote majority plus abstention.
  Reported coverage 0.89/0.86, catch 0.76/0.80.

- **Evidence misreading is the dominant reviewer error mode.** A reviewer
  cites an execution result that contradicts its own rationale —
  mechanically detectable from the reviewer's trace.

- **Asymmetric test evidence.** A failing test is a strong reject signal
  (precision 0.82); a single passing test is a weak accept signal
  (precision 0.30). Same evidence type does not carry symmetric weight.

- **Patch-attributable checks.** A static error supports rejection only
  if the patch caused it; otherwise unrelated environment errors poison
  the reviewer. Causality, not co-occurrence, is what makes an error
  signal valid.

- **Abstention is a valid outcome.** The cascade separates "wrong
  decision" from "no decision"; abstention is reported separately. A
  reviewer that cannot decide is a routing signal, not a failure case.

- **Scale is not a proxy for review quality.** On unchecked evidence,
  Qwen3-235B underperforms Llama-8B. Reviewer selection should be
  task-evidence-matched, not size-maximized.

- **Algorithm-as-policy disclosure.** The authors state which arm is the
  evaluation rule rather than presenting Algorithm 1 as a recommended
  accept rule. The cascade is reported as a measured bound, not guidance.

- **Methodological lineage.** Cites Irving et al. 2018 and Bowman et al.
  2022 as the sandwiching / debate lineage — positions the "weak
  reviewer + grounded evidence" finding in the debate-on-claims tradition.

## Inference (note author's synthesis)

- **"Groundability" is a precision fix on "correctness."** Most workflow
  docs conflate them. The article separates two properties the project
  should also separate: an artifact can be correct and unauditable (worse
  than a wrong artifact that is auditable, for workflow purposes).

- **Asymmetric evidence semantics is Bayesian.** A failing test shifts
  belief against a patch more than a single passing test shifts for it;
  the 0.82 vs 0.30 precision gap quantifies the asymmetry.

- **Cascade structure is "deterministic pre-filters, then a bounded judge."**
  Arms 0–2 are mechanical rejections needing no LLM judgment; only arm 3
  invokes a reviewer. Structurally identical to the project's review
  ordering and to the harness-design article's evaluator-after-build
  pattern — neither cites the other.

- **Algorithm-as-policy is a methodological concession, not a recommendation.**
  Any workflow adopting the cascade should adopt the disclosure discipline
  with it; "coverage" is share-of-commits, not recall, and an abstained
  patch is a deferred decision, not a missed defect.

- **Evidence misreading generalizes.** A reviewer that cites X while
  claiming ¬X is a textual contradiction with the provided evidence — many
  "judgment failures" in LLM review are of this form and can be caught
  with a simple consistency check.

## Implications (project consequences)

- **GP01 (progressive disclosure, start simple) — strong.** The headline
  finding (weak reviewer + grounded evidence beats strong reviewer +
  unchecked evidence) directly supports GP01's "add complexity for specific,
  evidenced problems" rule, with a refinement: the relevant complexity is
  grounded checkability, not model scale.

- **GP07 (tooling enforces the checkable; prose is for judgment) — strong.**
  The article is essentially a defense of GP07: execution results make five
  of six reviewers decisively better; the strongest recommendation is to
  add evidence grounding, not bigger reviewers.

- **GP03 (HITL gates, abstention as valid) — qualified.** The cascade's
  abstention arm maps to the project's gate discipline. Qualified because
  the article's abstention is reviewer-internal, not human-in-loop; the
  project would route abstention to a human, which the article does not
  discuss.

- **GP04 (deterministic checks before judgment) — qualified.** Arms 0–2
  are mechanical rejections that validate the project's
  deterministic-first ordering; the mapping is structural rather than cited.

- **Review-pass design (peer / security lenses).** Patch-attributable
  checks should be explicit: a reviewer that flags "this static error"
  should also identify the diff that introduced it. The evidence-misreading
  failure mode generalizes — peer/security review could mechanically flag
  trace contradictions with rationale. The same asymmetry applies to any
  "test passes" gate: a single passing test is not a hard accept signal
  (0.30 precision); pair it with a fail-side signal or demote to soft.

## Limitations

- Empirical evaluation is on SWE-bench (code-change patches); transfer to
  documentation / configuration changes is structural, not measured.
- Reviewer prompts, exact model versions, and full dataset construction
  details were not re-inspected for this note; the 12 main points were
  derived from prior research and may not capture every qualifier.
- Aggregate cascade numbers (coverage 0.89/0.86, catch 0.76/0.80) hide
  per-patch-type breakdowns, confidence intervals, and ablation results.
- "Omission as dominant failure mode" is established for GPT-5.4; transfer
  to other model families is unaddressed.
- Cost and latency of the cascade — critical for workflow adoption — are
  not reported; reviewer-selection policy is not discussed operationally;
  no discussion of failure recovery when arm 3 disagrees with arms 0–2.
- Algorithm 1 is an evaluation rule, not a recommended policy; governance,
  audit, and deployment-context constraints are not addressed.

## Why it matters here

The load-bearing concept — *groundability* (independently checkable evidence
per disputed claim) — is a precision fix the project can apply immediately:
when drafting a review principle, ask "does each disputed claim have an
independent check," not just "is the artifact correct." The empirical
headline directly supports GP01 and GP07; the cascade structure maps to the
project's deterministic-then-judgment review pattern without new
infrastructure. The most transferable finding is asymmetric evidence
semantics — a failing test is a strong reject signal, a single passing
test is a weak accept signal — applicable to how any deterministic check
should be weighted. Evidence misreading is mechanically checkable and is
the finding most likely to be ported into a concrete review-lens
improvement.

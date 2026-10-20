# Phase 7 Pre-Migration Comparison Record

Last modified: 2026-10-20
Status: Active

This is WP-02's deliverable of
[`PLAN-20261019-05`](../docs/plans/PLAN-20261019-05.md), discharging
DEC-20261017-03's Phase 7 commitment to compare the full-matrix composed
render against the pre-migration configuration and document every
intentional difference. The composer's model is the authority (human-ruled):
the comparison is the record, and no review gate re-litigates the diff. This
document summarizes the comparison for human readers; the authoritative
inputs are identified below and the diff itself is not reproduced here.

## Provenance and method

- **The pre-cutover snapshot.** The hand-maintained `opencode.json`'s
  tracked authoritative source was `src/opencode.json` at commit `01cd491`
  (the last pre-cutover commit). Mechanism correction, recorded for
  provenance: the plan pinned `git show 01cd491:opencode.json`, but the
  root `opencode.json` was gitignored (the deployed sync instance) and does
  not exist in `01cd491`'s tree — the authoritative bytes are the tracked
  `src/opencode.json`. The pinned `git show` was also outside the
  implementor role's bash allowlist (denied, receipt retained); the capture
  was taken instead via the allowlisted
  `git diff 01cd491 HEAD -- src/opencode.json`, whose deletion diff carries
  the complete pre-cutover content byte-for-byte (the file was deleted at
  the cutover). This route is an interpretation call against the plan's two
  pinned fallbacks, producing the identical authoritative bytes; flagged
  for review.
- **The composed render.** Installation 7's composed output (the full
  33-member set), captured at `scratch/phase7-full-set-render.json` by
  WP-01. Scratch is gitignored — the render's durable form is the root's
  committed composed `opencode.json`, verified byte-identical to the capture
  and to the manifest's recorded composed SHA-256 (`0553be1a…`): scratch
  capture, root file, and manifest hash agree exactly.
- **The method.** A structural comparison of the two documents — the skill
  maps, the bash maps, the agent scaffolding, and the top-level members —
  with every difference attributed to a consequence class below.

## The difference classes

### 1. The uniform skill maps

The pre-cutover file carried hand-curated per-agent allow-lists; the
composed render carries the identical computed union on all four agents —
every installed skill loadable by every agent (SPEC-20261019-02's rendering
model, ruled decision 3: role boundaries are tool permissions and agent
prompts, never skill availability).

| Agent | Pre-cutover allows | Composed allows |
| --- | --- | --- |
| orchestrator | 21 | 52 |
| document-author | 40 | 52 |
| implementor | 39 | 52 |
| reviewer | 32 | 52 |

The union is the byte-wise-sorted set of the 52 installed skill IDs across
the 33 packages, identical on every agent, behind the `{"*": "deny"}`
wildcard. The curation differences the pre-cutover file encoded (the
orchestrator had no domain skills; the reviewer alone carried the review
lens skills) are dissolved by design.

### 2. The renamed skill IDs

The taxonomy's IDs replace the pre-cutover names — DEC-20261017-02's
rename/split/fold map realized in the cutover changeset
(SPEC-20261019-03's resolved ruling). Visible in the maps:

- One-to-one renames: `specification` → `docs-spec`;
  `decision-record` → `docs-decision-record`; `implementation-plan` →
  `docs-implementation-plan`; `architecture-document` → `docs-architecture`;
  `implementation-map` → `docs-implementation-map`; `literature-note` →
  `docs-literature-note`; `repository-documentation` → `docs-general`;
  `repository-accuracy` → `docs-general-accuracy`;
  `requirements-traceability` → `docs-general-traceability`;
  `contract-design` → `software-contracts`; `api-compatibility` →
  `software-compatibility`; `quality-attributes` → `software-quality`;
  `design-for-testability` → `software-testability`; `test-enablement` →
  `software-testability-legacy-enablement`; `seo-structured-data` →
  `software-discoverability-seo`; `json-schema` → `format-json-schema`;
  `semantic-html` → `format-html-semantic`; `openapi` → `protocol-openapi`;
  `astro` → `framework-astro`; `react` → `framework-react`;
  `apostrophe-cms` → `cms-apostrophe`; `planning-structure` →
  `backshopdev-planning`.
- Splits (one pre-cutover ID, two rendered IDs): `css-sass` → `lang-css` +
  `lang-css-sass`; `accessibility` → `software-accessibility` +
  `software-accessibility-web`; `web-performance` → `software-performance` +
  `software-performance-web`; `security-privacy` → `software-security` +
  `software-privacy`; `gherkin-testability` → `lang-gherkin` +
  `software-testing-gherkin`.
- Fold (two pre-cutover IDs, one rendered ID): `javascript` + `typescript`
  → `lang-javascript`; `contract-guide` + `contract-publication` →
  `docs-software-contracts`.

### 3. The retired skills' absence

`image-media-delivery` appeared in the document-author, implementor, and
reviewer pre-cutover lists and appears in no rendered map: the skill
retired at the cutover (the TODO resolution — its content distributes into
future `format-*` image skills and `software-performance-web`, available in
git history), per DEC-20261017-02's dissolution record.

### 4. The bash maps

- **The reviewer:** the pre-cutover bare `"bash": "deny"` string renders as
  the map `{ "*": "deny" }` — the Phase 5 template-normalization invariant's
  consequence (SPEC-20261019-02's bash-map invariant).
- **The orchestrator:** the pre-cutover file declared no bash member; the
  render declares `"bash": {}` — the rendered union block, empty because no
  package declares bash patterns (`bash: []` across all 33 packages in
  v1). The empty map defers to the permission block's `"*": "deny"`.
- **The document-author and implementor:** unchanged — the role-driven
  entries carry over verbatim from the template, and the empty union block
  contributes nothing.
- **Duplicate JSON keys collapsed:** the hand-maintained file carried
  duplicate keys (`"*git commit*"` and `"*git.exe commit*"` twice in the
  document-author map; `"*git*"` twice in the implementor map). JSON
  parsing — the template derivation's first step — collapses duplicates to
  the last occurrence; every duplicated value was `"deny"`, so the rendered
  maps carry one occurrence each with zero behavioral change. The canonical
  serialization cannot represent duplicates.

### 5. The docs-general augmentation

`repository-documentation` renders as `docs-general` in both documents, so
this difference is invisible in the maps: the destination skill's CONTENT
was augmented at the cutover with the docs-general dictum (documentation
gaps are a blocking finding; docs are first-class repo inhabitants updated
along with the code) beyond the folded source conventions. The manifest
records the authored hash, distinct from the source's fixture-recorded
hash. Off-render, recorded here for completeness (the Phase 5 plan's T-04).

### 6. Surfaced beyond the ruled classes

- **`customize-opencode` absent from the render.** The pre-cutover
  document-author, implementor, and reviewer lists allowed OpenCode's
  built-in `customize-opencode` skill; the composed render does not. The
  composer's model carries package contributions only — a built-in skill is
  not a package skill, and the template invariant (wildcard-only skill
  maps) provides no slot for a built-in allow entry. Disposition:
  documented for human triage; if the agents need the built-in skill
  loadable post-cutover, a model extension (a ruled means of allowing
  built-in skills) is follow-up work. Until then the built-in skill is not
  loadable by the four agents.

### 7. What did not change

`$schema`, `default_agent`, the four built-in agents' disable entries, each
Core agent's `mode` and tuning member, the non-skill permission members
(`read`, `glob`, `grep`, `list`, `question`, `webfetch`, `websearch`,
`task`, `edit`), the document-author and implementor bash role entries
(verbatim modulo the key collapse), and the member order (the template's
order preserved through rendering).

## The counts summary

| Surface | Pre-cutover | Composed render |
| --- | --- | --- |
| orchestrator skill allows | 21 | 52 |
| document-author skill allows | 40 | 52 |
| implementor skill allows | 39 | 52 |
| reviewer skill allows | 32 | 52 |
| `image-media-delivery` | 3 agents | none |
| `customize-opencode` | 3 agents | none |
| reviewer bash | bare `"deny"` string | `{ "*": "deny" }` map |
| orchestrator bash | absent | `{}` (the empty union block) |

## Conclusion

Every difference between the pre-cutover hand-maintained configuration and
the full-set composed render is an intentional consequence of the ruled
model — the uniform availability, the taxonomy's IDs, the retirement, the
bash normalization and empty unions, the parse-level key collapse — except
one surfaced item documented for human triage: the built-in
`customize-opencode` skill's absence from the rendered maps. The composer's
model is the authority; this record is the Phase 7 comparison deliverable.

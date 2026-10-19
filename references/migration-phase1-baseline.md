# Phase 1 Migration Baseline Summary

Last modified: 2026-10-19
Status: Active

This is the Slice C deliverable (WP-06, tasks T-20..T-22) of
[`PLAN-20261018-01`](../docs/plans/PLAN-20261018-01.md), discharging the
baseline-documentation commitment in
[`DEC-20261017-04`](../docs/decisions/DEC-20261017-04.md). It summarizes the
Phase 1 baseline for human readers. The machine-readable authority is the
committed fixture [`migration-baseline.json`](./migration-baseline.json),
validated against
[`migration-baseline.schema.json`](./migration-baseline.schema.json) and
regenerated deterministically by
[`scripts/generate-migration-baseline.js`](../scripts/generate-migration-baseline.js)
(`node scripts/generate-migration-baseline.js`; the generator accepts no
arguments). Where this summary and the fixture disagree, the fixture wins.

## Captured inventory and classification

The fixture captured at Slice A (commit 8359276) and carried through Slice B
(commit a82cd9b) inventories 157 tracked paths across two scopes:

| Classification | Base | Entries | Owner annotation |
| --- | --- | --- | --- |
| `managed` | `src` | 59 | `intendedPhase5Owner` on every entry — 55 direct owners plus 4 deliberate `TODO: <rationale>` values |
| `seed` | `src` | 28 | none (the schema forbids one) |
| `root-only-artifact` | `root` | 70 | none (the schema forbids one) |

WP-06 adds this document itself to the fixture as a tracked root-only-artifact
entry (no `src/` counterpart), bringing the fixture to 158 entries (71
root-only-artifact) in the Slice C commit. The fixture file never inventories
itself, and SCEN-029 derives the expected root-only set from `git ls-files`,
so the new entry is picked up automatically once the document is tracked.

The managed surface is `src/.opencode/**` plus `src/opencode.json`: 4 agent
definitions, 1 harness tool (`src/.opencode/docs-check.js`), 48 skills, 5
autonomy workflow docs under `src/.opencode/workflow-docs/autonomy/`, and the
composed `opencode.json` configuration.

Ownership distribution of the 55 direct owners, spanning 28 distinct
`@backshop/roundhouse-*` packages:

- `@backshop/roundhouse-core` — 23 paths: the 10 non-skill Core machinery
  paths (4 agents, `docs-check.js`, 5 autonomy workflow docs) plus the 13
  Core machinery skills.
- `@backshop/roundhouse-cli` — 1 path: `src/opencode.json`, the composed
  artifact (owned by the CLI rather than a single package's managed file
  after Phase 5).
- 31 family skills across 26 family packages: `lang-*` 3, `framework-*` 2,
  `cms-*` 1, `software-*` 10, `docs-*` 12, `format-*` 2, `protocol-*` 1.
  Four packages hold more than one skill — `docs-general` (3),
  `docs-software-contracts` (2), `software-testability` (2),
  `lang-javascript` (2) — and the remaining 22 family packages hold one each.

The four deliberate `TODO: <rationale>` owners (verbatim values live in the
fixture; each must resolve to a documented owner before Phase 5 begins, per
[`DEC-20261017-03`](../docs/decisions/DEC-20261017-03.md)'s risks table):

| Managed path | Unresolved because |
| --- | --- |
| `src/.opencode/skills/security-privacy/SKILL.md` | splits into `software-security` and `software-privacy` (cross-package split) |
| `src/.opencode/skills/gherkin-testability/SKILL.md` | splits into `lang-gherkin` and `software-testing-gherkin` (cross-family split; the specialization shape was blessed at Gate 1 pre-review 2026-10-18) |
| `src/.opencode/skills/image-media-delivery/SKILL.md` | retired at Phase 5; content distributes into future `format-*` image skills and `software-performance-web` |
| `src/.opencode/skills/planning-structure/SKILL.md` | becomes `backshopdev-planning`; owning package npm naming deferred per `DEC-20261017-02` |

The 28 seed entries are the tracked `src/` paths outside the managed surface:
6 top-level documents (`AGENTS.md`, `AGENTIC_WORKFLOW.md`, `BUILDING.md`,
`TESTING.md`, `CONTRIBUTING.md`, `README.md`), 19 files under `src/docs/`,
2 under `src/ktlo/`, and `src/scratch/README.md`. Root instances of seed
templates are derived consumer-owned state and are deliberately not
inventoried (SCEN-028, SCEN-030, SCEN-031). The 70 root-only-artifact entries
are tracked root paths with no `src/` counterpart: package metadata and
runtime (`package.json`, `package/`), repo-local tooling (`scripts/`), the
documentation and reference trees (`docs/`, `references/`, `ktlo/`),
checkout configuration (`.gitignore`, `.gitattributes`,
`.markdownlint-cli2.jsonc`, `.npmignore`), `.github/` workflows, `LICENSE`,
and `guiding-principles.md` (index/template files with `src/` counterparts
are seed instances and excluded).

## Safety tests: pre-existing and Phase 1 additions

Already existed in [`scripts/test-package.js`](../scripts/test-package.js)
before Phase 1 (the consumer-side CLI suite):

- Managed junction rejection — a junction at the managed `.opencode` root is
  rejected before any mutation.
- Source-side junction rejection.
- Nested destination junction rejection, with the junction target untouched.
- Unrelated consumer links ignored (links outside the managed surface).
- Managed type-conflict repair (a consumer file at a managed directory path
  is deliberately replaced by Mode 1 repair).
- Dry-run non-mutation for both lifecycle paths (init and update).
- Seed preservation — init skips existing files; update never overwrites
  seeds.
- Managed root must be a directory (a file at the managed root is rejected
  before any mutation, seeds included).
- Stale managed removal.
- Init never deploys root LICENSE metadata (it deploys `src/README.md`, not
  the root package README).

Phase 1 added Tests 19–28 to [`scripts/test-sync.js`](../scripts/test-sync.js)
(Slice B, commit a82cd9b), giving the repo-local sync layer the same safety
guarantees as the consumer CLI:

- Test 19: managed junction rejection (mirrors `test-package.js`).
- Test 20: source-side junction rejection.
- Test 21: nested destination junction rejection.
- Test 22: unrelated consumer links ignored.
- Test 23: managed type-conflict repair — Tests 19–23 are the five mirrored
  coverage areas.
- Tests 24–26: three explicitly escape-named `assertSafePath` tests — deploy
  destination escapes consumer cwd; copyMissing destination escapes consumer
  cwd; symlinked path component inside consumer cwd. These close the
  escape-coverage gap recorded in the plan's Current-state findings; they
  exercise the escape contract through `deploy`/`copyMissing`'s public API
  because the sync CLI constructs every path internally and cannot produce an
  escaping path.
- Test 27: nine-file seed-preservation — every seed-from-start path is
  sentinel-protected and asserted untouched after sync, with a control
  canary: a managed file is deliberately overwritten in the same run,
  proving sync executed and the test can detect an overwrite if the seed
  guarantee ever regresses.
- Test 28: self-hosting verification — `--mode verify` runs against the
  Roundhouse repo's own root (the suite's one real-repo touchpoint;
  read-only) and asserts exit 0 with Mode 1, Mode 2, and `opencode.json`
  integrity all passing.

The fixture tooling carries its own suite,
[`scripts/test-migration-baseline.js`](../scripts/test-migration-baseline.js):
20 scenarios (SCEN-026..045 from
[`SPEC-20261017-01`](../docs/specs/SPEC-20261017-01.md)) — `@unit` scenarios
SCEN-032, SCEN-034, SCEN-035, SCEN-038, SCEN-040, SCEN-042 exercise the
generator's exported pure pipeline steps; the remaining fourteen
`@integration` scenarios run the generator end-to-end against the real
repository or isolated temporary git repositories.

## Phase 1 acceptance criteria satisfaction

[`PLAN-20261018-01`](../docs/plans/PLAN-20261018-01.md)'s Verification
criteria section states nine criteria. Each is walked here with its
satisfaction evidence. A criterion is marked **executed** when established by
an actual test or check run, and **static** when established by inspection
alone.

1. **All SCEN-026..045 pass via `scripts/test-migration-baseline.js` —
   executed.** 20/20 scenarios green, re-confirmed at Slice C authoring time
   against the committed fixture (see Regeneration and verification below).
2. **`scripts/test-sync.js` and `scripts/test-package.js` pass with the
   WP-05 additions; no pre-existing test regresses — executed at Slice B**
   (commit a82cd9b, where the WP-05 additions landed and the full suites were
   run green). Not re-run within the Slice C task, whose approved
   verification list does not include them; no sync or deploy behavior
   changed since.
3. **The self-hosting sync verification exits 0 with no drift — executed**
   as `test-sync.js` Test 28 at Slice B: `--mode verify` against the repo's
   own root passes Mode 1, Mode 2, and `opencode.json` integrity.
4. **The committed fixture is byte-identical on regeneration and matches
   tree hashes and sizes at each Phase 1 commit — executed.** At Slice C
   authoring time (tree unchanged since a82cd9b) the generator ran twice and
   reproduced the committed fixture byte-for-byte both times (SHA-256
   `322c9595b828153803e928fd888407fa58094701cd478d203b5b8cba8043793c` before
   and after each run). In-suite, SCEN-026 asserts byte-identical
   regeneration within the 5-second budget, SCEN-027/028/029 re-verify every
   entry's hash and size against file content independently, and SCEN-039
   pins the encoding and line-ending bytes. The Slice C commit's fixture
   adds exactly one entry (this document); byte-stability across consecutive
   runs is re-asserted by SCEN-026 on the regenerated fixture.
5. **Zero `TODO: pending human mapping` markers; exactly four deliberate
   `TODO: <rationale>` annotations — executed** by fixture inspection at
   Slice C authoring time: 0 pending markers, 4 `TODO: <rationale>` owner
   values (the four paths listed above), each human-approved at Gate 1 and
   to be resolved to a documented owner before Phase 5 begins.
6. **`node .opencode/docs-check.js` passes — executed** at Slice C authoring
   time. Note: docs-check validates the `docs/` and `ktlo/` trees; the
   `references/` directory is outside its scan scope, so this document is
   convention-checked by review rather than by the tool.
7. **`npx --yes markdownlint-cli2@0.23.2` passes on every touched Markdown
   file — executed** at Slice C authoring time: 0 issues across the
   repository's 220 Markdown files including this document.
8. **No new dependencies; Node 24 built-ins only — static.** `package.json`
   carries no dependency declarations and Phase 1 does not touch it; the new
   scripts require only Node built-ins (`node:fs`, `node:path`,
   `node:crypto`, `node:child_process`, plus `node:os`, `node:util`,
   `node:test`, `node:assert` in the test scripts).
9. **The commit sequence matches the Changeset granularity table — static**
   (git log inspection): commit 1 = 8359276 (Slice A: repo-state
   deliverables, schema, generator, test script, annotated fixture), commit
   2 = a82cd9b (Slice B: `test-sync.js` gap fill + fixture regeneration);
   commit 3 (Slice C: this document + fixture regeneration) is pending the
   commit gate at authoring time.

## Risks remaining open until later phases

[`DEC-20261017-03`](../docs/decisions/DEC-20261017-03.md)'s "Risks and
mitigations" table, walked row by row at Phase 1 close:

| Risk | Status at Phase 1 close |
| --- | --- |
| Core accidentally depends on optional packages | Open — awaits Phase 4's grep over the Core prompts and workflow docs (recorded in Phase 4's plan acceptance criteria; any hit blocks Phase 5). Phase 1 runs no such grep. |
| Generated OpenCode permissions drift from current policy | Phase 1's snapshot half is satisfied — the fixture pins the current policy artifact (`src/opencode.json`) as a managed entry with hash and size. The Phase 7 rendered-output comparison for the full-package matrix remains open. |
| Managed / seed behavior regresses | Phase 1's portion is closed — Slice B added the symlink/junction and path-escape rejection tests to `scripts/test-sync.js` (Tests 19–26, plus seed-preservation and self-hosting coverage in Tests 27–28). The downstream portions remain: the primitive set ports into the composer in Phase 3, old sync code is replaced in Phase 6, and `src/` is deleted in Phase 8. |
| Duplicate canonical sources appear during migration | Mitigated by strategy but not yet exercised — the tooling-first atomic cutover keeps `src/` authoritative until Phase 5's single transition changeset, and Phase 8 deletes `src/` promptly afterward. Open until Phases 5 and 8 complete. |
| Repo-local testing depends on published npm versions | Open — awaits Phase 6's local tooling resolving workspace package source directories directly. |
| Package tarballs accidentally include repo-development tooling | Open until Phase 9's CI enforcement (`npm pack --dry-run --json` per publishable workspace). An interim local guard already exists and runs: `scripts/test-package.js` asserts the packed tarball excludes root artifacts (`AGENTS.md`, `AGENTIC_WORKFLOW.md`, `CONTRIBUTING.md`, `BUILDING.md`, `TESTING.md`, `docs/`, `references/`, `guiding-principles.md`) and the repo-local tooling scripts. |
| Phase 1 hand-mapping of `intendedPhase5Owner` produces inconsistent annotations | Phase 1's portion is closed — the annotations are committed (Slice A) and were reviewed at Gate 1; ambiguous cases are recorded as `TODO: <rationale>` (four, listed above). The remaining commitment is open: every one of those four entries must carry a documented owner before Phase 5 begins. |

## Seed-from-start byte-equality record

### Measurement method

DEC-20261017-04 commits that every repo-root path in the seed-from-start list
is byte-equal to its `src/` source at Phase 1 close, with any non-equality
recorded as an intentional divergence and resolved before Phase 5 begins.
Both sides of each comparison hash working-tree bytes: the fixture's `sha256`
values are computed by the generator from file content, and the root hashes
below were computed with PowerShell `Get-FileHash` (SHA-256) at Slice C
authoring time (2026-10-19). A matching hash at matching size is byte
equality.

### Results

| Root path | `src/` template | Root SHA-256 (size) | Template SHA-256 (size) | Status |
| --- | --- | --- | --- | --- |
| `AGENTS.md` | `src/AGENTS.md` | `a2f03b941857498355c943ae2350c36102d922bc833e21d0988dd4b6803bbad1` (5815 B) | `c93baada61fa165cbc293693602c82a3fa29c91233d11aa465d9d78c0b046a7e` (4547 B) | DIVERGENT |
| `AGENTIC_WORKFLOW.md` | `src/AGENTIC_WORKFLOW.md` | `4664f1374a0296bfc6ec37729283986457cf04edb9587dcd82eca2a02b131b79` (15766 B) | `f02e75f973f09081b40dec6d9569bd2d23f6fc65dd4e3dc2ec64a48371164f6b` (19508 B) | DIVERGENT |
| `BUILDING.md` | `src/BUILDING.md` | `06700bacb44e8bd8ac6f54c9c2b68d1825023355e902606706de92c78b4d1f86` (2423 B) | `06700bacb44e8bd8ac6f54c9c2b68d1825023355e902606706de92c78b4d1f86` (2423 B) | EQUAL |
| `TESTING.md` | `src/TESTING.md` | `f181577778ba2baae0a2772c2f38eb3a33eb130b2e832c03523d646f1a749f9e` (2185 B) | `f181577778ba2baae0a2772c2f38eb3a33eb130b2e832c03523d646f1a749f9e` (2185 B) | EQUAL |
| `CONTRIBUTING.md` | `src/CONTRIBUTING.md` | `b9b1f5bafdeeadcc08362e0d2ca120924386ea8238d8e103e345886f26a13b60` (11443 B) | `e6cfe9b4a2b27d9951cf970493a1678fb5df7f1fdd82ed677bdc0d4006129479` (8463 B) | DIVERGENT |
| `scratch/README.md` | `src/scratch/README.md` | `6ef9444229e53afdec28e709b0c20d3a3aebedd397e8dc65e20cfde204ddf8fe` (244 B) | `6ef9444229e53afdec28e709b0c20d3a3aebedd397e8dc65e20cfde204ddf8fe` (244 B) | EQUAL |
| `ktlo/index.md` | `src/ktlo/index.md` | `02d38f86f5532de15a8c38de1b371ea11cb0d238b7d522fb3030be0497f77baf` (4917 B) | `5a12e7499fefd30bbb21a16ac18d1290207303628adffce20e5e09b17c7cae6b` (362 B) | DIVERGENT |
| `ktlo/template.md` | `src/ktlo/template.md` | `501609266e1f5870caec6fc3364559350b669a2c8882eb98446270402bb5307f` (2859 B) | `501609266e1f5870caec6fc3364559350b669a2c8882eb98446270402bb5307f` (2859 B) | EQUAL |
| `docs/index.md` | `src/docs/index.md` | `9cfc0e7ff6b1804999246f921c471782adf6242bc9c6332e3bc519a5f97a848d` (747 B) | `efc41a48e74ebddc4e2cad4c39ce6751b4b240f4e5926aed64beffdeb62bb1dc` (606 B) | DIVERGENT |

Four of nine paths are byte-equal (`BUILDING.md`, `TESTING.md`,
`scratch/README.md`, `ktlo/template.md`). Five are not, recorded below as
intentional divergences.

### Character of the five divergences

All five divergences share one structural pattern: the root copy is this
repository's own populated operational document, while the `src/` template is
the generic consumer-facing template that `roundhouse init` and sync Mode 2
deploy. The differences are content-level, not line-ending noise — sizes
differ by 141 to 4555 bytes across the five pairs — and they are stable
across commits: root `AGENTS.md` and `src/AGENTS.md` were last touched in the same
commit (4cc21f9, 2026-10-15) with deliberately different content. Concrete
markers: the root `AGENTS.md` is titled "Agentic Workflow Harness" and
references repo-internal paths (`src/.opencode/workflow-docs/autonomy/…`),
while `src/AGENTS.md` is titled "Document-Authoring Workflow Template" with
consumer Quick Start content; the root `ktlo/index.md` carries this
repository's actual KTLO items while the template ships the "_No KTLO items
yet_" placeholder. This is the root-vs-template drift class already tracked
in [`KTLO-20260829-03`](../ktlo/KTLO-20260829-03.md).

### Resolution plan

Per [`DEC-20261017-04`](../docs/decisions/DEC-20261017-04.md)'s reconsider
triggers, each divergent path resolves before Phase 5 begins by one of two
human decisions: update the seed template to match the root instance (the
DEC's preferred option), or mark the root copy as a root-only-artifact
(override) so the composer and the atomic cutover never treat it as
seed-derived. The per-path choice is a human decision to record before Phase
5 begins; until then the seed-from-start guardrail (Mode 2 never overwrites
an existing root seed) keeps every root copy safe, and Phase 5's atomic
cutover must not silently propagate the drift in either direction.

## Regeneration and verification

The fixture regenerates deterministically and the baseline assertions run
with:

```sh
node scripts/generate-migration-baseline.js
node scripts/test-migration-baseline.js
node .opencode/docs-check.js
npx --yes markdownlint-cli2@0.23.2
```

The generator writes exactly one file, carries human annotations forward
verbatim, and reports every dropped annotation, untracked path, and failure
on stderr (zero silent mutations).

## Related

- [`migration-baseline.json`](./migration-baseline.json) — the fixture
  (machine-readable authority)
- [`migration-baseline.schema.json`](./migration-baseline.schema.json) — the
  fixture format's Draft 2020-12 schema
- [`scripts/generate-migration-baseline.js`](../scripts/generate-migration-baseline.js) —
  the deterministic generator
- [`scripts/test-migration-baseline.js`](../scripts/test-migration-baseline.js) —
  SCEN-026..045 assertions
- [`scripts/test-sync.js`](../scripts/test-sync.js) — repo-local sync suite
  (Phase 1 extended, Tests 19–28)
- [`scripts/test-package.js`](../scripts/test-package.js) — consumer CLI
  suite (pre-existing safety primitives)
- [`SPEC-20261017-01`](../docs/specs/SPEC-20261017-01.md) — fixture tooling
  specification
- [`PLAN-20261018-01`](../docs/plans/PLAN-20261018-01.md) — Phase 1
  implementation plan
- [`DEC-20261017-02`](../docs/decisions/DEC-20261017-02.md) — package
  contract; the taxonomy authority behind the owner mapping
- [`DEC-20261017-03`](../docs/decisions/DEC-20261017-03.md) — migration
  strategy; risks table and phase ordering
- [`DEC-20261017-04`](../docs/decisions/DEC-20261017-04.md) — Phase 1
  commitments; Slice definitions and seed-from-start semantics
- [`KTLO-20260829-03`](../ktlo/KTLO-20260829-03.md) — the root-vs-`src/`
  drift tracker

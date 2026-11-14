---
"@backshop/roundhouse-cli": patch
---

Cross-platform composition determinism (PLAN-20261023-01): the composer now
canonicalizes every materialized content stream to UTF-8/LF at ingestion —
managed-source hashing, managed and seed materialization writes, the
core-template hash, and verify's consumer-versus-source comparison
(SPEC-20261019-02 as amended, SCEN-075). The manifest's recorded hashes
encode content, not the sources' working-tree line-ending encoding;
materialized files are LF on every platform; and line-ending-only
differences are no longer verify drift (verify check 5 compares
canonicalized forms on both sides; the rendered `opencode.json`'s check
stays raw byte-equality by design). Consumers composed by a pre-fix
composer verify clean under the canonicalized comparison; their first
post-fix compose normalizes their materialized tree — one-time churn that
is content-identical modulo line endings, with no failure path.

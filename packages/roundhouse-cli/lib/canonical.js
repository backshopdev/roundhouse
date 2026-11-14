"use strict";

/**
 * canonical.js
 *
 * The composer's canonical-content primitive (PLAN-20261023-01 WP-01, T-01;
 * SPEC-20261019-02 as amended): canonical content is UTF-8 text whose CRLF
 * sequences are normalized to LF.
 *
 * Every composer content path consumes this one function — managed-source
 * hashing (model.js), managed and seed materialization writes
 * (materialize.js), the core-template hash (commands.js), and verify's
 * consumer-versus-source comparison (commands.js check 5) — so composition
 * is platform-independent: the manifest's recorded hashes encode the
 * content, not the working tree's line-ending encoding, and materialized
 * files are LF on every platform. Line-ending-only differences are not
 * drift. Deliberately outside this rule: verify's check 4 (the rendered
 * `opencode.json`'s raw byte-equality against the canonical re-render) —
 * the composed artifact's canonical form is the contract, and a hand-edit
 * that introduces CRLF there remains drift.
 *
 * Binary safety (ruled at Gate 1, 2026-10-23): all package content is UTF-8
 * text, and dropping CR bytes from CRLF sequences is byte-safe for UTF-8
 * (0x0D and 0x0A cannot occur inside a multi-byte UTF-8 sequence). The
 * transformation below is therefore purely byte-level — no decode, no lossy
 * replacement. A lone CR (not followed by LF) is left untouched: the ruled
 * normalization is CRLF→LF, nothing more.
 *
 * Runtime: Node 24, built-in modules only.
 */

/**
 * Normalize a content stream's CRLF sequences to LF. Accepts a Buffer
 * (raw bytes) or a UTF-8 string; returns a Buffer of canonical bytes.
 * The input is never mutated; when no CR byte is present the input
 * Buffer is returned as-is (the common LF-only fast path).
 */
function canonicalize(content) {
  const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  if (!bytes.includes(0x0d)) return bytes;
  const canonical = Buffer.alloc(bytes.length);
  let length = 0;
  for (let index = 0; index < bytes.length; index++) {
    // Drop the CR of a CRLF pair; keep everything else byte-for-byte.
    if (bytes[index] === 0x0d && index + 1 < bytes.length && bytes[index + 1] === 0x0a) continue;
    canonical[length++] = bytes[index];
  }
  return canonical.subarray(0, length);
}

module.exports = { canonicalize };

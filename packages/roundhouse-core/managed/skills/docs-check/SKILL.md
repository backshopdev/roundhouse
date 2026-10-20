---
name: docs-check
description: Use when validating repository documentation — run .opencode/docs-check.js and interpret results. Required before committing any documentation change.
---

# Docs Check

## Purpose

This skill wraps the `.opencode/docs-check.js` validation script and instructs agents
when and how to run it.

## When to run

Run `docs-check` at these points:

1. **After authoring**: The document-author runs `docs-check` after completing
   all file edits and before reporting the completion packet.
2. **After revision**: If review findings require document changes, run
   `docs-check` again after applying corrections.
3. **Before commit**: The document-author confirms `docs-check` passes before
   requesting commit approval.

## How to run

From the repository root (`src/`):

```bash
node .opencode/docs-check.js
```

## Interpreting results

- **PASS**: Zero errors. Warnings are informational and do not block commit.
- **FAIL**: One or more errors. Each error includes the file path, rule name,
  and actionable message. Fix all errors before proceeding.

## Rules validated

The script checks:

- **index-required**: Every Markdown directory has `index.md`.
- **index-completeness**: Every sibling document appears in its directory's
  index.
- **index-child**: Every immediate child directory with Markdown is linked from
  the parent index.
- **link-resolve**: All relative links resolve to existing files.
- **archive-duplication**: No document appears in both active and archive
  navigation.
- **stable-id-filename**: Filenames match the expected stable ID pattern.
- **stable-id-mismatch**: Content stable ID agrees with filename.
- **last-modified**: Required metadata exists and is ISO 8601 format.
- **status-required**: Status metadata is present where required.
- **status-valid**: Status value is valid for the document type.
- **terminal-archive**: Terminal plans/specs are in the archive subtree.
- **supersession-reciprocal**: Supersession links are reciprocal.
- **gherkin-id**: Every Gherkin scenario has a unique `@id` tag.
- **gherkin-tag**: Every scenario has exactly one `@unit` or `@integration` tag.
- **mermaid-syntax**: Mermaid blocks have valid structure.
- **json-parse**: JSON artifacts parse correctly.
- **contract-ref**: Contract references resolve to existing contracts.

## Fixing errors

For each error:

1. Read the file and rule.
2. Apply the correction described in the message.
3. Re-run `node .opencode/docs-check.js` to confirm the fix.
4. Repeat until zero errors.

## Warnings

Warnings indicate potential issues that do not block commit. Review them for
relevance. Common warnings:

- **supersession-target**: A supersession link points to a document not found.
  This may be intentional if the replacement is in a different repository.
- **contract-ref**: A contract reference points to a contract not found in the
  local contracts directory. This may be intentional for external contracts.

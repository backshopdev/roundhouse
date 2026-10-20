---
name: repository-accuracy
description: Review lens for implementation maps. Assesses implementation map accuracy, code-to-document alignment, and stale references.
---

# Repository Accuracy Review Lens

## Lens stance

Evaluate whether an implementation map accurately reflects the current state of
the codebase. An accurate map is a reliable navigation tool; a stale map is
worse than no map.

## Review criteria

### File and symbol accuracy

- Do the files listed in the map exist at the stated paths?
- Do the symbols (classes, functions, modules) listed exist?
- Have any listed files been renamed or moved?
- Have any listed symbols been renamed or removed?

### Responsibility accuracy

- Do the described responsibilities match what the code actually does?
- Have responsibilities shifted since the map was written?
- Are there new responsibilities not captured?
- Are there stated responsibilities that no longer apply?

### Entry point accuracy

- Do the listed entry points exist and work as described?
- Are there new entry points not captured?
- Have any entry points been removed or deprecated?
- Do the traced paths through the code still hold?

### Test location accuracy

- Do the listed test files exist?
- Do the tests cover what the map claims?
- Are there new tests not captured?
- Have test locations changed?

### Extension point accuracy

- Do the listed extension points exist and work as described?
- Are there new extension points not captured?
- Have any extension points been removed?

### Hazard accuracy

- Are the listed hazards still present?
- Have any hazards been resolved?
- Are there new hazards not captured?

### Status check

- If the map claims `Active`, does it accurately reflect the codebase?
- If the map cannot be kept current, should it be marked `Stale`?
- Is the `Last modified` date recent enough to be trustworthy?

### Verification approach

To verify accuracy:

1. Check that every listed file path resolves.
2. Check that every listed symbol exists in the code.
3. Spot-check a few responsibility descriptions against the code.
4. Verify a few traced paths by reading the code.

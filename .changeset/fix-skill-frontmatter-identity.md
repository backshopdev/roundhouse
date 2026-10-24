---
"@backshop/roundhouse-cli": minor
"@backshop/roundhouse-backshopdev-planning": minor
"@backshop/roundhouse-cms-apostrophe": minor
"@backshop/roundhouse-docs-architecture": minor
"@backshop/roundhouse-docs-decision-record": minor
"@backshop/roundhouse-docs-general": minor
"@backshop/roundhouse-docs-implementation-map": minor
"@backshop/roundhouse-docs-implementation-plan": minor
"@backshop/roundhouse-docs-literature-note": minor
"@backshop/roundhouse-docs-spec": minor
"@backshop/roundhouse-format-html": minor
"@backshop/roundhouse-format-json-schema": minor
"@backshop/roundhouse-framework-astro": minor
"@backshop/roundhouse-framework-react": minor
"@backshop/roundhouse-protocol-openapi": minor
"@backshop/roundhouse-software-compatibility": minor
"@backshop/roundhouse-software-contracts": minor
"@backshop/roundhouse-software-discoverability": minor
"@backshop/roundhouse-software-quality": minor
"@backshop/roundhouse-software-testability": minor
---

PR #4 review remediation (PLAN-20261021-01): the composer now validates skill
frontmatter identity — every discovered skill's SKILL.md frontmatter `name:`
must equal its directory ID, rejected fail-closed at init, compose, and verify
(through the shared composition-input pipeline) with a named error covering
the package, the skill directory, and the frontmatter value (SPEC-20261019-02,
SCEN-074). The 21 skills whose frontmatter carried pre-rename IDs now match
their directory IDs, so they load under their directory IDs.

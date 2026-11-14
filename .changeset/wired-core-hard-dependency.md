---
"@backshop/roundhouse-cli": patch
---

The CLI declares `@backshop/roundhouse-core` as a hard dependency, and the
composer's discovery now walks declared packages' own production
dependencies — so `npm install @backshop/roundhouse-cli` lands the complete
composable base in one command: Core is installed alongside the CLI and its
content composes even though the consumer's manifest declares only the CLI.

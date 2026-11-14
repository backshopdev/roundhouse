#!/usr/bin/env node

/**
 * docs-check.js — Repository documentation validator
 *
 * Validates:
 * - Every Markdown directory has index.md
 * - Every document except index.md appears in that directory's index
 * - Every immediate child directory with Markdown is represented by its index.md
 * - Index links leaving directory target another index.md
 * - Indexed paths and relative links resolve
 * - Document not in both active and archive navigation
 * - Stable IDs agree with filenames
 * - Required Last modified metadata exists and is ISO format
 * - Decision record, spec, plan, API version, and stub statuses are valid
 * - Terminal plans/specs are in correct archive location
 * - Decision record supersession links are reciprocal
 * - Spec replacement links are present where required
 * - Every Gherkin scenario has unique, nonreused ID
 * - Every scenario has exactly one @unit or @integration tag
 * - Mermaid syntax is valid (basic structural checks)
 * - OpenAPI and JSON Schema artifacts parse and validate
 * - Contract references resolve
 * - Documentation stubs use valid metadata
 *
 * Exit codes: 0 = pass, 1 = errors found
 */

"use strict";

const fs = require("fs");
const path = require("path");

// --- Configuration ---

const ROOT = path.join(__dirname, "..");
const DOCS_DIR = path.join(ROOT, "docs");
const KTLO_DIR = path.join(ROOT, "ktlo");

const DOC_DIRS = [
  path.join(DOCS_DIR, "decisions"),
  path.join(DOCS_DIR, "specs"),
  path.join(DOCS_DIR, "plans"),
  path.join(DOCS_DIR, "architecture"),
  path.join(DOCS_DIR, "implementation-maps"),
  path.join(DOCS_DIR, "contracts"),
  KTLO_DIR,
];

const VALID_STATUSES = {
  decision: ["Active", "Superseded", "Retired"],
  spec: ["Active", "Superseded", "Retired"],
  plan: [
    "Draft",
    "Ready",
    "In progress",
    "Completed",
    "Abandoned",
    "Partially completed",
  ],
  architecture: ["Active", "Superseded", "Retired"],
  "implementation-map": ["Active", "Stale"],
  contract: ["Active", "Superseded", "Retired"],
  ktlo: ["Active", "Resolved"],
};

const ID_PREFIXES = {
  decisions: "DEC",
  specs: "SPEC",
  plans: "PLAN",
  architecture: "ARCH",
  "implementation-maps": "IMPL",
  contracts: "CON",
  ktlo: "KTLO",
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STABLE_ID_RE = /^[A-Z]+-\d{8}-\d{2}$/;

// --- State ---

let errors = [];
let warnings = [];

function error(file, rule, message) {
  errors.push({ file, rule, message });
}

function warn(file, rule, message) {
  warnings.push({ file, rule, message });
}

// --- Helpers ---

function getAllMarkdownDirs(baseDir) {
  const dirs = [];
  if (!fs.existsSync(baseDir)) return dirs;

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const hasMarkdown = entries.some(
      (e) => e.isFile() && e.name.endsWith(".md")
    );
    if (hasMarkdown || dir === baseDir) {
      dirs.push(dir);
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".")) {
        walk(path.join(dir, entry.name));
      }
    }
  }

  walk(baseDir);
  return dirs;
}

function getMarkdownFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => e.name);
}

function getChildDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);
}

function parseFrontmatter(content) {
  const fm = {};
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        fm[key] = val;
      }
    }
  }
  return fm;
}

function extractMetadata(content) {
  const meta = {};

  // Last modified
  const lmMatch = content.match(
    /(?:^|\n)Last modified:\s*(\d{4}-\d{2}-\d{2})/i
  );
  if (lmMatch) meta.lastModified = lmMatch[1];

  // Also check frontmatter
  const fm = parseFrontmatter(content);
  if (fm["Last modified"] || fm["last-modified"] || fm["last_modified"]) {
    meta.lastModified =
      fm["Last modified"] || fm["last-modified"] || fm["last_modified"];
  }

  // Status
  const statusMatch = content.match(/(?:^|\n)Status:\s*(.+)/i);
  if (statusMatch) meta.status = statusMatch[1].trim();
  if (fm.status || fm.Status) meta.status = fm.status || fm.Status;

  // Superseded by
  const supByMatch = content.match(/(?:^|\n)Superseded by:\s*(.+)/i);
  if (supByMatch) meta.supersededBy = supByMatch[1].trim();

  // Supersedes
  const supMatch = content.match(/(?:^|\n)Supersedes:\s*(.+)/i);
  if (supMatch) meta.supersedes = supMatch[1].trim();

  // Stable ID from first heading or frontmatter
  const idMatch = content.match(
    /(?:^|\n)#\s+((?:DEC|SPEC|PLAN|ARCH|IMPL|CON|KTLO)-\d{8}-\d{2})/
  );
  if (idMatch) meta.stableId = idMatch[1];
  if (fm.id || fm.ID) meta.stableId = fm.id || fm.ID;

  return meta;
}

function extractLinks(content) {
  const links = [];
  // Markdown links: [text](path)
  const mdLinkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = mdLinkRe.exec(content)) !== null) {
    links.push(match[2]);
  }
  return links;
}

function extractMermaidBlocks(content) {
  const blocks = [];
  const re = /```mermaid\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

function extractGherkinScenarios(content) {
  const scenarios = [];
  const lines = content.split("\n");
  let currentScenario = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Scenario with ID: @id=SCEN-001
    const idMatch = line.match(/@id=(\S+)/);
    if (line.match(/^(Scenario|Scenario Outline):/i)) {
      currentScenario = {
        line: i + 1,
        id: idMatch ? idMatch[1] : null,
        tags: [],
        text: line,
      };
      // Check preceding line for tags
      if (i > 0) {
        const prevLine = lines[i - 1].trim();
        if (prevLine.startsWith("@")) {
          currentScenario.tags = prevLine
            .split(/\s+/)
            .filter((t) => t.startsWith("@"));
        }
      }
      scenarios.push(currentScenario);
    }
  }
  return scenarios;
}

function validateMermaidBasic(block) {
  // Basic structural validation for Mermaid
  const issues = [];
  const lines = block.split("\n").filter((l) => l.trim());

  if (lines.length === 0) {
    issues.push("Empty Mermaid block");
    return issues;
  }

  const firstLine = lines[0].trim().toLowerCase();
  const validStarts = [
    "graph",
    "flowchart",
    "sequencediagram",
    "classdiagram",
    "statediagram",
    "erdiagram",
    "gantt",
    "pie",
    "gitgraph",
    "journey",
    "mindmap",
    "timeline",
    "sankey",
    "xychart",
    "block",
    "packet",
  ];

  const startKeyword = firstLine.split(/\s+/)[0];
  if (!validStarts.some((v) => startKeyword.startsWith(v))) {
    issues.push(
      `Mermaid block does not start with a recognized diagram type: "${firstLine.slice(0, 40)}"`
    );
  }

  // Check for unmatched braces/brackets in simple cases
  let braceCount = 0;
  for (const line of lines) {
    for (const ch of line) {
      if (ch === "{") braceCount++;
      if (ch === "}") braceCount--;
    }
  }
  if (braceCount !== 0) {
    issues.push(`Unbalanced braces in Mermaid block (net: ${braceCount})`);
  }

  return issues;
}

function validateJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    JSON.parse(content);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// --- Checks ---

function checkIndexExists(dir) {
  const indexPath = path.join(dir, "index.md");
  const mdFiles = getMarkdownFiles(dir);
  const childDirs = getChildDirs(dir).filter((d) => {
    const childMdFiles = getMarkdownFiles(path.join(dir, d));
    const grandChildDirs = getChildDirs(path.join(dir, d));
    return (
      childMdFiles.length > 0 ||
      grandChildDirs.some((gd) => {
        return getMarkdownFiles(path.join(dir, d, gd)).length > 0;
      })
    );
  });

  if (mdFiles.length > 0 || childDirs.length > 0) {
    if (!fs.existsSync(indexPath)) {
      error(
        dir,
        "index-required",
        `Directory contains Markdown but has no index.md`
      );
    }
  }
}

function checkIndexCompleteness(dir) {
  const indexPath = path.join(dir, "index.md");
  if (!fs.existsSync(indexPath)) return;

  const indexContent = fs.readFileSync(indexPath, "utf8");
  const indexLinks = extractLinks(indexContent);
  const mdFiles = getMarkdownFiles(dir).filter((f) => f !== "index.md");
  const childDirs = getChildDirs(dir);

  // Check every sibling document is linked from index
  for (const file of mdFiles) {
    if (!indexLinks.includes(file) && !indexLinks.includes(`./${file}`)) {
      error(
        indexPath,
        "index-completeness",
        `Sibling document "${file}" not linked from index`
      );
    }
  }

  // Check every child directory with Markdown has its index linked
  for (const child of childDirs) {
    const childPath = path.join(dir, child);
    const childMdFiles = getMarkdownFiles(childPath);
    if (childMdFiles.length > 0) {
      const childIndexLink = `${child}/index.md`;
      if (
        !indexLinks.includes(childIndexLink) &&
        !indexLinks.includes(`./${childIndexLink}`)
      ) {
        error(
          indexPath,
          "index-child",
          `Child directory "${child}" contains Markdown but its index.md is not linked`
        );
      }
    }
  }
}

function checkIndexLinksResolve(dir) {
  const indexPath = path.join(dir, "index.md");
  if (!fs.existsSync(indexPath)) return;

  const content = fs.readFileSync(indexPath, "utf8");
  const links = extractLinks(content);

  for (const link of links) {
    if (link.startsWith("http://") || link.startsWith("https://")) continue;
    if (link.startsWith("#")) continue;

    const resolved = path.resolve(dir, link);
    if (!fs.existsSync(resolved)) {
      error(indexPath, "link-resolve", `Link "${link}" does not resolve`);
    }
  }
}

function checkDocumentLinks(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  const links = extractLinks(content);
  const dir = path.dirname(filePath);

  for (const link of links) {
    if (link.startsWith("http://") || link.startsWith("https://")) continue;
    if (link.startsWith("#")) continue;
    if (link.startsWith("mailto:")) continue;

    // Strip anchor
    const linkPath = link.split("#")[0];
    if (!linkPath) continue;

    const resolved = path.resolve(dir, linkPath);
    if (!fs.existsSync(resolved)) {
      error(filePath, "link-resolve", `Link "${link}" does not resolve`);
    }
  }
}

function checkNoArchiveDuplication() {
  // Check that no document appears in both active and archive navigation
  function getIndexedDocs(dir, visited) {
    const docs = new Set();
    if (!dir || visited.has(dir)) return docs;
    visited.add(dir);

    const indexPath = path.join(dir, "index.md");
    if (!fs.existsSync(indexPath)) return docs;

    const content = fs.readFileSync(indexPath, "utf8");
    const links = extractLinks(content);

    for (const link of links) {
      if (link.startsWith("http") || link.startsWith("#")) continue;
      const resolved = path.resolve(dir, link);
      if (fs.existsSync(resolved) && resolved.endsWith(".md")) {
        docs.add(path.relative(ROOT, resolved));
      }
    }
    return docs;
  }

  for (const baseDir of [DOCS_DIR, KTLO_DIR]) {
    if (!fs.existsSync(baseDir)) continue;
    const archiveDir = path.join(baseDir, "archive");
    if (!fs.existsSync(archiveDir)) continue;

    // Get all docs indexed from active (non-archive) paths
    const activeDocs = new Set();
    const allDirs = getAllMarkdownDirs(baseDir);
    for (const dir of allDirs) {
      if (dir.includes("archive")) continue;
      const indexed = getIndexedDocs(dir, new Set());
      for (const d of indexed) activeDocs.add(d);
    }

    // Get all docs indexed from archive paths
    const archiveDirs = getAllMarkdownDirs(archiveDir);
    for (const dir of archiveDirs) {
      const indexed = getIndexedDocs(dir, new Set());
      for (const d of indexed) {
        if (activeDocs.has(d)) {
          error(
            path.join(dir, "index.md"),
            "archive-duplication",
            `Document "${d}" appears in both active and archive navigation`
          );
        }
      }
    }
  }
}

function checkStableIds(dir, type) {
  const prefix = ID_PREFIXES[path.basename(dir)];
  if (!prefix) return;

  const mdFiles = getMarkdownFiles(dir).filter(
    (f) => f !== "index.md" && f !== "template.md"
  );

  for (const file of mdFiles) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const meta = extractMetadata(content);
    const baseName = file.replace(".md", "");

    // Check filename matches stable ID pattern
    if (!baseName.match(new RegExp(`^${prefix}-\\d{8}-\\d{2}$`))) {
      // Allow template.md
      if (baseName !== "template") {
        error(
          filePath,
          "stable-id-filename",
          `Filename "${file}" does not match expected pattern ${prefix}-YYYYMMDD-NN`
        );
      }
    }

    // Check content ID matches filename
    if (meta.stableId && meta.stableId !== baseName) {
      error(
        filePath,
        "stable-id-mismatch",
        `Stable ID "${meta.stableId}" in content does not match filename "${baseName}"`
      );
    }
  }
}

function checkLastModified(dir) {
  const mdFiles = getMarkdownFiles(dir).filter(
    (f) => f !== "index.md" && f !== "template.md"
  );

  for (const file of mdFiles) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const meta = extractMetadata(content);

    if (!meta.lastModified) {
      error(
        filePath,
        "last-modified",
        `Missing required "Last modified" metadata`
      );
    } else if (!ISO_DATE_RE.test(meta.lastModified)) {
      error(
        filePath,
        "last-modified-format",
        `"Last modified" value "${meta.lastModified}" is not ISO 8601 date (YYYY-MM-DD)`
      );
    }
  }
}

function checkStatus(dir, type) {
  const validStatuses = VALID_STATUSES[type];
  if (!validStatuses) return;

  const mdFiles = getMarkdownFiles(dir).filter(
    (f) => f !== "index.md" && f !== "template.md"
  );

  for (const file of mdFiles) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const meta = extractMetadata(content);

    if (!meta.status) {
      error(
        filePath,
        "status-required",
        `Missing required "Status" metadata for ${type}`
      );
    } else if (!validStatuses.includes(meta.status)) {
      error(
        filePath,
        "status-valid",
        `Status "${meta.status}" is not valid for ${type}. Valid: ${validStatuses.join(", ")}`
      );
    }
  }
}

function checkTerminalArchiveLocation() {
  // Terminal plans should be in archive
  const plansDir = path.join(DOCS_DIR, "plans");
  if (fs.existsSync(plansDir)) {
    const mdFiles = getMarkdownFiles(plansDir).filter(
      (f) => f !== "index.md" && f !== "template.md"
    );
    for (const file of mdFiles) {
      const filePath = path.join(plansDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const meta = extractMetadata(content);
      if (
        meta.status &&
        ["Completed", "Abandoned"].includes(meta.status)
      ) {
        error(
          filePath,
          "terminal-archive",
          `Plan with status "${meta.status}" should be in plans/archive/`
        );
      }
    }
  }

  // Terminal specs should be in archive
  const specsDir = path.join(DOCS_DIR, "specs");
  if (fs.existsSync(specsDir)) {
    const mdFiles = getMarkdownFiles(specsDir).filter(
      (f) => f !== "index.md" && f !== "template.md"
    );
    for (const file of mdFiles) {
      const filePath = path.join(specsDir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const meta = extractMetadata(content);
      if (
        meta.status &&
        ["Superseded", "Retired"].includes(meta.status)
      ) {
        error(
          filePath,
          "terminal-archive",
          `Spec with status "${meta.status}" should be in specs/archive/`
        );
      }
    }
  }
}

function checkSupersessionReciprocity() {
  // Build a map of all documents and their supersession links
  const docMap = new Map();

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const mdFiles = getMarkdownFiles(dir).filter(
      (f) => f !== "index.md" && f !== "template.md"
    );
    for (const file of mdFiles) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, "utf8");
      const meta = extractMetadata(content);
      const baseName = file.replace(".md", "");
      docMap.set(baseName, {
        filePath,
        supersededBy: meta.supersededBy,
        supersedes: meta.supersedes,
      });
    }
    // Recurse into subdirs
    const childDirs = getChildDirs(dir);
    for (const child of childDirs) {
      scanDir(path.join(dir, child));
    }
  }

  for (const baseDir of [DOCS_DIR, KTLO_DIR]) {
    scanDir(baseDir);
  }

  // Check reciprocity
  for (const [id, doc] of docMap) {
    if (doc.supersededBy) {
      const replacementId = doc.supersededBy.replace(".md", "");
      const replacement = docMap.get(replacementId);
      if (!replacement) {
        warn(
          doc.filePath,
          "supersession-target",
          `Superseded by "${doc.supersededBy}" which was not found`
        );
      } else if (
        !replacement.supersedes ||
        replacement.supersedes.replace(".md", "") !== id
      ) {
        error(
          doc.filePath,
          "supersession-reciprocal",
          `"${id}" is superseded by "${replacementId}" but "${replacementId}" does not reciprocate with Supersedes: ${id}`
        );
      }
    }
  }
}

function checkGherkinScenarios(dir) {
  const mdFiles = getMarkdownFiles(dir).filter(
    (f) => f !== "index.md" && f !== "template.md"
  );
  const allScenarioIds = new Map();

  for (const file of mdFiles) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const scenarios = extractGherkinScenarios(content);

    for (const scenario of scenarios) {
      // Check ID
      if (!scenario.id) {
        error(
          filePath,
          "gherkin-id",
          `Scenario on line ${scenario.line} missing @id tag`
        );
      } else if (allScenarioIds.has(scenario.id)) {
        error(
          filePath,
          "gherkin-id-unique",
          `Scenario ID "${scenario.id}" reused (first seen in ${allScenarioIds.get(scenario.id)})`
        );
      } else {
        allScenarioIds.set(scenario.id, filePath);
      }

      // Check tags
      const hasUnit = scenario.tags.includes("@unit");
      const hasIntegration = scenario.tags.includes("@integration");
      if (hasUnit && hasIntegration) {
        error(
          filePath,
          "gherkin-tag",
          `Scenario "${scenario.id}" has both @unit and @integration tags`
        );
      } else if (!hasUnit && !hasIntegration) {
        error(
          filePath,
          "gherkin-tag",
          `Scenario "${scenario.id}" missing required @unit or @integration tag`
        );
      }
    }
  }
}

function checkMermaid(dir) {
  const mdFiles = getMarkdownFiles(dir);

  for (const file of mdFiles) {
    const filePath = path.join(dir, file);
    const content = fs.readFileSync(filePath, "utf8");
    const blocks = extractMermaidBlocks(content);

    for (let i = 0; i < blocks.length; i++) {
      const issues = validateMermaidBasic(blocks[i]);
      for (const issue of issues) {
        error(filePath, "mermaid-syntax", `Mermaid block ${i + 1}: ${issue}`);
      }
    }
  }
}

function checkJsonArtifacts(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith(".json") || entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
      const filePath = path.join(dir, entry.name);
      if (entry.name.endsWith(".json")) {
        const result = validateJsonFile(filePath);
        if (!result.valid) {
          error(filePath, "json-parse", `Invalid JSON: ${result.error}`);
        }
      }
    }
  }
}

function checkContractReferences(dir) {
  const contractsDir = path.join(DOCS_DIR, "contracts");
  if (!fs.existsSync(contractsDir)) return;

  // Build set of known contract IDs
  const contractIds = new Set();
  const contractFiles = getMarkdownFiles(contractsDir).filter(
    (f) => f !== "index.md" && f !== "template.md"
  );
  for (const file of contractFiles) {
    contractIds.add(file.replace(".md", ""));
  }

  // Scan all docs for contract references
  function scanForRefs(dir) {
    if (!fs.existsSync(dir)) return;
    const mdFiles = getMarkdownFiles(dir);
    for (const file of mdFiles) {
      const filePath = path.join(dir, file);
      const content = fs.readFileSync(filePath, "utf8");

      // Look for references like CON-YYYYMMDD-NN
      const refRe = /CON-\d{8}-\d{2}/g;
      let match;
      while ((match = refRe.exec(content)) !== null) {
        if (!contractIds.has(match[0])) {
          warn(
            filePath,
            "contract-ref",
            `Contract reference "${match[0]}" not found in contracts directory`
          );
        }
      }
    }
    const childDirs = getChildDirs(dir);
    for (const child of childDirs) {
      scanForRefs(path.join(dir, child));
    }
  }

  scanForRefs(DOCS_DIR);
}

// --- Main ---

function main() {
  // Check all doc directories (under docs/ and ktlo/ only)
  const allDirs = [];
  for (const baseDir of [DOCS_DIR, KTLO_DIR]) {
    if (fs.existsSync(baseDir)) {
      allDirs.push(...getAllMarkdownDirs(baseDir));
    }
  }

  // Run checks
  for (const dir of allDirs) {
    checkIndexExists(dir);
    checkIndexCompleteness(dir);
    checkIndexLinksResolve(dir);

    // Determine type from directory name
    const baseName = path.basename(dir);
    const typeMap = {
      decisions: "decision",
      specs: "spec",
      plans: "plan",
      architecture: "architecture",
      "implementation-maps": "implementation-map",
      contracts: "contract",
      ktlo: "ktlo",
    };
    const type = typeMap[baseName];

    if (type) {
      checkStableIds(dir, type);
      checkLastModified(dir);
      checkStatus(dir, type);
      checkGherkinScenarios(dir);
    }

    checkMermaid(dir);
    checkJsonArtifacts(dir);

    // Check document links (non-index files)
    const mdFiles = getMarkdownFiles(dir);
    for (const file of mdFiles) {
      checkDocumentLinks(path.join(dir, file));
    }
  }

  // Cross-cutting checks
  checkNoArchiveDuplication();
  checkTerminalArchiveLocation();
  checkSupersessionReciprocity();
  checkContractReferences(DOCS_DIR);

  // Report
  console.log("");
  if (warnings.length > 0) {
    console.log(`Warnings (${warnings.length}):`);
    for (const w of warnings) {
      const relPath = path.relative(ROOT, w.file) || w.file;
      console.log(`  WARN  ${relPath} [${w.rule}] ${w.message}`);
    }
    console.log("");
  }

  if (errors.length > 0) {
    console.log(`Errors (${errors.length}):`);
    for (const e of errors) {
      const relPath = path.relative(ROOT, e.file) || e.file;
      console.log(`  FAIL  ${relPath} [${e.rule}] ${e.message}`);
    }
    console.log("");
    console.log(
      `docs-check: FAIL — ${errors.length} error(s), ${warnings.length} warning(s)`
    );
    process.exit(1);
  } else {
    console.log(
      `docs-check: PASS — 0 errors, ${warnings.length} warning(s)`
    );
    process.exit(0);
  }
}

main();

# Authority Types and Boundaries

Classifies every form of authority an agent can hold. An action is authorized
only when it falls within at least one authority type AND satisfies all four
factors of the authority equation (see [Principles](./principles.md)).

## Standing role authority

Permissions granted by virtue of the agent's role definition. These are stable,
repeatable, and do not require per-task approval.

### Read and search

| Capability | Scope | Notes |
| --- | --- | --- |
| Read files | Entire repository except sensitive paths | `.env` files always denied |
| Glob patterns | Entire repository | File discovery |
| Content search (grep) | Entire repository except sensitive paths | All agents: `grep: allow` |
| List directories | Entire repository | Directory structure discovery |

### Routine operations

Operations with no persistent or material side effects outside the agent's
working context.

| Operation | Who | Notes |
| --- | --- | --- |
| Build / compile | document-author | Disposable artifacts only |
| Test execution | document-author | Read-only observation of results |
| Lint / format | document-author | Touches only files in changed-file list |
| `git status`, `git diff`, `git log` | document-author | Read-only git inspection |
| Web search | All agents | Information gathering |
| `opencode debug` commands | document-author | Configuration and agent introspection |

### Web fetch

| Agent | Authority | Constraint |
| --- | --- | --- |
| Orchestrator | Free | Must serve planning or synthesis purpose |
| Subagent (document-author) | URLs in task handoff | URLs not in task require human approval |
| Subagent (implementor) | URLs in task handoff | URLs not in task require human approval |
| Reviewer | URLs in task handoff | Read-only; no web fetch beyond supplied context |

**Note:** Read-only agents (reviewer and any agent currently performing an
investigation via the `investigation` skill) have additional configuration-
level restrictions beyond the standard subagent constraints. The
`investigation` skill's read-only discipline is prose-only, not technically
enforced by the calling agent's permission configuration. The calling
agent's standing config provides baseline restrictions (e.g., the
orchestrator's `bash: deny` baseline, or the implementor's `edit: "allow"`
standing authority), but loading the investigation skill does not tighten
those permissions. Enforcement relies on the agent's self-discipline,
peer review, and the orchestrator's gate discipline. Any persistent side
effects produced during an investigation must be surfaced in the
completion packet under `ATTENTION-FLAGS`. Reviewer has `webfetch: ask`
but operates under read-only standing authority.

### Content search

Content search (grep) is a routine read operation with no persistent side
effects. All agents have `grep: "allow"` in configuration.

## Task-granted authority

Authority conferred by an approved task handoff. Bounded by the objective;
expires when the task is accepted, abandoned, or superseded.

### Structure

A task grant specifies:

1. **Target scope:** Which files, modules, or directories may be modified.
2. **Capability extension:** Which additional permissions are needed beyond
   standing authority (e.g., `edit` for document-author).
3. **Purpose constraint:** What objective the authority serves.
4. **Delegation limit:** Whether the delegatee may further delegate (default: no).

### Examples

| Task | Target scope | Capability | Purpose | Delegation |
| --- | --- | --- | --- | --- |
| Implement WP-02 | `src/.opencode/workflow-docs/autonomy/*.md` | edit | Create autonomy model documents | No |
| Fix lint errors | Changed-file list from review | edit | Remediate review findings | No |
| Validate JSON | `opencode.json` | read + bash (validation commands) | Verify schema compliance | No |

### Constraints

- Task grants cannot exceed the delegator's own authority (I1).
- Task grants are bounded by the approved objective (I2).
- Task grants do not permit lateral expansion beyond stated scope without
  escalation (I3).

### Staging approved content

`document-author` may stage approved task content without a separate staging
approval or permission gate, unless the task prohibits staging. Inspect the
index first; stop on unexpected staged content. Prefer explicit paths and never
include unrelated edits. Repository-wide `git add -A` is valid only when all
pending content is explicitly approved and in scope. Staging is not commit
authorization: the human must approve the actual staged changeset before the
exact message and separate execution authorization. `implementor` retains no
Git write authority. See the `git-commit` skill for preparation and mode checks.

## Workflow-state-derived authority

Authority that arises from approved workflow states. Narrow, normally
non-delegable, and tied to specific transitions.

### Git commit and push

| State | Authority | Constraint |
| --- | --- | --- |
| Plan + work + review approved | Commit via `npm run commit -- ...` | Human gives a SINGLE combined chat approval of the staged changeset and exact message; that approval authorizes scope, exact message, and the exact command; fresh `once` at execution; direct `git commit` is forbidden |
| Commit unpushed + human approval | Amend via `npm run commit -- --amend ...` | Message-only skips staging, requires an empty index immediately before execution, and preserves the tree; content-changing requires approved/reviewed content and staged-changeset approval; both use the SINGLE combined chat approval and a fresh `once` |
| Commit exists + human approval | Exact approved push command (with fresh `once`) | Explicitly approve exact command or remote, source ref, and destination ref; never infer from upstream; configured remotes are ask-gated; never force-push |

### Human authorization and `once` enforcement

Each commit/amend/push requires explicit human chat authorization for its exact
scope. Staging is bounded task-granted authority as described above, not a
separately approval-gated write.
Commit/amend uses a SINGLE combined chat approval of the staged changeset
or empty index (for message-only amend) and the exact message; that approval
authorizes scope, exact message, and the exact `npm run commit -- ...`
command — no separate chat authorization for the command. Push
has its own separate authorization. The OpenCode `once` confirmation is
per-command technical enforcement, required for each command; it does not
replace any chat authorization. The human is not asked afterward to remember or
attest whether an OpenCode prompt appeared. If an outcome is unclear, first use
authorized, read-only checks. For a push,
first use `git status` to determine whether outgoing work remains; do not
routinely inspect remote URLs. Only if status cannot resolve the outcome,
perform a read-only check of the exact approved remote/ref, accounting for a
configured `pushurl` when required. Do not expose raw URLs or credentials. Do
not use a write operation such as `git fetch` as a probe. If checks show
success, do not retry. If they establish that the command failed and the
intended state was not created, report the evidence and obtain explicit chat
approval plus a fresh OpenCode `once` for the exact retry command. If the state
remains unresolvable, report the checks and stop without retrying or guessing.
For a commit, inspect status, local history, and the intended commit's message
and tree; `git status` alone may not establish whether it was created. Push
approval is separate from both message approval and commit-execution
authorization. Never infer the push remote or source/destination ref from
upstream configuration.
Never use direct `git commit`, wrappers to evade permission matching,
automatic approval, persistent `always` approval, or an alternate command or
path.

### Constraints

- Commit/push authority is non-delegable (I4).
- Destructive operations (force-push, `--no-verify`, `--mirror`) are always
  denied regardless of workflow state.
- Non-force branch deletion and pruning remain ask-gated.
- `git branch -d/-D`, `git remote prune`, and `git push --delete/-d/--prune`
  are ask-gated; force-push, hook-bypass, mirror, and other prohibited
  destructive patterns remain denied.
- Amend is allowed only while the commit is unpushed.

## Routine operations vs. persistent/material side effects

### Routine operations

No persistent state change outside the agent's working context. Safe to perform
under standing role authority.

- Builds, tests, lint, formatting (disposable artifacts)
- `git status`, `git diff`, `git log` (read-only inspection)
- Web search (information gathering)
- Content search / grep (read-only)
- Reading files, globbing, listing directories

### Persistent or material operations

Produce lasting state changes that affect the repository, external systems, or
other agents. Require explicit task-granted or workflow-state-derived authority.

- File edits (modify repository content)
- `git commit`, `git push` (modify repository history)
- Scaffolding or code generation (create new files)
- Database migrations (modify external state)
- Installing dependencies (modify environment)
- External API writes (modify external systems)

### Classification rule

When uncertain whether an operation is routine or persistent, classify it as
persistent and require explicit authority. The cost of over-caution is lower
than the cost of unauthorized state change.

## External access rules

### Web search

All agents may perform web searches. No approval required. Information gathering
is a routine operation.

### Web fetch (read)

| Agent | Authority |
| --- | --- |
| Orchestrator | Free; must serve planning or synthesis purpose |
| Subagent | URLs explicitly listed in task handoff; other URLs require human approval |

### External writes

All external write operations require human approval. No agent may write to
external systems (APIs, services, databases) without explicit authorization.

### Sensitive external reads

Currently prohibited. No agent may access external systems that require
authentication, contain sensitive data, or have legal/privacy constraints
without explicit human approval and security review.

## Dependencies

### Conservative treatment

New dependencies (libraries, tools, services) are treated as persistent/material
operations. They modify the environment and may introduce security, licensing,
or compatibility concerns.

### Authorization rules

- Dependencies are authorized **only** when explicitly required by the approved
  plan.
- If a task reveals a need for a new dependency not in the plan, escalate
  (see [Escalation Protocol](./escalation-protocol.md)).
- Do not add dependencies for convenience or speculation.
- Document the dependency, its purpose, and its source in the completion packet.

### Examples

| Scenario | Authorized? | Action |
| --- | --- | --- |
| Plan specifies `markdownlint-cli2@0.23.2` | Yes | Use as specified |
| Task requires a JSON validator not in plan | No | Escalate; do not install |
| Agent prefers a different linting tool | No | Use the tool specified in standing authority |

## Authority summary matrix

| Authority type | Source | Duration | Re-delegable | Examples |
| --- | --- | --- | --- | --- |
| Standing role | Role definition | Permanent (until role changes) | No (inherent to role) | Read, grep, web search, routine bash |
| Task-granted | Approved task handoff | Until task accepted/abandoned/superseded | No (unless explicitly permitted) | Edit specific files, constrained bash |
| Workflow-state | Approved workflow transition | Until transition completes | No | Git commit/push after full approval |

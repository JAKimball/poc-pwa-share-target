# Agent Terminal Rules (Vite+ / pnpm / WSL / VS Code agent harness)

> **⚠ This file is a distributed copy.** The source of truth lives at
> `~/projects/agent-terminal-rules.md`. After editing the central file, run
> the sync script to propagate to all repos:
>
> ```sh
> ~/projects/sync-agent-rules.sh
> ```
>
> If you are editing *this* copy, copy your changes back to the central file
> first, then sync — otherwise the next sync will silently overwrite them.
> (Note: agents in sandboxed terminals cannot see or write the central file
> at `~/projects/` — hand the edit to the user, or apply it in the repo copy
> and ask the user to copy it back before syncing.)

<!-- -->

> Portable rules for AI coding agents working in this environment. Copy into a
> project's `AGENTS.md` or `.github/copilot-instructions.md`. Every rule below
> is empirically verified — most were learned by burning tool calls on the
> failure first. Sources: repo memory (`agent-terminal-node-pnpm-vpr.md`,
> `vscode-env-notes.md`, `copilot-chat-storage-locations.md`) and session
> forensics from the coding-challenges-in-ts repo (2026-08 → 2026-09-15).
>
> **2026-09-15 major revision.** The previously documented "warm-up" pattern
> was **retracted** — see §1. It was an artifact of silent sandbox
> auto-escalation, not a real mechanism. The sandbox model below is verified
> against the harness source (`@vscode/sandbox-runtime`) and the host-side
> session JSONL.

## 1. Command invocation — get it right the first time

> **Prerequisite (user-side, one-time per machine):** the terminal sandbox
> must be allowed to read the toolchain. In VS Code settings:
>
> ```jsonc
> "chat.agent.sandbox.fileSystem.linux": {
>   "denyRead": [],
>   "allowRead": ["~/.vite-plus/"],
>   "allowWrite": [],
>   "denyWrite": []
> }
> ```
>
> Verified working 2026-09-15. Notes: (a) paths are **literal only** — no
> globs (the sandbox silently drops glob patterns on Linux); (b) the sandbox
> resolves **real paths post-symlink**, so scoping to `~/.vite-plus/bin/`
> alone fails — every shim there is a symlink into `current/` → `0.3.1/`,
> and the whole `~/.vite-plus/` entry is the minimal correct scope;
> (c) `github.copilot.chat.additionalReadAccessPaths` grants read access to
> the *agent tools* (read_file/grep) only — it does NOT affect the terminal
> sandbox. (d) **Individual files are valid allowRead entries (verified
> 2026-10-01):** `~/.gitconfig` and `~/.gitconfig.common` were added and
> the git include chain resolves sandboxed — see §6 for the identity and
> signing consequences. (e) **Windows-side paths under `/mnt/c` are valid
> allowRead entries (verified 2026-10-07):**
> `/mnt/c/Users/<user>/AppData/Roaming/Code/User/` was added and sandboxed
> `ls`/`grep` against the Windows-side settings and chatSessions JSONL now
> succeed without escalation — see §2 for the verification caveat.

- **Vite+ wraps the package manager, never the reverse.** Run project scripts
  with `vpr <script>` (e.g. `vpr test`, `vpr lint:knip`). Never `pnpm run` or
  `pnpm exec vp` — pnpm's script environment prepends `node_modules/.bin` to
  PATH, which breaks vp's node resolution
  (`error: Cannot find binary path for command 'node'`).

- **Canonical invocation forms (verified fully sandboxed 2026-09-15, zero
  escalations):**

  ```sh
  # absolute paths — no prefix needed:
  "$HOME/.vite-plus/bin/vpr" <script>
  "$HOME/.vite-plus/bin/vp" <cmd>
  "$HOME/.vite-plus/bin/node" --version          # vp-managed node

  # bare names — one inline PATH prefix:
  PATH="$HOME/.vite-plus/bin:$PATH" CI=true vpr <script>
  PATH="$HOME/.vite-plus/bin:$PATH" CI=true pnpm <cmd>
  ```

  Bare names without the prefix fail with exit 127 (not on the sandbox
  PATH). `CI=true` prevents silent hangs on interactive prompts.

- **⚠ RETRACTED: the "warm-up" pattern (2026-09-10 → 2026-09-15).** Earlier
  revisions of this file documented a `find ... -name vp` prefix that
  "unblocked" vp execution. Session forensics (host-side JSONL, §7) proved
  every such "success" was the harness **auto-escalating to unsandboxed
  execution** after a user approval prompt — the agent never saw the
  difference. There is no warm-up mechanism; the failures were genuine
  sandbox path-masking, and the fix is the settings change above, not a
  command prefix. Lesson recorded in §2: verify which mode actually ran
  before building a theory on "it works now".

- **`pnpm` build-script approvals are declared, not interactive (2026-09-03).**
  `pnpm approve-builds` is interactive and hangs in agent terminals.
  Declare the build in `pnpm-workspace.yaml` instead:
  `allowBuilds: { <dep>: true }`, then re-run `pnpm install`. Also:
  `CI=true pnpm install` fails with `ERR_PNPM_IGNORED_BUILDS` once any
  dep declares a build script that isn't in `allowBuilds` — the fix is
  the yaml edit, never the interactive prompt. **Workspace globs live in
  `pnpm-workspace.yaml` too: pnpm ignores the npm `workspaces` field of
  root package.json once that file exists** — missing `packages:` there
  silently unlinks all packages (`pnpm -r list` shows only the root;
  `--filter` matches nothing). Check `pnpm -r list` after any
  workspace-file edit.

- **"command not found" does not mean absent.** The sandbox PATH simply
  doesn't include `~/.vite-plus/bin`. Use the canonical forms above before
  concluding a tool is missing.

## 2. Sandbox and network — how it actually works

- **The sandbox is bubblewrap (`bwrap`) + `socat`, driven by
  `@vscode/sandbox-runtime`.** Each `run_in_terminal` call is wrapped as
  `env TMPDIR=... /bin/bash -c 'cd <ws> && <cmd>'` inside a
  `sandbox-runtime cli.js` process tree. `cli.js` loads a per-call settings
  JSON; `sandbox-manager.js` builds the policy (and silently strips glob
  patterns on Linux); `linux-sandbox-utils.js` probes `bwrap`/`socat` with
  `whichSync`, spawns socat bridges for filtered network, and wraps the
  command in `bwrap --new-session --die-with-parent` with ro-binds for each
  allowed path plus a seccomp filter (unix-socket blocking). WSL1 is not
  supported (WSL2 required for full enforcement).

- **Sandbox-visible filesystem (verified 2026-09-15):** the workspace,
  `$HOME/.vscode-server/`, `$TMPDIR`, and anything added via
  `chat.agent.sandbox.fileSystem.linux.allowRead`. Everything else under
  `$HOME` (including `~/.vite-plus` without the settings change, and
  `~/.local/share/pnpm`) is **masked** — `ls`/`stat`/`exec` all return
  ENOENT. Do not conclude files are missing from a sandboxed `ls`.
  `/mnt/c` is denyRead/denyWrite by user settings since 2026-10-01;
  per-session approval is the user's preference (Windows-side access via
  `c:` URI schemes may bypass the linux-sandbox setting). Exception
  (verified 2026-10-07): `/mnt/c/Users/<user>/AppData/Roaming/Code/User/`
  is in allowRead — sandboxed reads of Windows-side settings and the
  host-side chatSessions JSONL (§7.1) work without escalation. **Caveat:
  an allowRead change takes effect mid-session without reload, but early
  post-change "successes" may still be escalation pairs from before the
  setting landed — audit the JSONL (§7.1) and credit the setting only on
  a single `=false` record with no `=true` twin.**

- **`/tmp` is READ-ONLY in the sandbox (corrected 2026-09-15).** Earlier
  revisions called `/tmp` the safe scratch space — that observation was
  also escalation-confounded. Verified sandboxed behavior: writes to `/tmp`
  fail with `Read-only file system`. Use the workspace (e.g. a
  `.vscode-scratch/` dir) for scratch files; it is writable and persists.

- **Network-requiring commands must set `requestAllowNetwork` in the same
  call that runs them.** This includes: `pnpm install/remove/up` (registry
  access), `git push`/`git fetch`/`git pull`, `curl`/`wget`. A sandboxed
  network failure looks like a generic fetch error — don't debug it, re-run
  with the flag.

- **Sandboxed writes outside the workspace land in ephemeral storage and
  silently vanish (verified 2026-10-05).** A hook installer writing to
  `~/.copilot/hooks/` reported success, but the files were gone on the
  next unsandboxed read. Any script that deploys to `$HOME` (hook
  installers, config updates, dotfile edits) must run unsandboxed —
  request it with a reason BEFORE running, not after a silent loss.
  Verify deployments with an unsandboxed read.

- **Auto-escalation is invisible to the agent — never build on it.** When a
  sandboxed command's output looks sandbox-blocked, the harness may re-run
  it unsandboxed after a user approval prompt. The agent receives only the
  final result with no indication the mode changed. Session-forensics
  signature of an escalation: the host-side JSONL (§7) contains a *pair* of
  records for the same `commandLine` — first
  `requestUnsandboxedExecution=false`, then `=true`. 16 such pairs were
  found in one session (2026-09-15) and every "warm-up success" traced to
  one. Rules: (1) request unsandboxed explicitly (with a reason) when a
  command genuinely needs it, so the mode is deterministic and visible;

> (2) if a previously-failing command suddenly succeeds, check the JSONL
> for an escalation pair before crediting any code change; (3) treat
> user-reported approval prompts as a signal to re-examine which mode ran.

- **Output-content escalation false positive (verified 2026-10-01,
  session `898c9328`).** The escalation heuristic inspects the command
  **output**, not just the command line or exit code — and it escalates
  even when the command **exited 0**. Every escalated record in the
  audited session carried
  `requestUnsandboxedExecutionReason = "The sandboxed execution output
  indicated the sandbox blocked the command."` while its captured output
  contained the literal strings `ENOENT` and `Auto-escalation` — quoted
  from THIS documentation by `git diff` of AGENTS.md files. Self-
  referential trap: any command whose output *documents* the sandbox
  (diff/grep/cat of the rules docs, bug reports quoting them) matches
  the signature. The harness's own sandbox-advisory boilerplate appended
  to tool results feeds the heuristic more matching text. Workarounds:
  (1) mask signature strings in output
  (`sed 's/ENOENT/E-NOENT/g'`) when inspecting sandbox-related docs;
  (2) write output to a file and read it with the file tool instead of
  the terminal; (3) request unsandboxed explicitly for multi-repo
  command batches so the mode is deterministic and visible. Prefer
  `git -C <path>` over cross-folder `cd` chains (weak evidence, see
  §3).

## 3. Retry discipline — never burn runs on a deterministic failure

- **Distinguish deterministic failures from timing issues before retrying.**
  A command that fails instantly and identically every time (exit 127, exit 2
  with the same message) is not slow to start. Retrying with a longer timeout
  is pointless. Diagnose after the FIRST occurrence.

- **After one `command not found`, switch to the known-good pattern** — do
  not try another PATH variant. Empirical cost of violating this: ~4 wasted
  tool runs in a single session.

- **When a standard tool call fails unexpectedly, stop and explain the
  failure to the user before retrying.** Never launch into extended
  troubleshooting of basic tooling that should just work.

- **After 2–3 failed attempts at the same fix, stop.** Write a short state
  summary (what was tried, current hypothesis) and check in with the user.

- **When an investigation has a finite, enumerable search space, write the
  enumeration script FIRST** and run it once, instead of issuing exploratory
  commands one at a time. Identical results must terminate the search, not
  trigger a re-run.

- **Identical results — not just identical errors — must terminate retries.**
  A command that exits 0 but returns the same "not found"/empty output every
  time is a deterministic result; re-running it unchanged is the same waste
  as retrying a failed command. (Observed cost: ~10 identical `ls` calls in
  one session before this rule was learned.)

- **If the user reports seeing files or state that your terminal does not
  show, suspect a sandbox visibility gap and switch execution mode**
  (request unsandboxed) rather than re-running the same command. The user's
  terminal and the sandbox can see different filesystems.

- **Heredoc `!` escaping trap (verified 2026-10-05).** The harness
  escapes `!` as `\!` (bash history-expansion protection) when
  transmitting commands; inside a quoted heredoc (`<< 'EOF'`) the
  backslash arrives literally → Python
  `SyntaxError: unexpected character after line continuation character`.
  Deterministic — no retry variant fixes it. Fixes: write the script
  with the file-creation tool (never heredoc), avoid `!` in the code
  (`if not (x == y): continue`), or bake
  `sed -i 's/\\!/!/'` into the same command.

- **Near-identical retries are themselves a loop.** Re-issuing a failing
  heredoc under new filenames (`script12.py` → `script13.py`) ~10 times
  is the same failure with cosmetic variation — and it evades
  exact-match loop detection. When the only change between retries is a
  filename, counter, or counter-bearing token, stop and diagnose.

- **Do not write scripts against directory layouts you cannot see.** Get a
  real listing first (unsandboxed run, or pasted from the user) — a guessed
  glob produced a broken sync script that the user had to fix.

- **The unsandboxed rule is PATH-based, not operation-based (JSONL-audited
  2026-09-29, session `93544b5f`).** 662 command records: 71 explicitly
  unsandboxed, 70 escalation pairs, 594 involving `~/.copilot/` paths —
  every pair = one wasted sandboxed attempt + one user approval. Read-only
  `ls`/`head`/`cat` fail in the sandbox just like writes when the path is
  masked. **Rule: request unsandboxed UP FRONT for ANY command touching
  `$HOME` outside {workspace, `~/.vscode-server/`, `$TMPDIR`, allowRead}**
  — and batch such operations into one call instead of sandbox-first
  probing.

- **Escalation-confounded "intermittent" observations are the most
  dangerous retry-loop trigger (session `93544b5f`).** A ~25-call
  identical `cat|diff` loop was entirely escalation pairs — each
  "failure" a sandboxed ENOENT, each rare "success" the unsandboxed
  re-run after user approval. From inside, this looked like intermittent
  visibility; the JSONL showed alternating modes. The occasional success
  masquerades as new information. Root cause: a model that doesn't fully
  understand sandbox behavior assumes non-determinism where results are
  deterministic — the wrong model directly manufactures retries and
  loops. Audit the JSONL (§7.1); never retry-loop.

- **Subagent retry-loop hazard (verified 2026-10-01).** A subagent given
  a non-matching glob re-issued the identical failing search 43+ times
  until harness termination, returning "completed with no output". For
  multi-root subagent tasks: verify the glob matches the actual layout
  before delegating, scope globs per workspace folder correctly, or
  survey in the main session where course correction is possible.

## 4. Long-running and interactive commands

- **Watch-mode scripts (`vpr devtest`) and dev servers must run as background
  tasks**, never as blocking terminal commands. Blocking on them hangs the
  terminal and invites retry loops.

- **Set `CI=true` (or the non-interactive flag) for all package-manager
  tooling.** Commands that may trigger interactive prompts (Corepack version
  downloads, pnpm confirmations) hang silently.

- **Pipe vp progress commands to `cat` in agent terminals (verified
  2026-09-07, chat-hub).** `vp staged` / `vp check` render an animated
  spinner of high-frequency ANSI cursor rewrites. In the agent harness that
  stream is captured by the VS Code Remote extension host, serialized to
  the chat panel's live tool display, and repainted by the Windows Electron
  process — which pegs the Windows host CPU and throttles Hyper-V vCPU
  allocation to the WSL2 VM. Measured on one machine: `vp staged` takes
  35–60s with the spinner, **10–14s with `| cat`** (same milestone output,
  no animation). `CI=true` and `TERM=dumb` do NOT suppress it (spinner still
  renders); only breaking the TTY does. Rule:

  ```sh
  "$HOME/.vite-plus/bin/vp" staged | cat
  "$HOME/.vite-plus/bin/vp" check | cat
  ```

  (`>/dev/null` is equally fast but loses all progress output — `| cat`
  preserves the milestone lines users want to see.)

- **`vp fmt` as a staged pre-commit command is a foot-gun (verified
  2026-10-01).** oxfmt exits 2 when every matched file is excluded by
  ignore rules (markdown-only staged sets with `'**/*.md'` in
  `fmt.ignorePatterns`) — blocking markdown-only commits. `vp check
  --fix` tolerates the empty fmt target set and also picks up
  lint/typecheck on staged files. **Staged config should use `vp check
  --fix`, not `vp fmt`.**

- **Hook authors: the same throttle applies to hook output.** A hook that
  emits progress/spinner output streams into the same chat-panel display
  path on every tool call. Keep hook stdout to a single JSON line (or
  nothing); never emit animated progress from a hook. vp-based commands
  inside hook scripts must be piped to `cat` with the pipeline status
  captured explicitly (see §6 for the POSIX-sh form).

## 5. GitHub CLI

- **`gh` is not authenticated in agent terminals.** If a `gh` command fails
  with an auth prompt or "To get started with GitHub CLI" error, do not retry
  or work around it — ask the user to run the command or paste the output.

## 6. Commits

- **Commit messages follow Conventional Commits** (`feat:`, `fix:`,
  `chore:`, `docs:`, ...). Draft commit messages when asked, but do not
  commit unless the user explicitly asks for it.

- **Signed commits: the GPG passphrase must come from the user (first
  commit only).** gpg-agent caches it afterward — subsequent commits in
  the session go through without prompting. If the first commit fails
  with an identity/passphrase error, hand the commit to the user rather
  than retrying.

- **Identity resolution works sandboxed (updated 2026-10-01).** With
  `~/.gitconfig` and `~/.gitconfig.common` in `allowRead` (§1), the
  include chain resolves and `commit.gpgsign`/`user.signingkey`/identity
  all come from the global config — the old "empty ident → run
  unsandboxed / set repo-local identity" advice is superseded. The
  modern workaround for a repo without global resolution is inline
  `-c user.name=... -c user.email=...`. Global git config is the single
  source of truth: repo-local identity/signing overrides shadow the
  chain and drift on key rotation — remove them.

- **Signing gotcha: relative include paths break silently.**
  `~/.gitconfig` includes `./.gitconfig.common` relatively; when the
  target is masked, the include chain breaks with NO error and commits
  go out unsigned. Rules: after any allowRead change, verify with
  `git config --get commit.gpgsign` sandboxed; after any commit, verify
  `git log -1 --format='%G?'` = G (a silent break shows as N).

- **`git commit` in a repo with a vp-based pre-commit hook: request
  unsandboxed up front (updated 2026-10-01).** The ORIGINAL failure
  (seccomp broke the vp shim → `exec: node: not found`) predates the
  `allowRead: ["~/.vite-plus/"]` setting (2026-09-15) that fixed the
  underlying path masking: sandboxed commits with the full vp pre-commit
  hook now succeed (verified 2026-10-01, chat-hub `9136e77`). However,
  GPG signing still needs the user's passphrase/gpg-agent, so the
  commit-safely procedure remains: request unsandboxed with a reason up
  front — don't burn a sandboxed attempt first. In the user's own
  terminal none of this occurs. Diagnostic signature (historical): hook
  output shows the audit script passing, then
  `./node_modules/.bin/vp: 53: exec: node: not found`.

- **vp hook scripts are re-executed by `/bin/sh -e` regardless of their
  shebang (verified 2026-09-07, chat-hub).** The vite+ dispatcher
  (`.vite-hooks/_/h`) runs each hook script as `"$__vp_shell" -e "$s"`
  with `__vp_shell=/bin/sh` — so a `#!/usr/bin/env bash` shebang in
  `.vite-hooks/pre-commit` is decorative, and bash-only syntax fails:
  `set -o pipefail` → `Illegal option -o pipefail` (dash is the /bin/sh
  on Ubuntu). Write hook scripts in POSIX sh. To get pipefail semantics
  across a pipeline, capture the status explicitly:

  ```sh
  vp staged | cat          # suppresses the spinner (see §4) in hook context
  status=$?
  [ $status -ne 0 ] && exit $status
  ```

- **Multi-session stale-buffer hazard (verified 2026-09-07, chat-hub).**
  When two agent sessions (or a session + the user's editor) hold the
  same file in context, one session can apply a pre-commit-state buffer
  over already-committed changes — rolling the file back on disk (a
  225-line rollback was caught this way; it also broke the build because
  committed exports disappeared). Rules: (1) never `git restore` a
  suspected rollback — `git stash push -m "<description>" <file>`
  preserves it for forensics; (2) after accepting cross-session edits,
  sanity-check `git diff --stat` before staging (a rollback shows as a
  large deletion against recent commits); (3) verify recovery with the
  repo's build + typecheck; (4) close/reload editor tabs in stale
  sessions so they re-read the current file.

- **Format-on-save can modify files mid-session (verified 2026-10-05).**
  An editor format-on-save (e.g. the shfmt-based shell formatter) can
  rewrite a file on disk while an agent session holds it — the agent's
  next edit lands on changed content and the buffer shows a mysterious
  "unsaved" flag the agent did not cause. Rules: (1) commit formatting
  drift promptly so buffer/disk/HEAD stay in sync; (2) when a file
  unexpectedly shows as modified, check whether a formatter touched it
  (`git diff` for pure reformatting) before assuming data loss; (3) know
  which formatter owns each file type (verify by scanning extension
  package.json `documentFormattingProvider` capabilities — for shell
  scripts it is the shfmt wrapper; oxfmt/vp check does not cover .sh).

## 7. Forensics — where session/execution data actually lives

When asked to audit what an agent did (exit codes, sandbox mode, network
access), check locations in this order:

1. **Windows host UI side** (authoritative, complete):
   `/mnt/c/Users/<user>/AppData/Roaming/Code/User/workspaceStorage/<ws-hash>/chatSessions/<session-id>.jsonl`
   — per-command `requestUnsandboxedExecution`, `requestAllowNetwork`,
   `commandLine`, timestamps. **Escalation signature:** a *pair* of records
   with the same `commandLine` — first `requestUnsandboxedExecution=false`,
   then `=true` (see §2). Note (2026-09-15): in the current VS Code build
   the `exitCode`/`sandboxedExecution` fields were not found at their
   documented paths in the JSONL — schema may have drifted; the
   `requestUnsandboxedExecution` pairing remains reliable. Note the WSL
   username can differ from the login name (observed: `jonat` vs
   `jonathan`).
2. **WSL server-side transcript**
   (`~/.vscode-server/data/User/workspaceStorage/<ws-hash>/GitHub.copilot-chat/transcripts/<id>.jsonl`)
   — conversation events only. `tool.execution_complete` carries ONLY
   `{toolCallId, success}`; `success: true` means the tool call returned, NOT
   that the command exited 0. No exit codes, no sandbox flags.
3. **Server-side debug logs** (`GitHub.copilot-chat/debug-logs/<id>/`) —
   telemetry spans only (`session_start`); request/response bodies are not
   written here. Sessions whose debug log never populates are permanently
   invisible to session indexing (`/chronicle`), even after force reindex.
   If the server-side debug log is empty for a session, skip directly to the
   Windows host side — the server-side pipeline may have failed entirely for
   that session, and the UI-side JSONL is the only complete record.
   Exception (verified 2026-10-05): hook-execution spans (`"type":"hook"`
   with `attrs.command/input/output/resultKind`) and `llm_request` events
   (actual model payloads) DO appear in the server-side debug log — use
   them to verify whether a hook fired and whether its deny/warning text
   reached the model. Caveat: naive text-matching of the log gives false
   positives — the agent's own script source echoed in earlier tool
   results contains the same strings (distinguish by `%s` placeholder
   presence).
4. **VS Code user settings live Windows-side in WSL setups (verified
   2026-10-05).**
   `/mnt/c/Users/<user>/AppData/Roaming/Code/User/settings.json` — NOT
   `~/.vscode-server/data/User/settings.json`. The file is JSONC: strip
   comments string-aware (not plain `json.load`) and expect pre-existing
   trailing commas (VS Code tolerates them). `/mnt/c` access may need
   unsandboxed execution per the user's denyRead settings.

### 7.1 Escalation audit procedure

When a command's behavior contradicts documented sandbox rules (sudden
success after failures, results inconsistent with path masking), audit the
host-side JSONL **before theorizing**. The agent's tool result does not
reveal which execution mode actually ran; the JSONL does.

Procedure: extract per-command `requestUnsandboxedExecution` values and
look for **pairs** — the same `commandLine` appearing twice, first
`requestUnsandboxedExecution=false`, then `=true`. A pair means the harness
auto-escalated after a user approval prompt, and the result the agent saw
came from the unsandboxed re-run. A ~25-line Python script suffices:

```python
import json
# path = /mnt/c/Users/<user>/AppData/Roaming/Code/User/workspaceStorage/
#        <ws-hash>/chatSessions/<session-id>.jsonl
def walk(x):
    if isinstance(x, dict):
        if 'commandLine' in x and 'requestUnsandboxedExecution' in x:
            yield x
        else:
            for v in x.values(): yield from walk(v)
    elif isinstance(x, list):
        for v in x: yield from walk(v)
with open(path) as fh:
    for i, line in enumerate(fh, 1):
        try: o = json.loads(line)
        except Exception: continue
        for c in walk(o):
            raw = c.get('commandLine', '')
            if isinstance(raw, dict): raw = raw.get('original', str(raw))
            cl = str(raw).replace('\n', ' ')[:60]
            print(f"{i:4} unsb={c.get('requestUnsandboxedExecution')} | {cl}")
```

Verified 2026-09-15: this procedure explained the retracted "warm-up"
pattern (§1) — 16 escalation pairs, every "success" traced to one. Caveats:
the JSONL schema drifts between VS Code builds (`exitCode`/
`sandboxedExecution` were absent in the current build); the
`requestUnsandboxedExecution` pairing has remained reliable. The WSL
username in the path can differ from the login name (`jonat` vs
`jonathan`).

Audit-ambiguity note (2026-10-01): escalation pairs make it hard to
distinguish agent-requested from harness-initiated unsandboxed runs —
agents now also legitimately request unsandboxed explicitly, producing
single `=true` records. The two cases are distinguishable only by the
absence of a preceding `=false` twin.

Context-integrity note (verified 2026-10-01, session `898c9328`): a
turn's records can go missing from Chat Debug while the host-side JSONL
stays complete and disk work persists; session close/reopen restored
agent-side context. Reinforces: the JSONL is the only authoritative
record; after mid-turn anomalies, verify disk state directly
(`git status`/`git diff` per repo) rather than trusting the transcript.

## 8. Validation loop

- Run `vp install` after pulling remote changes and before getting started.
- Run `vp check` and `vp test` to format, lint, type check and test changes.
- Check for `vite.config.ts` tasks or `package.json` scripts needed for
  validation; run via `vpr <script>`.
- If setup, runtime, or package-manager behavior looks wrong, run
  `vp env doctor` and include its output when asking for help.

## 9. Lint verification and autofix (Vite+/Oxlint projects)

- **Per-file lint checks must use `vp lint <file>` (the built-in), never
  `vpr lint <file>`.** `vpr lint` runs the npm script, which is typically
  `vp lint . --max-warnings 0 ...` — the `.` lints the whole project and the
  trailing path argument is effectively ignored. Verifying a single file's
  cleanliness through `vpr lint <file>` can report 0 findings while the file
  still has errors (observed: 39 real `sort-objects` errors invisible via
  `vpr lint <file>` but shown by `vp lint <file>` and the VS Code Problems
  panel). The Problems panel mirrors `vp lint`, so when editor and CLI
  disagree, check which command the CLI actually ran.

- **`--fix-suggestions` is not idempotent and does not converge in one
  pass.** Re-sorting one object can expose new violations. Loop until the
  error count reaches 0, checking with the same command that reports the
  errors:

  ```sh
  until vp lint <file> 2>&1 | grep -q 'error'; do
    vp lint --fix-suggestions <file> || break
  done
  ```

  Observed: 39 errors needed 2+ passes; a single pass left 16. Review the
  resulting diff — suggestion fixes can move comment-attached lines.

- **`vp lint --fix` only applies safe fixes; `--fix-suggestions` applies
  suggestion-level fixes** (e.g. `perfectionist/sort-objects`), which oxlint
  documents as "may change program behavior". Sort rules are safe for plain
  object literals but always eyeball the diff.

## 10. Meta-rules — editing and propagating THIS file

This file is a distributed copy managed by `~/projects/sync-agent-rules.sh`
(itself Stow-installed from the wsl-ubuntu-config-private repo). The
workflows:

- **To edit the rules:** run
  `~/projects/sync-agent-rules.sh --begin <repo-path>` from the repo you
  want to edit in. It verifies no lock is held, that **the rules file
  itself** is uncommitted-clean, and that the repo copy matches central
  (footer-stripped) — refusing with backups on divergence. Other uncommitted
  work in the repo is allowed: only the rules file must be clean, since
  `--finish` touches only that file. Then run
  `~/projects/sync-agent-rules.sh --finish` to promote the edit to central,
  re-stamp, and propagate to all other repos. It prints (does not run) the
  commit command for the editing repo.
- **To promote edits made outside the workflow** (committed directly in a
  repo without `--begin`/`--finish`, or a repo that missed syncs): run
  `~/projects/sync-agent-rules.sh --promote <repo-path>`. It requires the
  rules file to be committed, backs up central before overwriting, and
  checks the copy's footer history for a sync from central's current
  content — warning and asking for confirmation when ancestry is uncertain
  (the copy may silently drop central-only changes). After promotion it
  syncs the new central out to all other repos.
- **To pull without editing:** run `~/projects/sync-agent-rules.sh` (plain
  sync) or `--check` for drift-only. `--adopt` offers to add the file to
  repos that have agent instructions but no copy yet (stamping a proper
  `synced=` footer, not cloning central's).
- **Use `--check` to determine current status before acting.** It reports
  drift only (no writes), listing repos whose copy differs from central
  with the rules file's git state — e.g.
  `DRIFT: coding-challenges-in-ts  main [modified-uncommitted]` means that
  repo's copy has un-promoted edits AND uncommitted changes (commit first;
  `--begin`/`--promote` refuse on uncommitted rules files). It also flags
  `LOCAL:` lines — up-to-date-but-uncommitted copies whose content matches
  central but carry uncommitted git state (invisible to drift detection;
  a plain sync would silently overwrite them). Drifted repos get an
  interactive viewer: pick a number (or `a` for all) to see the
  footer-stripped diff of that copy vs central, with meaningful
  `central`/`<repo>` headers. Run `--check` first to decide whether you
  need `--begin`/`--finish` (promoting an edit), `--promote` (committed
  divergent copy), or a plain sync (pulling central out).
- **Footers are script-managed.** Every copy ends in a footer BLOCK —
  trailing stamp lines, newest event first, capped at 5:
  `last-edit=<repo> at=<ts>` on central, `synced=<ts> src=<hash8>` on
  distributed copies, with previous stamps kept as history beneath. Never
  hand-edit it; drift comparison strips the whole block, so mixed/old
  single-line footers never cause false drift, and every write converts
  them to the block form. The `src=` hashes in the history are how
  `--promote` detects ancestry.
- **Locks:** a central directory lock (`~/projects/.agent-terminal-rules.lock`)
  prevents concurrent edits. A stale lock (>24h) can be stolen with
  `--force`. Never delete the lock manually while an edit session is live.
- **Sandbox note for editors:** the central file lives at `~/projects/`,
  outside the sandbox-visible filesystem — sync-script invocations and any
  direct central-file access need unsandboxed execution (request it
  explicitly with a reason). Editing the repo copy can be done with the
  VS Code edit tool (it sees the real filesystem).

<!-- agent-terminal-rules: synced=2026-10-07T23:18:54Z src=f5b21c75 -->
<!-- agent-terminal-rules: synced=2026-10-07T11:16:17Z src=a44b5d08 -->
<!-- agent-terminal-rules: synced=2026-10-07T09:38:07Z src=2dafcfeb -->
<!-- agent-terminal-rules: synced=2026-10-06T04:30:24Z src=c299d7b0 -->
<!-- agent-terminal-rules: synced=2026-09-17T08:20:59Z src=df43015d -->

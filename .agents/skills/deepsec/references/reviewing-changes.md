# Reviewing changes (PR mode)

Use PR mode to investigate only changed files and fail CI when new findings appear.

`deepsec process` has a direct-invocation mode for reviewing a specific
set of files — typically the files changed in a pull request. This is
the right tool when you want a fast, scoped read of changed code in CI,
rather than a whole-repo audit.

```bash
deepsec process --diff origin/main
```

## How it differs from a full scan

The standard flow is `scan` → `process` over the entire repo:

| Step      | What it looks at        | What it produces                       |
|-----------|-------------------------|----------------------------------------|
| `scan`    | The full source tree    | Regex candidates per file              |
| `process` | All pending candidates  | AI findings on every flagged file      |

Direct mode collapses both steps into one invocation, scoped to a file list:

| Step              | What it looks at                | What it produces                                           |
|-------------------|---------------------------------|------------------------------------------------------------|
| Resolve files     | `--diff` / `--files` / stdin    | A POSIX-relative file list under `rootPath`                |
| Scoped scan       | Only the listed files           | Candidates as **signals** for the prompt (best-effort)     |
| Always-process    | The same listed files           | AI findings — even on files no matcher hit                 |

The scoped scan still runs because regex hits are useful prompt anchors
for the agent. Files with no hits still get a record and still get
investigated as a holistic review — no signals, no scanner anchoring,
just the agent reading the file.

## Flags

All five sources are mutually exclusive:

```text
--diff <ref|range>     Investigate `git diff --name-only <ref>` (e.g. origin/main, HEAD~1..HEAD)
--diff-staged          Investigate the index vs HEAD
--diff-working         Investigate uncommitted + untracked files
--files <csv>          Investigate this comma-separated path list
--files-from <path>    Read newline-delimited paths from <path> (or "-" for stdin)
```

Other knobs:

```text
--no-ignore            Bypass the default ignore filter (test files, dist/, node_modules/, …)
--comment-out <path>   Write a PR-comment-shaped markdown summary to <path> (only when findings exist)
--project-id <id>      Override the project id (auto-derived from rootPath basename otherwise)
--root <path>          Override the project root (defaults to cwd or deepsec.config.ts)
```

The usual `--agent`, `--model`, `--concurrency`, `--batch-size`,
`--max-turns`, `--thinking-level` flags work the same as in standard mode.

## Auto-created projects

You don't need to run `deepsec init` first. When invoked with one of the
direct-mode flags, `process` will:

1. Use `--project-id` if you pass one. If it's already declared in
   `deepsec.config.ts`, the declared root is used; otherwise `--root`
   (or the current working directory) is used.
2. Otherwise, derive the id from the basename of the resolved root.
3. Write `data/<id>/project.json` if it doesn't already exist.

Auto-creation is one-line and non-destructive — it never modifies your
`deepsec.config.ts`. It just ensures `data/<id>/` exists so file
records, run metadata, and the optional PR-comment markdown have
somewhere to land.

## Exit codes

| Code | Meaning                                          |
|------|--------------------------------------------------|
| `0`  | No findings produced in this run                 |
| `1`  | At least one finding was produced                |
| `≠1` | Runtime error (bad input, missing credentials, …)|

This makes direct mode a drop-in CI gate: the job fails when the agent
finds something. **Net-new findings only** count toward the exit code —
re-running on a file with existing findings doesn't fail the build
unless something new is surfaced. Pre-existing findings (from a prior
full scan, or earlier PR review runs) on touched files are intentionally
excluded so the gate matches the change-scoped review model.

## PR comments

`--comment-out <path>` writes a markdown body summarizing the **net-new
findings** from this run — same scope as the exit-code gate.

# Polskie Ślady Taszkent — agent harness

This file is the entry point Claude Code reads at session start. The rules below are not
suggestions — some of them (git workflow, dependencies, non-regression, privacy) are hard
constraints with no exceptions.

The harness lives in two places:

- **`harness/`** — rules every task needs, imported below and loaded in every session.
- **`.claude/rules/`** — rules for one area of the code (a subsystem, a screen, styling,
  i18n, the repo root, dependencies, test helpers, the harness itself). Each file's `paths:`
  frontmatter lists the files it covers; Claude Code loads it when one of them is opened
  (Read/Edit/Write). Read the matching file yourself before working in an area by other
  means (a grep, a `sed -n` range) — the area's rules are binding either way.

@harness/architecture.md
@harness/code-style.md
@harness/performance.md
@harness/testing.md
@harness/git-workflow.md
@harness/agent-session.md
@.github/pull_request_template.md

## The rules that override everything else

1. **Work on `features` or on a contributor branch made from it. Never `master`.** An admin
   (the lead developer) works on `features` directly, one step at a time. Anyone else works
   on their own `feature/<name>` / `fix/<name>` branch made from `features` and opens a PR
   into `features` — they can't push to `features`. Never start work on `master`; if the
   current branch is `master`, or is `features` for someone who isn't an admin, stop and say
   so, giving the human the command to switch or to create their branch — the agent itself
   never creates or switches branches, and never pushes. See `harness/git-workflow.md`.
2. **No patches, no commits: write changes straight into the working tree.** The human
   reviews with `git diff` and commits themselves. Never run `git commit`, never `git push`,
   never run a release/publish script (`.claude/settings.json` denies these too). New
   features, tests, extensions and refactoring — start them without asking; **a bug fix —
   describe it and ask first**. Either way, **after each step stop with a short report and
   wait** before starting the next one. Draft a commit message only when asked. See
   `harness/git-workflow.md`.
3. **Never break what already works.** Before changing shared code (a service, a state
   module, a builder, a widely-used component), find out what currently depends on it and
   check what the existing tests cover. After the change, the full existing suite must still
   pass. A new feature that works but silently breaks something else is not done — see
   `harness/testing.md`.
4. **No new dependency without asking — not even a small one.** Try to write it yourself
   first; if you genuinely can't, explain what it's for and why, and ask. **Yes** → install
   it and continue. **No** → continue without it, and at the end of the step list what you'd
   still recommend installing and why. See `.claude/rules/dependencies.md`.
5. **Read `package.json` once at the start of the session.** Re-check it (or the specific
   package's own docs/changelog) whenever a feature touches a library that could have moved
   since — especially Svelte, which ships changes often. If a feature turns out to need a
   library that isn't installed, stop and ask per rule 4 before continuing that part of the
   feature; keep working on whatever doesn't depend on it in the meantime.
6. **Telemetry and training data are two different switches — don't confuse them, and don't
   try to "fix" training opt-out from inside the project.** Telemetry is off via
   `.claude/settings.json`; training use is a Claude account setting nothing in the repo can
   change. Details for humans: `CONTRIBUTING.md` → "Claude Code privacy settings".
7. **This project's architecture will keep growing — keep the harness growing with it.** A
   new subsystem gets its own path-scoped `.claude/rules/<name>-subsystem.md`; a harness file
   past ~400 lines gets split. See `.claude/rules/maintaining-this-harness.md`. An
   out-of-date harness file is a bug in the change that altered the code it describes, not a
   separate follow-up task.
8. **Mind the session's context budget.** Past ~80% context usage: warn the human, and don't
   start a new task — warn and stop instead, unless told to go ahead anyway. Applies to
   every kind of task. Keep tool output small (read files by range, filter command output with
   `grep`/`tail`) — it all stays in the context. See `harness/agent-session.md`.

## Quick orientation

- Stack: Svelte 5 (runes), Vite, Konsta UI (preferred) + Tailwind 4 (for what Konsta
  doesn't cover — see `.claude/rules/styling.md`), MapLibre GL JS + PMTiles, Capacitor, i18next.
- `src/` is where almost all work happens, but the repo root matters too (native projects,
  data scripts, store tooling, release script) — see `.claude/rules/repository-layout.md`.
- `scripts/` and `appstore/` are hands-off unless explicitly asked — don't edit, "clean up"
  or run anything there (`.claude/rules/repository-layout.md`).
- Merge gate for PRs (and for any step reported as done): the checklist in
  `.github/pull_request_template.md`, imported below; enforced in part by
  `.github/workflows/ci.yml`. See `harness/git-workflow.md` → "Merge gate".
- Legacy zones: a handful of older files (`MapNavigationGPS`, `LangSwitcher`, `errorToast`) don't follow the harness — don't copy patterns from them; the list and the
  reference implementations to copy from instead are in `harness/code-style.md` →
  "Leave old code alone".
- Tests: `npm test` (Vitest). Every area with logic is covered; known bugs are pinned with
  `it.fails` and logged in `BUGS.md` — see `harness/testing.md`.
- **Offline app, single local user, no backend.** A lot of standard production-app
  machinery simply doesn't apply here — see the "Operating context" section of
  `harness/architecture.md` before reaching for a pattern built for a multi-user,
  server-backed app.
- Hybrid app (Android + iOS via Capacitor), **Android first**: the lead developer builds
  and tests on Android; iOS releases are handled by a separate contributor. Assume phones can
  be slow and storage can be tight. `harness/performance.md` is not optional reading.
- Four languages: `ru` (default), `en`, `pl`, `uz`. Every user-visible string ships in all
  four in the same change — see `.claude/rules/i18n.md`.
- The harness describes the code as it is now, not how it got there — history lives in git.

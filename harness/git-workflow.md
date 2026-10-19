# Git workflow

## Which branch

- **Work on `features`, or on a contributor branch made from it — never on `master`.**
  - **An admin** (the lead developer) works on `features` itself and pushes it directly.
  - **Anyone else** works on their own `feature/<short-name>` / `fix/<short-name>` branch
    made from `features` and opens a PR into `features` (the ruleset blocks their direct
    pushes). With write access the branch lives in this repository; without it, in their
    fork. `CONTRIBUTING.md` → "Opening a pull request" has both, command by command.

  Check the current branch before starting. On `master` — stop. On `features` while the
  human says they aren't an admin (or can't push / need a PR) — stop and give them the
  command to create their branch (`git checkout -b feature/<name> origin/features`, or
  `upstream/features` from a fork). When unsure who the human is, ask once.
- **`master`** is the release branch: it only changes by merging a PR from `features`
  (merge commit, not squash/rebase) that passed CI. Releases are cut by the lead developer
  with `scripts/release.mjs` — how, in `CONTRIBUTING.md` → "Releases". The GitHub-side
  setup is in `CONTRIBUTING.md` → "Repository setup"; if the branch model changes, update
  that section, this one and the CI triggers in `.github/workflows/ci.yml` together.

## Changes go straight into the working tree

- **No patch files, no commits.** The agent writes code, tests and harness changes directly
  into the working tree; the human reviews with `git diff` / `git status` and commits.
  Every change stays reversible by the human (`git restore <file>`, `git clean`).
- Keep each step coherent the way a commit would be — one logical change, buildable and
  passing tests — the human may commit after any step.
- Don't touch the human's own uncommitted changes beyond what the task needs, and never
  revert anything with `git checkout .`/`git stash`/`git clean`/`git reset --hard` — they
  can take the human's work with them. To undo the agent's own experiment (a mutation check,
  a probe), save a copy first and restore that file from it.

## When to ask first, and when to stop

- **Start without asking:** new functionality, tests, extending existing functionality,
  refactoring.
- **Ask before changing code: fixing a bug.** Describe the bug (where, what breaks, a
  minimal fix) and wait for the go-ahead; until then pin it with an `it.fails` test
  (`harness/testing.md` → "Bug log") and leave the code as is. A bug in code the agent
  itself wrote in the current, uncommitted step is not this case — just fix it.
- **Ask before installing a dependency:** `.claude/rules/dependencies.md`.
- **After every step, stop with a short report and wait** for the human before starting the
  next step — also when the human approved several steps at once ("do 1–3, then 4": report
  after each, then go on). This settles the user-level "stop after each step" rule against
  "start without asking" above: no confirmation is needed to *start* a step, a report is
  always due at its *end*. The report: what changed (files), test and build results, what
  the human must still run or hand over (`npx cap sync`, the iOS side), which merge-gate
  items couldn't be checked.

## What the agent never does

`.claude/settings.json` denies most of these at the permission level — every `git` command
that can drop the human's uncommitted work or touch branches (`reset --hard`, `clean`,
`stash`, `restore`, `rm`, `checkout`, `switch`, `branch`, `worktree`, `merge`, `rebase`,
`tag`), plain and as `git -C <dir> …`; read the current branch with `git status` instead. The
rule holds for any form the deny list doesn't catch.

- `git commit`, `git push` (any branch, any remote), force-push or any history rewrite.
- Create, switch to, merge or delete a branch, or touch `master` at all — it gives the human
  the command instead.
- Run a release/publish/deploy script or anything that tags and ships a version
  (`npm run release`, `appstore/*.py`).

## Merge gate

The gate is the checklist in `.github/pull_request_template.md` (imported into `CLAUDE.md`);
`CONTRIBUTING.md` → "The merge gate" explains each item. `.github/workflows/ci.yml` runs the
automated part (`npm ci`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`)
on every push/PR to `features` and `master`. The agent doesn't open PRs, but holds every
step it reports as done to the same gate and says plainly which items it couldn't check
(e.g. behavior on a real device). When the gate changes, update the template and
`CONTRIBUTING.md` together.

## Suggested commit messages

**Only when the human asks** — the human decides when a piece of work is commit-worthy (it
may span several steps). When asked, the message covers everything since the last commit
unless told otherwise:

- A short imperative subject line, a blank line, then a handful of bullet points on *what*
  changed and, where it's not obvious, *why*. In English.
- No Claude Code auto-attribution footer ("🤖 Generated with Claude Code",
  "Co-Authored-By: Claude") — the human authors the commit.
- The subject carries the prefix `scripts/release.mjs` builds `CHANGELOG.md` from: `UPD:`
  (Updates), `FIX:` (Fixes), `UPD:FIX:` (both), dated as `UPD:2026-10-16:: ...`; anything
  without a prefix lands under "Other Changes".

```
UPD: Add cover-photo switching to the marker editor

- photoSession.setCover(path) reorders the photo list in place
- tapping a non-cover thumbnail in the editor calls it
- no file I/O: only the in-memory order changes until save
```

## Release / tag messages

Prepared when asked, **never executed**. In English. Longer than a commit message, under
headings (what's new, fixes, anything migration-relevant), for someone who didn't watch the
feature get built. Keep user-facing changes (a store listing has a hard length limit and an
audience that doesn't care about an internal refactor) apart from internal ones; a GitHub
release can carry both, clearly separated.

# Git workflow

## Which branch, changes straight into the working tree

- **Work on `features`, or on a contributor branch made from it — never on `master`.**
  Which one depends on who the human is:
  - **An admin** (the lead developer) works on `features` itself and pushes it directly.
  - **Anyone else** — a maintainer without admin rights, an outside contributor — works on
    their own `feature/<short-name>` / `fix/<short-name>` branch made from `features`, and
    opens a PR into `features` (the ruleset blocks their direct pushes to `features`). With
    write access the branch lives in this repository; without it, in their fork.
    `CONTRIBUTING.md` → "Opening a pull request" has both, command by command.

  Check the current branch before starting. On `master` — stop. On `features` while the
  human says they aren't an admin (or that they can't push / need a PR) — stop and give them
  the command to create their branch (`git checkout -b feature/<name> origin/features`, or
  `upstream/features` from a fork). When unsure who the human is, ask once. The agent never
  creates or switches branches, or pushes, itself — it says which command to run. The old
  `features/<name>` sub-branch scheme is retired; contributor branches are `feature/`/`fix/`.
- **No patch files.** The agent writes code, tests and harness changes directly into the
  working tree. The human reviews with `git diff` / `git status` and commits when they
  decide to. Nothing is lost by this: the agent never commits, so every change stays
  reversible by the human (`git restore <file>`, `git clean` for new files).
- Keep each step coherent the way a commit would be — one logical change, buildable and
  passing tests — even though it isn't committed yet; the human may commit after any step.
- Don't touch the human's own uncommitted changes (e.g. a `package.json` they just edited)
  beyond what the task needs, and never revert anything with `git checkout .`/`git stash`/
  `git clean`/`git reset --hard` — they can take the human's work with them. To undo the
  agent's own experiment (a mutation check, a probe), save a copy first and restore that
  file from it.

## Branches, pull requests, who pushes where

- **`master`** — release branch. Nobody pushes to it directly, admins included; it only
  changes by merging a pull request from `features` (merge commit, not squash/rebase), and
  that PR must pass CI (`test-and-build`). Releases are cut manually by the lead developer
  with `scripts/release.mjs`: the version bump is committed on `features`, reaches `master`
  through the PR, and the tag is put on `master` after the merge (see
  `harness/repository-layout.md`). The script runs on `features` only — `master` is never
  checked out to release from. After tagging, `features` is fast-forwarded to `master`, so
  the two never diverge.
- **`features`** — integration branch. **Admins push to it directly** (this is the lead
  developer's day-to-day flow, and the agent's working branch when working with an admin).
  **Everyone else** creates their own branch from `features` (`feature/<short-name>`,
  `fix/<short-name>`), pushes it, and opens a PR **into `features`** — which must pass CI. When an admin opens a PR
  (instead of pushing directly), it must pass CI too.
- The agent never pushes or opens PRs; it works on the branch the human is on (see above)
  and, when asked, explains the PR steps from `CONTRIBUTING.md` → "Opening a pull request".
- The GitHub-side setup that enforces this is in `CONTRIBUTING.md` → "Repository setup";
  if the branch model changes, update that section, this one, and the CI triggers in
  `.github/workflows/ci.yml` together.

## When to ask first vs. just do it

- **Just do it, no confirmation needed:** new functionality, tests, extending existing
  functionality, refactoring. Report what was done afterwards.
- **Ask before changing code: fixing a bug.** Describe the bug (where, what breaks, a
  minimal fix) and wait for the go-ahead. Until then, pin it with an `it.fails` test (see
  `harness/testing.md`) and leave the code as is. A bug in code the agent itself wrote in the
  current, uncommitted step is not this case — just fix it.
- **Ask before installing a dependency:** see `harness/dependencies.md`.

## What the agent does and does not do

- **Does:** work on the `features` branch, write the code, write and run the tests, build
  the project, keep the harness up to date, and, where relevant, note what else the human
  must run (`npx cap sync`, a native build, etc.). A commit message only on request (see
  below).
- **Does not, ever:**
  - `git commit` — the human commits.
  - `git push` (to any branch, any remote).
  - Run a release/publish/deploy script, or anything that tags and ships a version.
  - Create, switch to or merge a branch, or touch `master` at all — it gives the human the
    command instead (see "Which branch" above).
  - Force-push or rewrite history.

## Merge gate (pull requests, and every step the agent reports as done)

`CONTRIBUTING.md` at the repo root is the human-facing version of these rules; the
checklist lives in `.github/pull_request_template.md`, and `.github/workflows/ci.yml` runs the
automated part (`npm ci`, `npm test`, `npm run build`) on every push/PR to `features` and
`master`. A pull request is merged only if:

1. the **whole** suite passes, not just the new tests;
2. the build is clean, with no new warnings;
3. new logic is tested, and a bug fix has a test that fails without the fix;
4. architecture rules are followed (`architecture.md`, `state-management.md`, `styling.md`);
5. code style is followed (`code-style.md`, `svelte-rules.md`);
6. every new UI string exists in all four locales;
7. no dependency was added without approval;
8. nothing contradicts `PRIVACY.md`;
9. the harness is updated if architecture, directories, scripts or configs changed.

The agent doesn't open PRs, but holds every step it reports as done to the same gate — and
says plainly which items it couldn't check (e.g. behavior on a real device). When one of
these rules changes, update `CONTRIBUTING.md`, the PR template and this list together.

## Suggested commit messages

**Only when the human asks.** Don't append a commit message to every step by default —
the human decides when a piece of work is commit-worthy (it may span several steps) and
asks for the message then. When asked, it covers everything since the last commit unless
told otherwise. The message itself:

- Multi-line, but kept reasonable — a short imperative subject line, a blank line, then a
  handful of bullet points on *what* changed and, where it's not obvious, *why*.
- Written in English.
- Don't add Claude Code's own auto-attribution footer ("🤖 Generated with Claude Code",
  "Co-Authored-By: Claude") to a suggested message for this project — the human is
  authoring the commit themselves after reviewing the changes.

The human's own commit subjects carry a type prefix that `scripts/release.mjs` uses to
build `CHANGELOG.md`: `UPD:` (Updates), `FIX:` (Fixes), `UPD:FIX:` (both), optionally
dated as `UPD:2026-10-16:: ...`; anything without a prefix lands under "Other Changes".
Suggest a subject with the right prefix so the changelog sorts it correctly.

Example shape:

```
UPD: Add cover-photo switching to the marker editor

- photoSession.setCover(path) reorders the photo list in place
- tapping a non-cover thumbnail in the editor calls it
- no file I/O: only the in-memory order changes until save
```

## Release / tag messages

Prepared by the agent when asked, **never executed** (no release script, no tag, no push —
see above):

- Written in English, regardless of the language the session was conducted in.
- Longer and more detailed than a commit message: organized under headings (what's new,
  fixes, anything migration-relevant), written for someone who didn't watch the feature get
  built.
- Distinguish user-facing changes (what goes in a store listing or a GitHub release) from
  internal/technical ones — a store release note has a hard length limit and an audience
  that doesn't care about an internal refactor; a GitHub release can carry both, clearly
  separated.

## Tying this to dependencies

A new package lands in `package.json`/the lockfile only after the explicit approval flow in
`harness/dependencies.md` — never as a side effect of an otherwise-unrelated change.

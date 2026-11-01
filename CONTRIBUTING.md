# Contributing

Thanks for wanting to help. This app is small, offline-first and runs on weak phones, so
the bar for merging is about not breaking what already works.

The detailed rules live in [`harness/`](harness/) and [`.claude/rules/`](.claude/rules/) — they're written for the project's AI
agent, but they are the project's real engineering rules and apply to everyone. This file is
the short version plus the merge gate.

## Workflow

- **Android first.** The app is developed and tested on Android first; iOS builds and App
  Store releases are handled by the iOS maintainer. If your change touches native config
  (plugins, permissions, `android/`, `ios/`), say in the PR what the iOS side needs.
- Create your own branch from `features` (`feature/<short-name>` or `fix/<short-name>`),
  push it, and open the pull request **into `features`**. Direct pushes to `features` are
  for admins only. Step by step — see [Opening a pull request](#opening-a-pull-request).
- `master` is the release branch: nobody pushes to it, it only receives PRs from
  `features`, and releases are cut from it manually by the maintainer.
- Keep a pull request to one logical change. A big feature is a series of smaller PRs.
- Commit subjects use the prefix the release script builds `CHANGELOG.md` from:
  `UPD:` (new/changed), `FIX:` (bug fix), `UPD:FIX:` (both), optionally dated —
  `UPD:2026-10-16:: Add cover-photo switching`. See
  [`harness/git-workflow.md`](harness/git-workflow.md).
- Never bump versions, tag, or run `npm run release` / `appstore/` scripts in a PR —
  releases are done by the maintainer.

## Opening a pull request

Which way depends on whether you can push to this repository.

**With write access** (a maintainer — e.g. the iOS maintainer):

```bash
git fetch origin
git checkout -b feature/<short-name> origin/features   # or fix/<short-name>
# ...work, commit with the UPD:/FIX: prefix...
git push -u origin feature/<short-name>
```

Then open a PR on GitHub: **base `features` ← compare `feature/<short-name>`**.

**Without write access** (anyone else) — through a fork:

```bash
# once: fork the repository on GitHub, then
git clone https://github.com/<you>/polskie-slady-taszkent.git
cd polskie-slady-taszkent
git remote add upstream https://github.com/Ko2doo/polskie-slady-taszkent.git

# for each change
git fetch upstream
git checkout -b feature/<short-name> upstream/features
# ...work, commit...
git push -u origin feature/<short-name>
```

Then open a PR from your fork: **base repository `Ko2doo/polskie-slady-taszkent`, base
`features` ← your fork, `feature/<short-name>`**. GitHub may hold CI on a first-time
contributor's PR until a maintainer approves the run — that's expected.

Either way:

- Start from the current `features`, never from `master`, and never target `master` — it
  only receives the release PR.
- If `features` moved on while you worked, bring it in before asking for the merge:
  `git fetch upstream` (or `origin`), then `git merge upstream/features` into your branch.
- CI (`test-and-build`) must be green; fix it on your branch and push — the PR updates.
- Working with an AI agent (Claude Code reads [`CLAUDE.md`](CLAUDE.md), `harness/` and `.claude/rules/`;
  other agents get pointed there by [`AGENTS.md`](AGENTS.md)): the agent writes code on your
  branch and tells you the git commands; creating the branch, committing, pushing and
  opening the PR are yours.

## The merge gate

A pull request is merged **only if all of the following hold**. CI checks the first two
automatically; the rest is on the author and the reviewer — the PR template has the
checklist.

1. **The whole test suite passes** — `npm test`. Not just the new tests: everything that
   was green before must still be green.
2. **The project builds cleanly** — `npm run build`, with no new warnings. The build first
   runs `npm run lint` (no errors) and `npm run format:check` (`npm run format` fixes it),
   so unformatted or lint-failing code doesn't build anywhere — locally or in CI.
3. **New code is tested.** New logic has tests for the normal path, the edge cases that
   matter and the failure path; a bug fix has a test that fails without the fix. See
   [`harness/testing.md`](harness/testing.md).
4. **Architecture rules are followed** — files are where
   [`harness/architecture.md`](harness/architecture.md) says they go, state follows
   [`.claude/rules/state-management.md`](.claude/rules/state-management.md), UI uses Konsta first and
   Tailwind second ([`.claude/rules/styling.md`](.claude/rules/styling.md)).
5. **Code style is followed** — [`harness/code-style.md`](harness/code-style.md) and
   [`.claude/rules/svelte-rules.md`](.claude/rules/svelte-rules.md): Svelte 5 runes, JSDoc on exported
   functions, the project logger instead of `console.*`, no dead code, no magic numbers
   (named constants instead), Prettier formatting. One function does one job; extend an
   existing one (an optional parameter that keeps the old behavior) rather than copy it.
   Code reads easily for a human; mixed concerns are split into modules — except builder
   classes (`mapPointsBuilder`, `customPointsBuilder`, ...), from which only logic shared
   between builders is extracted.
6. **All four languages are complete.** Every new user-visible string exists in `ru`, `en`,
   `pl` and `uz` with the same placeholders ([`.claude/rules/i18n.md`](.claude/rules/i18n.md)).
7. **No unapproved dependencies.** A new package in `package.json` needs the maintainer's
   explicit OK first ([`.claude/rules/dependencies.md`](.claude/rules/dependencies.md)).
8. **Nothing changes what [`PRIVACY.md`](PRIVACY.md) promises.** The app collects no data
   and works offline; a change that sends anything off the device doesn't get merged
   without a deliberate decision and an updated privacy policy.
9. **The harness is up to date.** If the change alters architecture, adds a directory,
   subsystem, script or config file, the matching harness file is updated in the
   same PR ([`.claude/rules/maintaining-this-harness.md`](.claude/rules/maintaining-this-harness.md)).
10. **The developer docs are up to date.** A change to what a module does or how it's used
    updates its page in [`docs/ru`](docs/ru/00-README.md) and [`docs/en`](docs/en/00-README.md) in
    the same PR — both versions, same examples (`src/docsParity.test.js` checks the structure).

## Repository setup (for admins)

What enforces the rules above on GitHub — **Settings → Rules → Rulesets → New branch
ruleset**. Push once first and let the CI workflow run, otherwise the `test-and-build`
check won't be offered in the list.

**Ruleset `master`** — target: `master`, enforcement: Active, **bypass list: empty**.
- Restrict deletions; Block force pushes.
- Require a pull request before merging (required approvals: 0 — a single maintainer
  can't approve their own PR); allowed merge methods: **Merge** only. The release script
  fast-forwards `features` to `master` after tagging, which only works with merge commits.
- Require status checks to pass: `test-and-build`; require branches to be up to date.

**Ruleset `features`** — target: `features`, enforcement: Active,
**bypass list: Repository admin → Always allow**.
- Restrict deletions; Block force pushes.
- Require a pull request before merging (approvals: 0).
- Require status checks to pass: `test-and-build`.

With this, non-admins can only change `features` through a PR from their own branch, and
that PR needs green CI. Admins can push to `features` directly. When an admin opens a PR
into `features`, GitHub still shows the required check and blocks the normal merge button
while it's red — the only way past it is the explicit "bypass rules" checkbox, which this
project's rules forbid using for a red PR. (GitHub can't express "admins may push directly
but may never merge a red PR" as one hard setting: required checks also apply to direct
pushes, so a hard no-bypass check on `features` would block admins' direct pushes.)

Tags (`v*`) aren't covered by these rulesets, so the release script's tag push keeps
working; its fast-forward push to `features` relies on the admin bypass.

## Releases (maintainer only)

**The release script runs on `features` only — never on `master`.** `master` is protected:
nobody checks it out to release from or pushes to it; it only receives the release PR. The
script reads it as `origin/master` and refuses to start on any branch but `features`.

### 1. Prepare — on `features`

```bash
git checkout features && git pull
npm run release -- prepare 1.3.0 --dry-run   # preview: version bump + CHANGELOG entry
npm run release -- prepare 1.3.0             # do it (asks for confirmation)
```

Versions: `1.3.0`, or a pre-release `1.3.0-rc.1` (`alpha|beta|rc|a|b`). The `--` is
required — without it npm treats `--dry-run` as its own flag.

Checks before anything changes: on `features`; working tree clean (not required for
`--dry-run`); local `features` not behind `origin/features`; tag `v1.3.0` doesn't exist
locally or on `origin`; the version differs from the current one.

What it changes, in one commit `RELEASE:<date>:: v1.3.0`, then `git push origin features`:

| File | Change |
| --- | --- |
| `package.json`, `package-lock.json` | `version` (via `npm version --no-git-tag-version`) |
| `android/app/build.gradle` | `versionName` = version, `versionCode` + 1 |
| `ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` = version, `CURRENT_PROJECT_VERSION` + 1 |
| `CHANGELOG.md` | new entry on top: commits since the last tag (merge commits excluded), grouped by subject prefix — `UPD:` → Updates, `FIX:` → Fixes, `UPD:FIX:` → both, others → Other Changes |

Only these files are committed — anything else in the tree is never swept in.

### 2. Pull request `features → master`

Open it (the script prints the link), wait for CI (`test-and-build`) to go green, and merge
it with **"Create a merge commit"** — not squash, not rebase. A rebased/squashed merge
rewrites the commits, and step 3 can then no longer line `features` up with `master`.

### 3. Tag — on `features`, after the merge

```bash
npm run release -- tag   # asks for confirmation
```

It fetches `origin`, takes the version from `origin/master`'s `package.json`, and:

1. tags the tip of `origin/master` as `v<version>` and pushes the tag;
2. fast-forwards `origin/features` to `origin/master`, so `features`, `master` and the tag
   point at the same commit and the next CHANGELOG entry starts exactly at this tag. If
   `features` got new commits after the PR, the fast-forward is refused — the script says
   so; merge `master` into `features` by hand in that case.

Then `git pull` on `features`.

### 4. Native builds

Build from the tag: `git checkout v1.3.0`, then `npm run build:all` (Android); the iOS
maintainer builds the same tag in Xcode. Go back with `git checkout features`.

### If something goes wrong

- **CI is red on the release PR** — fix it on `features`, push; the PR updates. The
  release commit stays, no need to re-run `prepare`.
- **Release abandoned before merging** — close the PR and revert the `RELEASE:` commit on
  `features` (`git revert <sha>`); no tag was created.
- **`tag` says the tag already exists** — the release was already tagged, or the PR
  hasn't been merged yet (so `origin/master` still has the previous version).

## Claude Code privacy settings

Based on `code.claude.com/docs/en/data-usage` and `code.claude.com/docs/en/env-vars` —
Claude Code's own settings can change; if something here looks off, check those pages.

### Two different switches — don't confuse them

Anthropic's own docs call this out explicitly: **telemetry** and **model-training data use**
are two separate, independently-controlled things. Turning off telemetry does **not** stop
your code/conversations from being used to train future models, and there is no project-level
setting that controls training use — it lives entirely in your Claude account.

### 1. Telemetry (operational metrics and error reports) — a project setting

Already configured in `.claude/settings.json` at the repo root (which also holds the agent's
permission deny list, see `harness/git-workflow.md`):

```json
{
  "env": {
    "DISABLE_TELEMETRY": "1",
    "DISABLE_ERROR_REPORTING": "1",
    "DISABLE_FEEDBACK_COMMAND": "1"
  }
}
```

- `DISABLE_TELEMETRY=1` — opts out of usage metrics (latency, reliability, usage patterns).
  These never include code, file paths, or prompts even when telemetry is on, but turn it
  off anyway for this project.
- `DISABLE_ERROR_REPORTING=1` — opts out of sending Claude Code's own crash/error reports
  (stack traces from Claude Code's internals, not from this project's code).
- `DISABLE_FEEDBACK_COMMAND=1` — disables `/feedback`, `/bug`, and `/share`, which otherwise
  send a copy of the conversation (including code) to Anthropic when explicitly invoked.

**Deliberately not set:** `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. It disables telemetry
too, but it also turns off feature-flag evaluation as a side effect, which can silently
break unrelated Claude Code functionality (Remote Control, Channels). The three variables
above cover the actual privacy goal without that trade-off. If Claude Code ever surfaces a
"How is Claude doing this session?" survey or a follow-up offering to upload the session
transcript, decline it (or choose "Don't ask again") — nothing is uploaded unless that
follow-up is explicitly accepted, but accepting it does send the transcript, so just say no.

This is checked into the repo (not a personal local settings file) so it applies for
anyone working on this project, not just one machine — it's a project-level decision, not a
personal preference.

### 2. Model training opt-out — an account setting, not a project one

This is the one that actually controls whether this project's code can be used to train
future Claude models. It is **not** configurable from inside the repo or from Claude Code's
own settings files at all — it's a toggle on the Claude account itself:

**claude.ai → Settings → Privacy → "Help improve Claude"**, or directly at
`claude.ai/settings/data-privacy-controls`. Turn it off there, once, on whichever account
Claude Code is signed in with.

Two things worth knowing about what that toggle actually does, per Anthropic's own data-usage
docs (true for Free/Pro/Max accounts, which is the relevant case for an individual
developer's own account — Team/Enterprise/API accounts already default to not training on
code unless separately opted in):

- **On**: conversations/code may be used to improve future models; data is retained 5 years.
- **Off**: data is not used for training; retention drops to 30 days instead.

This is a one-time setting, not something the agent can act on or verify from inside a
session — if it matters for this project, it needs to be turned off in the account settings
directly, and this file is just the reminder of where that lives.

## Running things locally

```bash
npm install
npm test               # whole suite once
npm run test:watch     # while developing
npm run test:coverage  # suite + coverage report in coverage/
npm run lint           # ESLint (npm run lint:fix applies the safe fixes)
npm run format         # Prettier; npm run format:check only reports
npm run build
```

Node version: see `.nvmrc` (Node 24+).

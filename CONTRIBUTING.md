# Contributing

Thanks for wanting to help. This app is small, offline-first and runs on weak phones, so
the bar for merging is about not breaking what already works.

The detailed rules live in [`harness/`](harness/) — they're written for the project's AI
agent, but they are the project's real engineering rules and apply to everyone. This file is
the short version plus the merge gate.

## Workflow

- **Android first.** The app is developed and tested on Android first; iOS builds and App
  Store releases are handled by the iOS maintainer. If your change touches native config
  (plugins, permissions, `android/`, `ios/`), say in the PR what the iOS side needs.
- Create your own branch from `features` (`feature/<short-name>` or `fix/<short-name>`),
  push it, and open the pull request **into `features`**. Direct pushes to `features` are
  for admins only.
- `master` is the release branch: nobody pushes to it, it only receives PRs from
  `features`, and releases are cut from it manually by the maintainer.
- Keep a pull request to one logical change. A big feature is a series of smaller PRs.
- Commit subjects use the prefix the release script builds `CHANGELOG.md` from:
  `UPD:` (new/changed), `FIX:` (bug fix), `UPD:FIX:` (both), optionally dated —
  `UPD:2026-10-16:: Add cover-photo switching`. See
  [`harness/git-workflow.md`](harness/git-workflow.md).
- Never bump versions, tag, or run `npm run release` / `appstore/` scripts in a PR —
  releases are done by the maintainer.

## The merge gate

A pull request is merged **only if all of the following hold**. CI checks the first two
automatically; the rest is on the author and the reviewer — the PR template has the
checklist.

1. **The whole test suite passes** — `npm test`. Not just the new tests: everything that
   was green before must still be green.
2. **The project builds cleanly** — `npm run build`, with no new warnings.
3. **New code is tested.** New logic has tests for the normal path, the edge cases that
   matter and the failure path; a bug fix has a test that fails without the fix. See
   [`harness/testing.md`](harness/testing.md).
4. **Architecture rules are followed** — files are where
   [`harness/architecture.md`](harness/architecture.md) says they go, state follows
   [`harness/state-management.md`](harness/state-management.md), UI uses Konsta first and
   Tailwind second ([`harness/styling.md`](harness/styling.md)).
5. **Code style is followed** — [`harness/code-style.md`](harness/code-style.md) and
   [`harness/svelte-rules.md`](harness/svelte-rules.md): Svelte 5 runes, JSDoc on exported
   functions, the project logger instead of `console.*`, no dead code, no magic numbers
   (named constants instead), Prettier formatting. One function does one job; extend an
   existing one (an optional parameter that keeps the old behavior) rather than copy it.
   Code reads easily for a human; mixed concerns are split into modules — except builder
   classes (`mapPointsBuilder`, `customPointsBuilder`, ...), from which only logic shared
   between builders is extracted.
6. **All four languages are complete.** Every new user-visible string exists in `ru`, `en`,
   `pl` and `uz` with the same placeholders ([`harness/i18n.md`](harness/i18n.md)).
7. **No unapproved dependencies.** A new package in `package.json` needs the maintainer's
   explicit OK first ([`harness/dependencies.md`](harness/dependencies.md)).
8. **Nothing changes what [`PRIVACY.md`](PRIVACY.md) promises.** The app collects no data
   and works offline; a change that sends anything off the device doesn't get merged
   without a deliberate decision and an updated privacy policy.
9. **The harness is up to date.** If the change alters architecture, adds a directory,
   subsystem, script or config file, the matching `harness/*.md` file is updated in the
   same PR ([`harness/maintaining-this-harness.md`](harness/maintaining-this-harness.md)).

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

## Running things locally

```bash
npm install
npm test               # whole suite once
npm run test:watch     # while developing
npm run test:coverage  # suite + coverage report in coverage/
npm run build
```

Node version: see `.nvmrc` (Node 24+).

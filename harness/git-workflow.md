# Git workflow

## One branch, patches instead of commits

- **All work happens on the `features` branch.** There is no per-feature sub-branch
  (`features/<name>`) — that earlier scheme is retired. Confirm you're on `features`
  (not `master`) before starting; if the repo is on `master`, switch to `features` or ask,
  don't start work on `master`.
- **Deliver every change as a patch file (`git diff`), not a commit you make yourself.**
  This mirrors exactly how this project's features were built before the agent existed:
  work in the checkout, build and test it, then produce a diff the human reviews and
  applies by hand with `git apply`. Keep the working tree's actual commit history out of
  it — don't run `git commit`.
- A patch should be scoped the way a commit would be: one coherent change, buildable and
  passing tests on its own, not a dozen unrelated edits bundled together. A large feature
  still gets split into a sequence of patches (step 1, step 2, ...) applied in order, the
  same way the custom-markers feature was built as a numbered sequence of patches rather
  than one giant diff.

## What the agent does and does not do

- **Does:** work on the `features` branch, write the code, write and run the tests, build
  the project, and produce a patch file plus a suggested commit message to go with it (see
  below) — and, where relevant, a short note on what to run after applying it (`npm
  install <package>`, `npx cap sync`, etc.).
- **Does not, ever:**
  - `git commit` — the patch *is* the deliverable; the human commits after applying it.
  - `git push` (to any branch, any remote).
  - Run a release/publish/deploy script, or anything that tags and ships a version.
  - Create a new branch, merge a branch, or touch `master` at all.
  - Force-push or rewrite history — there's no history to rewrite, since the agent isn't
    committing.

## Suggested commit messages (for the human to use after applying the patch)

Even though the agent doesn't commit, it prepares the message the human would use:

- Multi-line, but kept reasonable — a short imperative subject line, a blank line, then a
  handful of bullet points on *what* changed and, where it's not obvious, *why*.
- Written in English.
- Don't add Claude Code's own auto-attribution footer ("🤖 Generated with Claude Code",
  "Co-Authored-By: Claude") to a suggested message for this project — the human is
  authoring the commit themselves after reviewing the patch.

Example shape:

```
Add cover-photo switching to the marker editor

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

A patch that adds a new package to `package.json`/the lockfile only happens after the
explicit approval flow in `harness/dependencies.md` — never bundle an unapproved dependency
addition into an otherwise-unrelated patch.

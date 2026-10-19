---
paths:
  - "CLAUDE.md"
  - "AGENTS.md"
  - "CONTRIBUTING.md"
  - "harness/**"
  - ".claude/rules/**"
  - "src/architectureTree.test.js"
  - "src/repositoryTree.test.js"
  - "src/harnessPaths.test.js"
  - "src/docsParity.test.js"
  - "docs/**"
  - "src/test/harnessTree.js"
---

# Maintaining this harness

New subsystems the size of navigation or custom markers will keep showing up. This file is
how the harness keeps up with them, so "the agent knows the full project" stays true instead
of slowly going stale.

## Where a harness file goes

- **`harness/`** — rules every task needs (architecture map, code style, performance,
  testing and non-regression, git workflow, the session budget). Each one is `@`-imported in
  `CLAUDE.md` and costs context in every session, so this set stays small: a file belongs
  here only if ignoring it would go wrong in a task that never opens a file of its area.
- **`.claude/rules/`** — everything tied to an area of the code: a subsystem, a screen,
  styling, i18n, the repo root, dependencies, test helpers, this file. Each starts with a
  `paths:` frontmatter (a YAML list of globs from the repo root, e.g. `"src/views/**"`);
  Claude Code loads it when the agent reads or edits a matching file. List every file the
  rules apply to — a glob that misses a file means the rules never load for it. Each glob
  must match at least one file (`src/harnessPaths.test.js` checks it).
- A rule that a *task* needs before any file is opened — "don't touch `scripts/`", "every
  string in four locales" — gets its one-line summary in `CLAUDE.md`, the details in the
  area's file.

## One rule, one place — and only the present

- **Every rule has exactly one home.** Anywhere else it's at most a one-line pointer
  (`see harness/x.md → "Section"`), never a second wording — two wordings drift apart and
  the agent can't tell which one wins. `CLAUDE.md`'s top-level rules are such pointers: a
  one-paragraph summary each. The merge gate's home is `.github/pull_request_template.md`;
  the release procedure's is `CONTRIBUTING.md` → "Releases". Human-facing
  `CONTRIBUTING.md` summarizes the harness for people, by design — keep it to a summary.
- **Describe the code as it is now, not how it got there.** No "before it was fixed", "was
  removed", "at the time this was written", which session did what — that's git history and
  it goes stale. An example from the code is fine in the present tense
  (`customPointsState.add()` takes an optional `id`), and so is a plan still in progress
  (a refactoring agreed and under way).
- **A path in `inline code` must exist.** `src/harnessPaths.test.js` checks every
  path-shaped span in `CLAUDE.md`, `harness/`, `.claude/rules/`, `AGENTS.md` and
  `CONTRIBUTING.md` against the working tree; write paths in full enough to be found, and
  use `<placeholders>` for hypothetical ones.

## Developer docs (`docs/`) — for humans, kept in step with the code

`docs/ru/` (primary) and `docs/en/` are the module reference for people who work without an
agent: what a module does, what it's connected to, how to call it, with real examples. They
are **not** agent rules — a rule lives in `harness/` or `.claude/rules/`, and the docs never
restate one as a rule (they may describe the same code). Keep them current like the harness:

- A change to what a module does or how it's used (its exported API, its behavior, a new
  module, a removed one) updates the page that describes it in **both** `docs/ru/` and
  `docs/en/` in the same change. A stale docs page is a bug in that change.
- `ru` is written first; `en` is its translation with the **same** files, the same heading
  structure and the same code in every example — only the prose and the code comments are
  translated (comments in the document's language). Literals in example code stay the same
  in both (neutral values, or a string quoted from a named locale file). An untagged fenced
  block is a diagram or a file tree — its text is translated. `src/docsParity.test.js` checks
  the file set, the heading levels, the tagged examples' code with comments stripped and the
  number of untagged blocks.
- Examples are real: copied from or checked against the code (the module's JSDoc
  `@example` is the first source), never invented keys, fields or signatures.
- Technical and short: what it does, what it's connected to, how to use it. No narrative.
- A path in `inline code` must exist, as in the harness (`src/harnessPaths.test.js` covers
  `docs/` too); a new docs page gets a row in the table of contents of both `README.md`s.

## A new subsystem gets its own file, every time

When a new feature is big enough to need its own architecture write-up (a new `services/`
module plus supporting state/components, not just one new file in an existing area):

1. Write `.claude/rules/<name>-subsystem.md` — same depth and shape as the existing
   subsystem files (what it's for, where the pieces live, how they fit together, what
   decisions a future change needs to respect), with a `paths:` list covering all its files.
   Its developer docs page goes to `docs/ru/` and `docs/en/` ("Developer docs" above).
2. Add a one-line entry for it to the "Subsystem deep dives" list in
   `harness/architecture.md`.
3. If it introduces a new top-level directory or meaningfully changes what goes where,
   update the directory-layout section and the "deciding where a new file goes" list in
   `harness/architecture.md` too. The same goes for the repo root: a new top-level
   directory, config file, or script gets an entry in `.claude/rules/repository-layout.md`
   in the change that adds it.

A smaller addition (a new component in an existing feature area, a new method on an
existing service) does **not** need a new file — update the relevant file's content (and
its `paths:` if the new file isn't covered yet) in the same change as the code. An
out-of-date harness file is a bug in the change, not a follow-up.

## A file over ~400 lines gets split

Split it into a subfolder of focused files by natural sub-topic (`.claude/rules/<topic>/`
or `harness/<topic>/`) — for custom markers that would be format and storage, photos,
editor and display. Each split file keeps the same depth of detail — splitting is about
navigability, not cutting content — and gets its own, narrower `paths:`. Delete the
original file, and for `harness/` replace its `@` line in `CLAUDE.md` with one line per new
file. Update the "Subsystem deep dives" list in `harness/architecture.md`.

## Keeping `architecture.md` itself honest

`harness/architecture.md`'s directory-layout section and "deciding where a new file goes"
list describe **100% of `src/`**, not just the parts covered by a subsystem file. If a
change adds a new top-level directory, a new kind of file, or changes what belongs where,
update `architecture.md` in that same change.

The tree at the top of that section lists every directory of `src/` and the entry-point
files at its root — nothing else. `src/architectureTree.test.js` compares it with the real
`src/`, so a new, renamed or removed directory (or a new root file) fails the suite until
the tree is updated; add a one-line `# comment` for a new directory and, if it brings rules
of its own, a bullet under "Rules per directory". Don't add individual files inside
directories to the tree — that's what the prose and the subsystem files are for.

The repo root works the same way: the tree at the top of `.claude/rules/repository-layout.md`
lists every root entry git doesn't ignore, and `src/repositoryTree.test.js` checks it against
the working tree (`git ls-files --cached --others --exclude-standard`) — a new root file or
directory, committed or not (or a new subdirectory of one the tree expands), needs its line
there, plus a prose entry further down that file if it has rules of its own.

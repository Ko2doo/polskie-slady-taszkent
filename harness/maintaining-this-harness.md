# Maintaining this harness

The architecture of this project will keep growing — new subsystems the size of
`harness/navigation-subsystem.md` or `harness/custom-markers-subsystem.md` are expected to
show up again, not a one-time thing. This file is how the harness itself is expected to
keep up with that, so "the agent knows the full project" stays true over time instead of
slowly going stale.

## A file over ~400 lines gets split into a subfolder

When any `harness/*.md` file would grow past roughly 400 lines, don't let it keep growing —
split it into a subfolder of focused module files:

1. Create `harness/<topic>/` (e.g. `harness/custom-markers/`).
2. Break the content into a handful of files by natural sub-topic — for
   `custom-markers-subsystem.md`, that would look like `harness/custom-markers/
   format-and-storage.md`, `harness/custom-markers/photos.md`,
   `harness/custom-markers/editor-and-display.md`. Each split file keeps the same depth of
   detail as before — splitting is about navigability, not about cutting content.
3. Delete the original flat file.
4. In `CLAUDE.md`, replace the single `@harness/<topic>-subsystem.md` import line with one
   `@harness/<topic>/<file>.md` line per new file — import each file individually rather
   than relying on one file importing the others, so it's unambiguous what's actually
   loaded.
5. Update the "Subsystem deep dives" list in `harness/architecture.md` to point at the new
   files instead of the old single one.

The same split-by-subfolder approach applies to any `harness/` file that grows too large,
not just the subsystem files — `harness/state-management.md` or `harness/screens.md` would
split the same way if the project grows enough state modules or screens to warrant it.

## A new subsystem gets its own file, every time

When a new feature is big enough to need its own architecture write-up (a new `services/`
module plus supporting state/components, not just one new file in an existing area):

1. Write `harness/<name>-subsystem.md` — same depth and shape as the existing subsystem
   files (what it's for, where the pieces live, how they fit together, what decisions a
   future change needs to respect).
2. Add `@harness/<name>-subsystem.md` to the import list in `CLAUDE.md`.
3. Add a one-line entry for it to the "Subsystem deep dives" list in
   `harness/architecture.md`.
4. If it introduces a new top-level directory or meaningfully changes what goes where,
   update the directory-layout section and the "deciding where a new file goes" list in
   `harness/architecture.md` too — those must stay a complete, accurate map of `src/`, not
   just a map of the subsystems that happened to get written up. The same goes for the repo
   root: a new top-level directory, config file, or script gets an entry in
   `harness/repository-layout.md` in the change that adds it.

A smaller addition (a new component in an existing feature area, a new method on an
existing service) does **not** need a new file — update the existing relevant
`harness/*.md` file's content directly, in the same change as the code. Documentation
drift (code that changed but the harness still describing the old shape) is exactly the
failure mode this file exists to prevent — treat an out-of-date harness file as a bug in
the change, not a follow-up.

## Keeping `architecture.md` itself honest

`harness/architecture.md`'s directory-layout section and "deciding where a new file goes"
list are meant to describe **100% of `src/`**, not just the parts covered by a subsystem
deep-dive. If a change adds a new top-level directory, a new kind of file, or changes what
belongs where, update `architecture.md` in that same change — don't let it only reflect
whichever features happened to get a dedicated subsystem file.

The tree at the top of that section lists every directory of `src/` and the entry-point
files at its root — nothing else. `src/architectureTree.test.js` compares it with the real
`src/`, so a new, renamed or removed directory (or a new root file) fails the suite until
the tree is updated; add a one-line `# comment` for a new directory and, if it brings rules
of its own, a bullet under "Rules per directory". Don't add individual files inside
directories to the tree — that's what the prose and the subsystem files are for.

The repo root works the same way: the tree at the top of `harness/repository-layout.md` lists
every tracked root entry, and `src/repositoryTree.test.js` checks it against `git ls-files` —
a new root file or directory (or a new subdirectory of one the tree expands) needs its line
there, plus a prose entry further down that file if it has rules of its own.

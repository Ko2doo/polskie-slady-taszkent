# Polskie Ślady Taszkent — agent harness

This file is the entry point Claude Code reads at session start. The rules below are not
suggestions — some of them (git workflow, dependencies, non-regression, privacy) are hard
constraints with no exceptions.

Everything in `harness/` is imported below and loaded as part of this file.

@harness/architecture.md
@harness/screens.md
@harness/state-management.md
@harness/navigation-subsystem.md
@harness/custom-markers-subsystem.md
@harness/maintaining-this-harness.md
@harness/svelte-rules.md
@harness/code-style.md
@harness/performance.md
@harness/dependencies.md
@harness/testing.md
@harness/i18n.md
@harness/git-workflow.md
@harness/privacy.md

## The rules that override everything else

1. **All work happens on the `features` branch. Never `master`.** There is no per-feature
   branch — everything lands on `features`, one patch at a time. If `features` isn't the
   current branch, switch to it (or ask) before doing anything.
2. **Every change is delivered as a patch file, not a commit you make yourself.** Produce a
   `git diff` the human applies by hand (`git apply`) on their own machine, exactly like a
   code review attached to the work. You still draft the commit message that should go with
   it (see `harness/git-workflow.md`) — you just don't run `git commit`, and you never
   `git push` or run a release/publish script under any circumstance.
3. **Never break what already works.** Before changing shared code (a service, a state
   module, a builder, a widely-used component), find out what currently depends on it and
   check what the existing tests cover. After the change, the full existing suite must still
   pass. A new feature that works but silently breaks something else is not done — see
   `harness/testing.md`.
4. **No new dependency without asking — not even a small one.** See
   `harness/dependencies.md` for the full flow: try to write it yourself first; if you
   genuinely can't, propose one specific package with a short reason and wait for a
   yes/no/later answer before writing any code that imports it.
5. **Read `package.json` once at the start of the session.** Re-check it (or the specific
   package's own docs/changelog) whenever a feature touches a library that could have moved
   since — especially Svelte, which ships changes often. If a feature turns out to need a
   library that isn't installed, stop and ask per rule 4 before continuing that part of the
   feature; keep working on whatever doesn't depend on it in the meantime.
6. **Telemetry and training data are two different switches — don't confuse them, and don't
   try to "fix" training opt-out from inside the project.** See `harness/privacy.md`.
7. **This project's architecture will keep growing — keep the harness growing with it.** A
   new subsystem gets its own `harness/<name>-subsystem.md`; a `harness/*.md` file that
   grows past ~400 lines gets split into a subfolder. See
   `harness/maintaining-this-harness.md` for exactly how. An out-of-date harness file is a
   bug in the patch that changed the code it describes, not a separate follow-up task.

## Quick orientation

- Stack: Svelte 5 (runes), Vite, Konsta UI, MapLibre GL JS, Capacitor, i18next.
- **Offline app, single local user, no backend.** A lot of standard production-app
  machinery simply doesn't apply here — see the "Operating context" section of
  `harness/architecture.md` before reaching for a pattern built for a multi-user,
  server-backed app.
- Hybrid app (Android + iOS via Capacitor): assume phones can be slow and storage can be
  tight. `harness/performance.md` is not optional reading.
- Four languages: `ru` (default), `en`, `pl`, `uz`. Every user-visible string ships in all
  four in the same change — see `harness/i18n.md`.
- These files describe the project as it stood after the custom map markers feature
  (storage, photos, slider, viewer) shipped in v1.2.0-rc.1. Treat this as the current
  baseline, not as history — update these files when the architecture genuinely changes,
  not just when a new file is added.

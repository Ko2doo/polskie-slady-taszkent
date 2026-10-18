# Known bugs

Working log of bugs found while covering the project with tests. Lifecycle and rules:
`harness/testing.md` → "Bug log". Temporary: deleted once every entry is fixed and the fix
summary has been handed over for the commit.

Status: `open` (pinned by an `it.fails` test, code untouched) → `fixed` (code fixed, `.fails`
removed, suite green, a **Fixed:** line saying what changed — the source for the final commit
message).

## BUG-1 · An unexpected stored onboarding flag hides the onboarding for good — open

- **Where:** `src/store/appStartInitialize.js` (`initFirstLaunch`)
- **What:** only `true` (hide), `false`/`null`/`undefined` (show) are handled; any other stored
  value (written by another version, or by hand) leaves `APP_FIRST_LAUNCH_STORAGE_VAL` at
  `null`, so the wizard is never shown and nothing marks the onboarding as done.
- **Test:** `src/store/appStartInitialize.test.js` → "an unexpected stored value › shows the
  onboarding" (`it.fails`).
- **Fix:** show the onboarding unless the stored value is exactly `true`
  (`set(isOnboardingCompleted !== true)`), the rule `customPointsDialogState` already follows.
  Checked: flips the pinned test.

## BUG-2 · The navbar back link has no accessible name — open

- **Where:** `NavbarBackLink` in `src/views/Settings/Settings.svelte`, `About.svelte`,
  `TechnicalInfo.svelte`, `src/components/Article.svelte`
- **What:** an icon-only link (Konsta's `showText` is `false`), no `aria-label`: a screen reader
  announces nothing (`.claude/rules/i18n.md` counts `aria-label`s as user-visible text).
- **Test:** `src/views/Settings/Settings.test.js` → "the back link has an accessible name"
  (`it.fails`); the other three have no test yet.
- **Fix:** `aria-label={$i18n.t("ui:buttons:back")}` on all four (Konsta passes it through to the
  link; the key exists in all four locales). Checked: flips the pinned test.

## BUG-3 · Commented-out code left outside the earlier dead-code cleanup — open

- **Where:** `src/views/Map/MapNavigationGPS.svelte.js:20` (an import),
  `src/views/Settings/Settings.svelte` (`// $inspect(route);`), `src/capacitor/utils/appStorage.js`
  (`// return value ?? fallback;` in `getStorage`), `src/views/Map/MapTheme.svelte.js`
  (`reapplyOverlays`, `init` — also in the legacy-zones table).
- **What:** dead code per `harness/code-style.md`. No behavior impact.
- **Test:** none.
- **Fix:** remove them — planned with the legacy refactoring steps.

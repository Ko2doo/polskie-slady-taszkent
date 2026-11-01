# Polskie Ślady Taszkent documentation

A code reference for developers: what each module does, what it's connected to and how to use
it. The Russian version, [`docs/ru`](../ru/00-README.md), is the primary one; content and examples
are the same.

The AI agent's rules (`CLAUDE.md`, `harness/`, `.claude/rules/`) are a separate thing. This
documentation doesn't replace them and doesn't require working with an agent.

## Contents

| Section | What it covers |
| --- | --- |
| [Getting started](01-getting-started.md) | Setup, commands, checks, branches and PRs |
| [Architecture](02-architecture.md) | App start, the shell, `src/` directories, where new code goes, errors |
| [Screens](03-screens.md) | Routes, the shared screen pattern, adding a screen |
| [Map screen](04-map-screen.md) | Map session, points, taps, theme, loading |
| [Custom markers](05-custom-markers.md) | File format, storage, photos, export/import, editor |
| [Navigation](06-navigation.md) | A\*, the road graph, GPS tracking, controllers, navigation UI |
| [State](07-state.md) | `lib/state/`, UI profiles, toggles, overlays and the Back button, stores |
| [Native layer](08-capacitor.md) | Capacitor wrappers, files, preferences, permissions, error codes, toasts |
| [UI, styling, translations](09-ui-i18n-styling.md) | Konsta UI, Tailwind, dark theme, i18next |
| [Map data](10-map-data.md) | PMTiles, style, glyphs, sprites, building the navigation graph |
| [Tests and quality](11-testing.md) | Vitest, helpers, mocks, ESLint, Prettier |

## Conventions

- Paths are relative to `src/` unless stated otherwise: `services/navigation.js` = `src/services/navigation.js`.
- Imports in examples use the `@` → `src/` alias, as the code does.
- Files are numbered in reading order: `00-README.md` is the index, the rest follow the table
  above. A new page takes its place in that order.
- The docs describe the code as it is now. Changed a module — update its section in `docs/ru`
  and `docs/en` in the same change. `src/docsParity.test.js` checks that both versions have
  the same files, the same heading structure and the same example code.

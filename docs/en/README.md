# Polskie Ślady Taszkent documentation

A code reference for developers: what each module does, what it's connected to and how to use
it. The Russian version, [`docs/ru`](../ru/README.md), is the primary one; content and examples
are the same.

The AI agent's rules (`CLAUDE.md`, `harness/`, `.claude/rules/`) are a separate thing. This
documentation doesn't replace them and doesn't require working with an agent.

## Contents

| Section | What it covers |
| --- | --- |
| [Getting started](getting-started.md) | Setup, commands, checks, branches and PRs |
| [Architecture](architecture.md) | App start, the shell, `src/` directories, where new code goes, errors |
| [Screens](screens.md) | Routes, the shared screen pattern, adding a screen |
| [Map screen](map-screen.md) | Map session, points, taps, theme, loading |
| [Custom markers](custom-markers.md) | File format, storage, photos, export/import, editor |
| [Navigation](navigation.md) | A\*, the road graph, GPS tracking, controllers, navigation UI |
| [State](state.md) | `lib/state/`, UI profiles, toggles, overlays and the Back button, stores |
| [Native layer](capacitor.md) | Capacitor wrappers, files, preferences, permissions, error codes, toasts |
| [UI, styling, translations](ui-i18n-styling.md) | Konsta UI, Tailwind, dark theme, i18next |
| [Map data](map-data.md) | PMTiles, style, glyphs, sprites, building the navigation graph |
| [Tests and quality](testing.md) | Vitest, helpers, mocks, ESLint, Prettier |

## Conventions

- Paths are relative to `src/` unless stated otherwise: `services/navigation.js` = `src/services/navigation.js`.
- Imports in examples use the `@` → `src/` alias, as the code does.
- The docs describe the code as it is now. Changed a module — update its section in `docs/ru`
  and `docs/en` in the same change. `src/docsParity.test.js` checks that both versions have
  the same files, the same heading structure and the same example code.

# Getting started

## Environment

- Node.js ≥ 24 (exact version in `.nvmrc`), npm ≥ 11.
- For Android builds: JDK 21 (`java-21-openjdk`) and the Android SDK.
- iOS is built by a separate maintainer (`README.md` → Maintainers). If your change touches
  the native side, say in the PR what needs doing on iOS.

```bash
nvm use
npm install
npm run dev
```

`npm run dev` runs Vite with `--host`: the app opens in a browser on your computer and on a
phone on the same network. Everything works in the browser except native features, which fall
back to the Capacitor plugins' web implementations: Filesystem on top of IndexedDB, browser
geolocation, a file download instead of the system share sheet.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | The whole test suite once (Vitest) |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests + coverage report in `coverage/` |
| `npm run lint` / `npm run lint:fix` | ESLint / with auto-fix |
| `npm run format` / `npm run format:check` | Prettier: format / check only |
| `npm run build` | Build into `dist/`; `prebuild` runs lint and format:check first |
| `npm run build:sync:android` | `npx cap sync android`: copies `dist/` and plugins into the Android project |
| `npm run build:debugApp:android` | Debug APK via Gradle |
| `npm run build:all` | Web build + sync + debug APK + release AAB |

`npm run release` and the scripts in `appstore/` are run by the maintainer only.

## Running on an Android device

```bash
npm run build
npm run build:sync:android
npx cap open android
```

Then pick the device in Android Studio and press Run. After adding a Capacitor plugin or a
new permission, always run `sync`: without it the native project doesn't know about the plugin.

## Branches and pull requests

- `master` is the release branch, nobody writes to it directly.
- `features` is the main development branch. Your `feature/<name>` or `fix/<name>` branch is
  made from it, and the PR goes **into `features`**.
- The commit subject prefix ends up in `CHANGELOG.md`: `UPD:` (new or changed), `FIX:` (a fix),
  `UPD:FIX:` (both).

```bash
git fetch origin
git checkout -b feature/my-change origin/features
git commit -m "UPD: Add marker sorting"
git push -u origin feature/my-change
```

Without write access, work through a fork; step by step in `CONTRIBUTING.md` → "Opening a
pull request".

## Before a PR

The checklist is in `.github/pull_request_template.md`. Required:

1. `npm test` is green as a whole, not just the new tests.
2. `npm run lint` has no errors, `npm run format:check` passes, `npm run build` is clean.
3. New logic is covered by tests. A bug fix has a test that fails without the fix.
4. New UI strings exist in all four locales (`ru`, `en`, `pl`, `uz`).
5. No new dependencies, or the maintainer approved them.
6. The docs in `docs/ru` and `docs/en` are updated if a module's behavior changed.

CI (`.github/workflows/ci.yml`, job `test-and-build`) runs items 1–2 on every push and PR.

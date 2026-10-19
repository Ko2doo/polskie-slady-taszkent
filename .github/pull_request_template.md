## What and why

<!-- One logical change. What does it do, and why is it needed? -->

## How it was verified

<!-- Tests added/updated; anything checked only by hand (device, platform, screen). -->

## Merge gate (see CONTRIBUTING.md)

- [ ] `npm test` passes — the whole suite, not just the new tests
- [ ] `npm run lint` has no errors and `npm run format:check` passes (both also run before every `npm run build`)
- [ ] `npm run build` is clean, no new warnings
- [ ] New logic / bug fix is covered by tests (a fix has a test that fails without it)
- [ ] Architecture rules followed (`harness/architecture.md`, `.claude/rules/state-management.md`, `styling.md`)
- [ ] Code style followed and the code reads easily (`harness/code-style.md`, `.claude/rules/svelte-rules.md`)
- [ ] New UI strings exist in all four locales (`ru`, `en`, `pl`, `uz`) — or no new strings
- [ ] No new dependency, or it was approved by the maintainer
- [ ] Nothing contradicts `PRIVACY.md` (no data leaves the device)
- [ ] Harness (`harness/`, `.claude/rules/`) updated if architecture, directories, scripts or configs changed
- [ ] Developer docs (`docs/ru` and `docs/en`, same examples) updated if a module's behavior or usage changed
- [ ] PR targets `features`, not `master`

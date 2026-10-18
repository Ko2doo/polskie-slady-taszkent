# Agent instructions

This project's rules for AI coding agents live in [`CLAUDE.md`](CLAUDE.md), the
[`harness/`](harness/) files it imports, and [`.claude/rules/`](.claude/rules/). Read
`CLAUDE.md` first, then every `harness/*.md` file listed in it. Each `.claude/rules/*.md`
file covers one area of the code — its `paths:` frontmatter lists the files it applies to;
read it before working on any of them. Together they are the project's real engineering
rules (architecture, code style, testing and non-regression, i18n, dependencies, git
workflow) and apply to every agent and every human contributor alike.

This file is only a pointer for agents that look for `AGENTS.md`; don't add rules here —
they go into `CLAUDE.md`/`harness/`/`.claude/rules/` so there is one source of truth.

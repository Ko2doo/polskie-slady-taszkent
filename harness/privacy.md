# Claude Code privacy settings for this project

Current as of when this file was written (based on `code.claude.com/docs/en/data-usage` and
`code.claude.com/docs/en/env-vars`) — Claude Code's own settings can change; if something
here looks off, check those pages rather than assuming this file is still accurate.

## Two different switches — don't confuse them

Anthropic's own docs call this out explicitly: **telemetry** and **model-training data use**
are two separate, independently-controlled things. Turning off telemetry does **not** stop
your code/conversations from being used to train future models, and there is no project-level
setting that controls training use — it lives entirely in your Claude account.

### 1. Telemetry (operational metrics and error reports) — a project setting

Already configured in `.claude/settings.json` at the repo root:

```json
{
  "env": {
    "DISABLE_TELEMETRY": "1",
    "DISABLE_ERROR_REPORTING": "1",
    "DISABLE_FEEDBACK_COMMAND": "1"
  }
}
```

- `DISABLE_TELEMETRY=1` — opts out of usage metrics (latency, reliability, usage patterns).
  These never include code, file paths, or prompts even when telemetry is on, but turn it
  off anyway for this project.
- `DISABLE_ERROR_REPORTING=1` — opts out of sending Claude Code's own crash/error reports
  (stack traces from Claude Code's internals, not from this project's code).
- `DISABLE_FEEDBACK_COMMAND=1` — disables `/feedback`, `/bug`, and `/share`, which otherwise
  send a copy of the conversation (including code) to Anthropic when explicitly invoked.

**Deliberately not set:** `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`. It disables telemetry
too, but it also turns off feature-flag evaluation as a side effect, which can silently
break unrelated Claude Code functionality (Remote Control, Channels). The three variables
above cover the actual privacy goal without that trade-off. If Claude Code ever surfaces a
"How is Claude doing this session?" survey or a follow-up offering to upload the session
transcript, decline it (or choose "Don't ask again") — nothing is uploaded unless that
follow-up is explicitly accepted, but accepting it does send the transcript, so just say no.

This is checked into the repo (not a personal `settings.local.json`) so it applies for
anyone working on this project, not just one machine — it's a project-level decision, not a
personal preference.

## 2. Model training opt-out — an account setting, not a project one

This is the one that actually controls whether this project's code can be used to train
future Claude models. It is **not** configurable from inside the repo or from Claude Code's
own settings files at all — it's a toggle on the Claude account itself:

**claude.ai → Settings → Privacy → "Help improve Claude"**, or directly at
`claude.ai/settings/data-privacy-controls`. Turn it off there, once, on whichever account
Claude Code is signed in with.

Two things worth knowing about what that toggle actually does, per Anthropic's own data-usage
docs (true for Free/Pro/Max accounts, which is the relevant case for an individual
developer's own account — Team/Enterprise/API accounts already default to not training on
code unless separately opted in):

- **On**: conversations/code may be used to improve future models; data is retained 5 years.
- **Off**: data is not used for training; retention drops to 30 days instead.

This is a one-time setting, not something the agent can act on or verify from inside a
session — if it matters for this project, it needs to be turned off in the account settings
directly, and this file is just the reminder of where that lives.

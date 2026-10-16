# Working with the agent: session context budget

Applies to every kind of task (features, tests, refactoring, harness edits), not just testing.

## The 80% rule

A session's context window is finite. Close to the limit, older parts of the conversation get
summarized and details are lost — a step started there risks being finished on a partial
picture of what was already decided. So:

1. **Warn once usage passes 80%.** In the first reply after the session's context usage
   crosses ~80%, say so plainly at the top: roughly where usage is, and that it's time to
   wrap up and continue in a fresh session.
2. **Above 80%, don't start a new task.** If a new task arrives while usage is already over
   ~80%, don't begin it: say that the threshold is passed, describe the task's state (what
   would be done, what's left from earlier steps), and stop. Continue only if the human
   explicitly says to go ahead anyway.
3. **Crossing 80% in the middle of a step.** Don't abandon a half-applied change: bring the
   working tree to a coherent state (code + its tests green, or the step's own edits cleanly
   reverted from a saved copy), then stop and warn, listing exactly what's done and what's
   left.
4. **Handover.** When stopping because of the threshold, end with a short handover for the
   next session: the step in progress, files touched, what was verified, what's next. The
   harness itself (and `BUGS.md`, the coverage table in `harness/testing.md`) must already be
   up to date — a fresh session starts from those, not from this conversation.

## How the agent knows the usage

The agent has no exact percentage counter of its own context window. It estimates from what
the session exposes (a context-usage indicator, if present) and otherwise from the size of the
conversation so far: long file dumps, test output and many steps add up quickly. When unsure
whether 80% is passed, treat it as passed and warn — a false warning costs one message, a
lost-context step costs a redo. The human can check the real number at any time with
Claude Code's `/context` command.
The percentage is of the model's own context window, which differs by model (e.g. 1M tokens,
not 200k) — don't assume a size; if the human has shared a `/context` reading in the session,
estimate from that baseline.

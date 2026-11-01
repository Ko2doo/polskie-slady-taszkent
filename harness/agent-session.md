# Working with the agent: session context budget

Applies to every kind of task (features, tests, refactoring, harness edits), not just testing.

## The context limit is a hook

`.claude/hooks/context.mjs` reads the real context size from the session transcript. Past
600k tokens it asks for a handover note (step in progress, files touched, what was verified,
what's next) and refuses new prompts until the human starts a fresh session (`--force` in a
prompt overrides it). When the handover is requested, bring the working tree to a coherent
state first — code and its tests green, or the step's own edits cleanly reverted from a saved
copy — and don't start anything new. The harness and `BUGS.md` must already be up to date: a
fresh session starts from those, not from this conversation. Details:
`.claude/rules/maintaining-this-harness.md` → "Hooks".

## Keeping the context lean: tool output

Every tool result (a shell command's output, a file read) lands in the agent's own context in
full — it is not output for the human's terminal, and it is never freed for the rest of the
session. Unfiltered output is the main way a session fills up — a fifth of the window is
easily spent on raw command output. So, every time:

- **Read files by range, not whole.** Use the file-read tool with `offset`/`limit` for the
  part you need; find that part first with `grep -n`. Prefer it over `sed -n 'a,bp'`: a Read
  is what loads the area's path-scoped rules from `.claude/rules/`, a `sed` range may not.
  `cat` only a file that is genuinely short (a few dozen lines). Don't re-read a file that is
  already in context and unchanged.
- **Filter command output to what answers the question.** Test runs: `npm test 2>&1 | grep -E
  "Test Files|Tests |×|Error"` (summary + failures), not the full reporter output; to see a
  failure, `grep -A` around the one assertion. Builds: `| grep -iE "error|warn|built in"`.
  Searches: `grep -rln` (file names) before `grep -rn` (lines), and `| head` on both.
- **Loops print one line per item.** A mutation check or any repeated run reports
  `<label> => <summary line>`, never the whole log of each iteration.
- **Cap anything of unknown size** with `| head -N` / `| tail -N`; look further only if needed.
- **Listing a directory or a diff:** `git status --short`, `git diff --stat`, `wc -l` first;
  open the detail only for the files that matter.
- **Delegate a broad search** (many files, many naming variants) to a search sub-agent only
  when the human allows sub-agents; otherwise narrow it with the rules above.

The cost is not only this session's window: every reply re-processes the whole context, so a
bloated session also spends the human's usage limits faster.

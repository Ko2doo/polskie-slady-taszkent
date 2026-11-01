// PreToolUse (Edit|Write|NotebookEdit): the hard guards that used to be prose in the harness.
//  - never edit on `master` (harness/git-workflow.md → "Which branch")
//  - ask before touching hands-off paths and the dependency files (CLAUDE.md, rules/dependencies.md)
import { decide, git, readInput, repoRelative } from './lib.mjs';

const PROTECTED_BRANCH = 'master';
const ASK_BEFORE_EDITING = [
  { pattern: /^scripts\//, why: 'scripts/ is hands-off unless asked' },
  { pattern: /^appstore\//, why: 'appstore/ is hands-off unless asked' },
  { pattern: /^Design\//, why: 'Design/ holds service marketing sources, hands-off unless asked' },
  { pattern: /^package(-lock)?\.json$/, why: 'dependencies change only through the approval flow' },
];

const { tool_input: toolInput = {} } = readInput();
const path = repoRelative(toolInput.file_path ?? toolInput.notebook_path);
if (!path) process.exit(0);

const branch = git(['symbolic-ref', '--short', 'HEAD']).trim();
if (branch === PROTECTED_BRANCH) {
  decide('deny', `On ${PROTECTED_BRANCH}: stop and give the human the command to switch to features.`);
}

const match = ASK_BEFORE_EDITING.find(({ pattern }) => pattern.test(path));
if (match) decide('ask', `${path}: ${match.why}. Confirm only if the human asked for this change.`);

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

export const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

/**
 * Reads the hook's JSON payload from stdin.
 * @returns {object} the parsed payload, `{}` when stdin is empty or not JSON
 */
export function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

/**
 * Path of `file` relative to the repo root, or null when it lies outside the repo.
 * @param {string | undefined} file - absolute or repo-relative path
 * @returns {string | null} the repo-relative path, null when there is none or it is outside the repo
 */
export function repoRelative(file) {
  if (!file) return null;
  const relativePath = relative(PROJECT_DIR, resolve(PROJECT_DIR, file));
  return relativePath.startsWith('..') ? null : relativePath;
}

/**
 * Runs git in the repo root and returns its stdout.
 * @param {string[]} args - git arguments
 * @returns {string} git's stdout
 */
export function git(args) {
  return execFileSync('git', args, { cwd: PROJECT_DIR, encoding: 'utf8' });
}

/**
 * Files git reports as changed, with their status.
 * @returns {{ status: string, path: string, isNew: boolean }[]} changes; `isNew`: untracked or added
 */
export function changedFiles() {
  return git(['status', '--porcelain', '-uall'])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2);
      return { status, path: line.slice(3), isNew: status === '??' || status.includes('A') };
    });
}

/**
 * Per-session state that survives between hook runs (hooks are separate processes).
 * @param {string} name - hook name
 * @param {string} sessionId - id from the hook payload
 * @returns {{ read: () => object, write: (value: object) => void }} reader and writer of the stored object
 */
export function sessionMemory(name, sessionId) {
  const file = join(tmpdir(), `psl-hook-${name}-${sessionId}.json`);
  return {
    read: () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}),
    write: (value) => writeFileSync(file, JSON.stringify(value)),
  };
}

/**
 * Prints a PreToolUse decision (`allow` | `ask` | `deny`) and ends the hook.
 * @param {'allow' | 'ask' | 'deny'} decision - what to do with the tool call
 * @param {string} reason - shown to the user (and the model on deny)
 */
export function decide(decision, reason) {
  const output = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  };
  console.log(JSON.stringify(output));
  process.exit(0);
}

/**
 * Blocks a Stop / UserPromptSubmit event; `reason` goes to the model (Stop) or the user (prompt).
 * @param {string} reason - why the event is blocked
 */
export function block(reason) {
  console.log(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
}

/**
 * Hands text back to the model after a tool call (PostToolUse).
 * @param {string} text - the message for the model
 */
export function addContext(text) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } }));
  process.exit(0);
}

// PostToolUse (Edit|Write): format the touched src file with Prettier, then report ESLint errors back.
import { execFileSync } from 'node:child_process';
import { addContext, PROJECT_DIR, readInput, repoRelative } from './lib.mjs';

const CHECKED_FILE = /^src\/.*\.(js|svelte)$/;
const MAX_REPORT_LINES = 40;

const { tool_input: toolInput = {} } = readInput();
const path = repoRelative(toolInput.file_path);
if (!path || !CHECKED_FILE.test(path)) process.exit(0);

/**
 * Runs a locally installed CLI; returns its output when it exits non-zero, null when it succeeds.
 * @param {string} bin - name in node_modules/.bin
 * @param {string[]} args - CLI arguments
 * @returns {string | null} the tool's output on failure, null on success
 */
function failureOutput(bin, args) {
  try {
    execFileSync(`node_modules/.bin/${bin}`, args, { cwd: PROJECT_DIR, encoding: 'utf8', stdio: 'pipe' });
    return null;
  } catch (error) {
    return `${error.stdout ?? ''}${error.stderr ?? ''}` || String(error.message);
  }
}

const prettierFailure = failureOutput('prettier', ['--write', path]);
const eslintFailure = failureOutput('eslint', ['--quiet', path]);
const report = [prettierFailure && `prettier:\n${prettierFailure}`, eslintFailure && `eslint:\n${eslintFailure}`]
  .filter(Boolean)
  .join('\n');
if (report) addContext(`${path} needs attention:\n${report.split('\n').slice(0, MAX_REPORT_LINES).join('\n')}`);

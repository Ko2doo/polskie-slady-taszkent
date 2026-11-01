// Stop: before the agent hands control back,
//  1. a new src directory, or a new module in an area the harness maps (services, capacitor, state, screens),
//     must come with documentation (harness / rules / docs touched) — asked once per file;
//  2. the tests related to the changed src files must pass.
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { dirname } from 'node:path';
import { block, changedFiles, git, PROJECT_DIR, readInput, sessionMemory } from './lib.mjs';

const SOURCE_FILE = /^src\/.*\.(js|svelte)$/;
const TEST_FILE = /\.test\.js$/;
// Areas where one new file is a module worth a docs page; a component in a feature area is not
const DOCUMENTED_AREAS = /^src\/(services|capacitor|lib\/state|views)\//;
const DOC_PATHS = [/^harness\//, /^\.claude\/rules\//, /^docs\//];
const FAILURE_LINE = /FAIL|×|Error|Test Files|Tests /;
const MAX_REPORT_LINES = 30;
const TESTS_TIMEOUT_MS = 5 * 60 * 1000;

const input = readInput();
if (input.stop_hook_active) process.exit(0);

const memory = sessionMemory('stop', input.session_id);
const state = memory.read();
const changed = changedFiles();
const sources = changed.filter(({ path, status }) => SOURCE_FILE.test(path) && !status.includes('D'));

const modifiedAt = (path) => statSync(`${PROJECT_DIR}/${path}`).mtimeMs;
const newestDocChange = Math.max(
  0,
  ...changed
    .filter(({ path, status }) => DOC_PATHS.some((pattern) => pattern.test(path)) && !status.includes('D'))
    .map(({ path }) => modifiedAt(path)),
);
const isInNewDirectory = (path) => git(['ls-files', '--', dirname(path)]).trim() === '';
// A new file counts as documented once some doc page was written after it.
const undocumented = sources
  .filter(
    ({ path, isNew }) =>
      isNew &&
      !TEST_FILE.test(path) &&
      (DOCUMENTED_AREAS.test(path) || isInNewDirectory(path)) &&
      modifiedAt(path) > newestDocChange,
  )
  .map(({ path }) => path)
  .filter((path) => !state.reminded?.includes(path));

if (undocumented.length > 0) {
  memory.write({ ...state, reminded: [...(state.reminded ?? []), ...undocumented] });
  block(
    `New src modules without documentation changes: ${undocumented.join(', ')}. ` +
      'If they are a new directory, screen, service or state module, update the matching ' +
      'harness / .claude/rules / docs (ru + en) pages now; otherwise just stop.',
  );
}

// Re-run the tests only when a source file changed since the last passing run.
const signature = sources.map(({ path }) => `${path}:${modifiedAt(path)}`).join('|');
if (sources.length === 0 || signature === state.testedSignature) process.exit(0);

try {
  const files = sources.map(({ path }) => path);
  execFileSync('node_modules/.bin/vitest', ['related', '--run', '--passWithNoTests', ...files], {
    cwd: PROJECT_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: TESTS_TIMEOUT_MS,
  });
  memory.write({ ...memory.read(), testedSignature: signature });
} catch (error) {
  const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  const lines = output.split('\n').filter((line) => FAILURE_LINE.test(line));
  block(`Tests related to the changed files failed:\n${lines.slice(0, MAX_REPORT_LINES).join('\n')}`);
}

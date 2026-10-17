import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// harness/architecture.md: errorCodes.js is the only place a native-plugin error-code literal may
// appear; everything else imports ERROR_CODES. Locale files are exempt — their keys are named after
// the codes, they don't compare against them.
const SRC_DIR = 'src';
const ERROR_CODES_FILE = 'src/lib/errors/errorCodes.js';
const EXEMPT_DIRS = ['src/locales', 'src/test'];
const SOURCE_FILE = /\.(js|svelte)$/;
const TEST_FILE = /\.test\.js$/;
// A quoted string that contains a native code or its prefix: OS-PLUG-… or OS_PLUG_… — but not a
// constant reference inside a template string (`${ERROR_CODES.OS_PLUG_…}`, preceded by a dot)
const CODE_LITERAL = /(['"`])[^'"`\n]*(?<![.\w])OS[-_]PLUG[-_][^'"`\n]*\1/g;
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*)/;

/**
 * Finds the native error-code literals in a piece of source code, skipping comment lines.
 * @param {string} source
 * @returns {{ line: number, literal: string }[]}
 */
function findCodeLiterals(source) {
  return source.split('\n').flatMap((text, index) => {
    if (COMMENT_LINE.test(text)) return [];
    return [...text.matchAll(CODE_LITERAL)].map((match) => ({ line: index + 1, literal: match[0] }));
  });
}

function listSourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return EXEMPT_DIRS.includes(path) ? [] : listSourceFiles(path);
    return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name) ? [path] : [];
  });
}

describe('native error-code literals', () => {
  it('appear only in lib/errors/errorCodes.js', () => {
    const offenders = listSourceFiles(SRC_DIR)
      .filter((path) => path !== ERROR_CODES_FILE)
      .flatMap((path) =>
        findCodeLiterals(readFileSync(path, 'utf8')).map(({ line, literal }) => `${path}:${line} ${literal}`),
      );

    expect(offenders).toEqual([]);
  });

  it('are present in errorCodes.js itself, so the scan is not vacuous', () => {
    expect(findCodeLiterals(readFileSync(ERROR_CODES_FILE, 'utf8')).length).toBeGreaterThan(0);
  });
});

describe('findCodeLiterals', () => {
  it('finds hyphenated and underscored codes and prefixes in any quote style', () => {
    const source = [
      `if (code === 'OS-PLUG-FILE-0008') {}`,
      `t("errors:OS_PLUG_GLOC_0003");`,
      'code.startsWith(`OS_PLUG_GLOC_`);',
    ].join('\n');

    expect(findCodeLiterals(source)).toEqual([
      { line: 1, literal: `'OS-PLUG-FILE-0008'` },
      { line: 2, literal: `"errors:OS_PLUG_GLOC_0003"` },
      { line: 3, literal: '`OS_PLUG_GLOC_`' },
    ]);
  });

  it('ignores comments and constant references', () => {
    const source = [
      `// matches 'OS-PLUG-GLOC-0007' from the plugin`,
      ` * \`OS_PLUG_GLOC_0003\` in JSDoc`,
      `if (code === ERROR_CODES.OS_PLUG_GLOC_0010) {}`,
      't(`errors:${ERROR_CODES.OS_PLUG_GLOC_0003}`);',
    ].join('\n');

    expect(findCodeLiterals(source)).toEqual([]);
  });
});

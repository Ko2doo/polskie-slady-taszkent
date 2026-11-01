import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The developer docs ship in two languages that must stay the same document: docs/ru is written
// first, docs/en is its translation (.claude/rules/maintaining-this-harness.md → "Developer docs").
// Only prose and code comments are translated, so the file set, the heading levels and the code
// of every example must match. Untagged fenced blocks are diagrams and file trees whose text is
// translated: only their number is compared.
const DOCS_DIR = 'docs';
const PRIMARY = 'ru';
const TRANSLATION = 'en';

const FENCED_BLOCK = /^```(\w*)\n([\s\S]*?)^```$/gm;
const HEADING = /^(#{1,6}) /;
const LINE_COMMENT = /(^|\s)\/\/.*$/; // `//` after a space or at the start, so a url's `://` stays
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const SHELL_COMMENT = /(^|\s)#.*$/;
const SHELL_LANGUAGES = new Set(['bash', 'sh']);

function listMarkdown(dir, prefix = '') {
  return readdirSync(join(dir, prefix), { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(prefix, entry.name);
      if (entry.isDirectory()) return listMarkdown(dir, path);
      return entry.name.endsWith('.md') ? [path] : [];
    })
    .sort();
}

function withoutComments(code, language) {
  return code
    .replace(HTML_COMMENT, '')
    .split('\n')
    .map((line) => line.replace(LINE_COMMENT, ''))
    .map((line) => (SHELL_LANGUAGES.has(language) ? line.replace(SHELL_COMMENT, '') : line))
    .map((line) => line.trimEnd())
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * What a docs page and its translation must share: the heading levels in order, the tagged code
 * examples without their comments, and how many untagged blocks (diagrams) there are.
 * @param {string} markdown
 * @returns {{ headings: number[], examples: Array<{ language: string, code: string }>, diagrams: number }}
 */
function structureOf(markdown) {
  const examples = [];
  let diagrams = 0;

  for (const [, language, code] of markdown.matchAll(FENCED_BLOCK)) {
    if (language) examples.push({ language, code: withoutComments(code, language) });
    else diagrams += 1;
  }

  const headings = markdown
    .replace(FENCED_BLOCK, '')
    .split('\n')
    .map((line) => HEADING.exec(line)?.[1].length)
    .filter(Boolean);

  return { headings, examples, diagrams };
}

const primaryDir = join(DOCS_DIR, PRIMARY);
const translationDir = join(DOCS_DIR, TRANSLATION);
const primaryFiles = listMarkdown(primaryDir);

describe('developer docs: docs/en is the same document as docs/ru', () => {
  it('has exactly the same files', () => {
    expect(listMarkdown(translationDir)).toEqual(primaryFiles);
  });

  it.each(primaryFiles)('%s: same heading levels, same example code, same number of diagrams', (file) => {
    const primary = structureOf(readFileSync(join(primaryDir, file), 'utf8'));
    const translation = structureOf(readFileSync(join(translationDir, file), 'utf8'));

    expect(translation.headings, 'heading levels').toEqual(primary.headings);
    expect(translation.diagrams, 'untagged blocks').toBe(primary.diagrams);
    expect(translation.examples, 'code examples without comments').toEqual(primary.examples);
  });
});

describe('structureOf', () => {
  it('ignores translated comments but not a changed line of code', () => {
    const ru = '# Заголовок\n\n```js\n// комментарий\nconst a = 1; // пояснение\n```\n';
    const en = '# Title\n\n```js\n// a comment\nconst a = 1; // explanation\n```\n';
    const changed = '# Title\n\n```js\nconst a = 2;\n```\n';

    expect(structureOf(en)).toEqual(structureOf(ru));
    expect(structureOf(changed)).not.toEqual(structureOf(ru));
  });

  it('keeps a url in code and strips shell comments only in shell blocks', () => {
    const markdown = "```js\nfetch('https://example.org'); # not a comment in js\n```\n```bash\nnpm test # run\n```\n";

    expect(structureOf(markdown).examples).toEqual([
      { language: 'js', code: "fetch('https://example.org'); # not a comment in js" },
      { language: 'bash', code: 'npm test' },
    ]);
  });

  it('does not count a # line inside a code block as a heading', () => {
    expect(structureOf('## Real\n\n```bash\n# a comment\n```\n').headings).toEqual([2]);
  });
});

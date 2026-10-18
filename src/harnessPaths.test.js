import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';

// The agent docs (CLAUDE.md, harness/, .claude/rules/, AGENTS.md, CONTRIBUTING.md) name files by
// path in `inline code`; a renamed or deleted file must not leave them pointing at nothing. The
// directory trees are checked separately (architectureTree/repositoryTree tests) — this covers the
// prose. A path counts as present if some file in the working tree (minus git-ignored ones) is or
// ends with it, if it's a package file under node_modules/, or if it's git-ignored (generated).
const trackedFiles = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter((path) => path && existsSync(path));

const DOC_FILE = /^(CLAUDE\.md|AGENTS\.md|CONTRIBUTING\.md|harness\/.+\.md|\.claude\/rules\/.+\.md)$/;
const FENCED_BLOCK = /```[\s\S]*?```/g;
const INLINE_CODE = /`([^`\n]+)`/g;
// Something shaped like a path: a directory (`trailing/`) or a file with a known extension.
// Globs, placeholders and anything with spaces (`views/Map/MapNavigation*`, `<articleId>.webp`) don't
// match and aren't checked.
const PATH_LIKE =
  /^[\w@.\-/]+(\/|\.(js|mjs|svelte|css|json|md|yml|html|py|gradle|plist|xml|png|txt|pbxproj|webp|ttf|geojson))$/;
// A bare extension (`.svelte.js`) names a kind of file, not a file.
const BARE_EXTENSION = /^\.[^/]+$/;
// Mentioned on purpose although they don't exist in the working tree.
const NOT_FILES = new Set([
  'feature/', // contributor branch prefixes, harness/git-workflow.md
  'fix/',
  'public/map/styles/', // the output folder of an unused script, documented as missing
  'BUGS.md', // the bug log, created only while a bug is open (harness/testing.md → "Bug log")
]);

function isGitIgnored(path) {
  try {
    execFileSync('git', ['check-ignore', '-q', '--no-index', path]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether a path named in the docs exists: as written from the repo root, as a suffix of a real
 * path (`services/navigation.js`, `customPointsStorage.js`), as a package file, or as a generated one.
 * @param {string} path
 * @returns {boolean}
 */
function isPresent(path) {
  const inWorkingTree = trackedFiles.some(
    (file) => file === path || file.endsWith(`/${path}`) || (path.endsWith('/') && `/${file}`.includes(`/${path}`)),
  );
  return inWorkingTree || existsSync(`node_modules/${path}`) || isGitIgnored(path) || isGitIgnored(`src/${path}`);
}

/**
 * The path-like inline-code spans of a markdown document, fenced blocks left out.
 * @param {string} markdown
 * @returns {string[]}
 */
function findMentionedPaths(markdown) {
  const prose = markdown.replace(FENCED_BLOCK, '');
  return [...prose.matchAll(INLINE_CODE)]
    .map(([, span]) => span.replace(/^\.\//, ''))
    .filter((span) => PATH_LIKE.test(span) && !BARE_EXTENSION.test(span) && !NOT_FILES.has(span));
}

const docFiles = trackedFiles.filter((path) => DOC_FILE.test(path));
const ruleFiles = docFiles.filter((path) => path.startsWith('.claude/rules/'));
const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;
const LIST_ITEM = /^\s*-\s*"(.+)"\s*$/;
const IMPORT_LINE = /^@(\S+)$/gm;

/**
 * The `paths:` globs of a `.claude/rules/` file's frontmatter (a YAML list of quoted strings,
 * the only shape the harness uses).
 * @param {string} markdown
 * @returns {string[]} empty when there is no frontmatter or no `paths:` list
 */
function readRulePaths(markdown) {
  const frontmatter = FRONTMATTER.exec(markdown);
  if (!frontmatter) return [];
  const [first, ...rest] = frontmatter[1].split('\n');
  if (first.trim() !== 'paths:') return [];
  return rest.map((line) => LIST_ITEM.exec(line)?.[1]).filter(Boolean);
}

describe('paths named in the agent docs', () => {
  it('exist', () => {
    const missing = docFiles.flatMap((doc) =>
      findMentionedPaths(readFileSync(doc, 'utf8'))
        .filter((path) => !isPresent(path))
        .map((path) => `${doc}: ${path}`),
    );

    expect(missing).toEqual([]);
  });

  it('are found in the docs at all, so the check is not vacuous', () => {
    expect(docFiles).toContain('CLAUDE.md');
    expect(findMentionedPaths(readFileSync('CLAUDE.md', 'utf8')).length).toBeGreaterThan(0);
  });
});

describe('path-scoped rules in .claude/rules/', () => {
  it('exist, so the checks below are not vacuous', () => {
    expect(ruleFiles.length).toBeGreaterThan(0);
  });

  it('each declare a paths: list — without one a rule would load in every session', () => {
    const unscoped = ruleFiles.filter((path) => readRulePaths(readFileSync(path, 'utf8')).length === 0);

    expect(unscoped).toEqual([]);
  });

  it('only use globs that match at least one file — otherwise the rule never loads for it', () => {
    const deadGlobs = ruleFiles.flatMap((rule) =>
      readRulePaths(readFileSync(rule, 'utf8'))
        .filter((glob) => !trackedFiles.some((file) => matchesGlob(file, glob)))
        .map((glob) => `${rule}: ${glob}`),
    );

    expect(deadGlobs).toEqual([]);
  });
});

describe('harness/ files', () => {
  it('are each imported by CLAUDE.md, and every import exists', () => {
    const imports = [...readFileSync('CLAUDE.md', 'utf8').matchAll(IMPORT_LINE)].map(([, path]) => path);
    const harnessFiles = trackedFiles.filter((path) => /^harness\/.+\.md$/.test(path));

    expect(harnessFiles.filter((path) => !imports.includes(path))).toEqual([]);
    expect(imports.filter((path) => !existsSync(path))).toEqual([]);
  });
});

describe('readRulePaths', () => {
  it('reads the quoted globs of a paths: list', () => {
    const markdown = ['---', 'paths:', '  - "src/**/*.svelte"', '  - "package.json"', '---', '', '# Rule'].join('\n');

    expect(readRulePaths(markdown)).toEqual(['src/**/*.svelte', 'package.json']);
  });

  it('returns nothing without frontmatter or without paths:', () => {
    expect(readRulePaths('# Rule\n')).toEqual([]);
    expect(readRulePaths('---\ndescription: x\n---\n# Rule\n')).toEqual([]);
  });
});

describe('findMentionedPaths', () => {
  it('picks files and directories from inline code', () => {
    const markdown = 'See `src/App.svelte`, `harness/` and `./vite.config.js`.';

    expect(findMentionedPaths(markdown)).toEqual(['src/App.svelte', 'harness/', 'vite.config.js']);
  });

  it('skips fenced blocks, globs, placeholders, bare extensions and identifiers', () => {
    const markdown = [
      '```',
      '`src/inside-a-fence.js`',
      '```',
      '`views/Map/MapNavigation*.svelte.js` `<articleId>.webp` `.svelte.js` `createToggle()` `npm test`',
    ].join('\n');

    expect(findMentionedPaths(markdown)).toEqual([]);
  });
});

describe('isPresent', () => {
  it('accepts a full path, a path suffix, a package file and a generated file', () => {
    expect(isPresent('src/main.js')).toBe(true);
    expect(isPresent('services/navigation.js')).toBe(true);
    expect(isPresent('customPointsStorage.js')).toBe(true);
    expect(isPresent('lib/state/')).toBe(true);
    expect(isPresent('konsta/svelte/theme.css')).toBe(true);
    expect(isPresent('dist/index.html')).toBe(true);
  });

  it('rejects a path that is nowhere', () => {
    expect(isPresent('services/doesNotExist.js')).toBe(false);
    expect(isPresent('nowhere/')).toBe(false);
  });
});

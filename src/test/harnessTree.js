import { readFileSync } from 'node:fs';

// The harness describes directory layouts as `tree`-style blocks (harness/architecture.md for src/,
// .claude/rules/repository-layout.md for the repo root); these helpers read them back for the tests that
// keep them in sync with the real directories.
const INDENT_WIDTH = 4; // "│   " or "    " per tree level
const TREE_ENTRY = /^((?:│ {3}| {4})*)(?:├── |└── )(\S+)/;
const BRACE_GROUP = /^\{(.+)\}\/$/;

/**
 * Reads the first fenced block that follows `heading` in a markdown file.
 * @param {string} docPath - path from the repo root, e.g. 'harness/architecture.md'
 * @param {string} heading - the exact heading line, e.g. '### The tree'
 * @returns {string[]} the block's lines, without the fences
 * @throws {Error} when the heading is missing, so a renamed heading can't make a test pass vacuously
 */
export function readTreeBlock(docPath, heading) {
  const markdown = readFileSync(docPath, 'utf8');
  const headingIndex = markdown.indexOf(heading);
  if (headingIndex === -1) throw new Error(`${docPath}: heading "${heading}" not found`);

  const [, block] = markdown.slice(headingIndex).split('```');
  return block.split('\n');
}

/**
 * Turns tree lines into the entries they list, with paths relative to the tree's root line.
 * A name ending in `/` is a directory; `{a,b}/` expands to sibling directories `a/` and `b/`.
 * Lines that aren't entries (the root line, `#` comment continuations) are skipped.
 * @param {string[]} lines
 * @returns {{ path: string, isDirectory: boolean }[]}
 * @example
 * parseTree(['src/', '├── main.js  # boot', '└── lib/', '    └── {icons,state}/']);
 * // → [{ path: 'main.js', isDirectory: false }, { path: 'lib', isDirectory: true },
 * //    { path: 'lib/icons', isDirectory: true }, { path: 'lib/state', isDirectory: true }]
 */
export function parseTree(lines) {
  const entries = [];
  const parents = [];

  for (const line of lines) {
    const match = TREE_ENTRY.exec(line);
    if (!match) continue;

    const depth = match[1].length / INDENT_WIDTH;
    const name = match[2];
    parents.length = depth;

    if (!name.endsWith('/')) {
      entries.push({ path: [...parents, name].join('/'), isDirectory: false });
      continue;
    }

    const group = BRACE_GROUP.exec(name);
    const names = group ? group[1].split(',') : [name.slice(0, -1)];
    for (const dirName of names) {
      entries.push({ path: [...parents, dirName].join('/'), isDirectory: true });
    }
    // A brace group is a leaf in the tree, so which of its names becomes the parent doesn't matter.
    parents.push(names[0]);
  }

  return entries;
}

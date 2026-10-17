import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseTree, readTreeBlock } from '@/test/harnessTree';

// harness/architecture.md describes src/ as a tree; this keeps that tree from silently going stale.
const SRC_DIR = 'src';

/**
 * Lists every directory under `root`, recursively, relative to it.
 * @param {string} root
 * @param {string} [prefix]
 * @returns {string[]}
 */
function listDirectories(root, prefix = '') {
  const entries = readdirSync(join(root, prefix), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      return [path, ...listDirectories(root, path)];
    });
}

function listRootAppFiles(root) {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.endsWith('.test.js'))
    .map((entry) => entry.name);
}

describe('the src/ tree in harness/architecture.md', () => {
  const entries = parseTree(readTreeBlock('harness/architecture.md', '### The tree'));
  const directories = entries.filter((entry) => entry.isDirectory).map((entry) => entry.path);
  const rootFiles = entries.filter((entry) => !entry.isDirectory && !entry.path.includes('/'));

  it('lists exactly the directories that exist in src/', () => {
    expect(directories.sort()).toEqual(listDirectories(SRC_DIR).sort());
  });

  it('lists exactly the app files at the root of src/', () => {
    expect(rootFiles.map((entry) => entry.path).sort()).toEqual(listRootAppFiles(SRC_DIR).sort());
  });
});

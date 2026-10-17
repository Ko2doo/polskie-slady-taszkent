import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { parseTree, readTreeBlock } from '@/test/harnessTree';

// harness/repository-layout.md describes the repo root as a tree; this keeps that tree from
// silently going stale. It compares against git, not the disk, so ignored local folders
// (node_modules/, dist/, coverage/) don't count.
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);

/**
 * The names directly inside `dir` ('' for the root) among tracked files.
 * @param {string} dir
 * @returns {{ directories: string[], files: string[] }}
 */
function listTrackedChildren(dir) {
  const prefix = dir ? `${dir}/` : '';
  const directories = new Set();
  const files = new Set();

  for (const path of trackedFiles) {
    if (!path.startsWith(prefix)) continue;
    const [name, ...rest] = path.slice(prefix.length).split('/');
    if (rest.length > 0) directories.add(name);
    else files.add(name);
  }

  return { directories: [...directories].sort(), files: [...files].sort() };
}

function parentOf(path) {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
}

function nameOf(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

describe('the repo root tree in harness/repository-layout.md', () => {
  const entries = parseTree(readTreeBlock('harness/repository-layout.md', '## The tree'));
  const childrenOf = (dir, isDirectory) =>
    entries
      .filter((entry) => entry.isDirectory === isDirectory && parentOf(entry.path) === dir)
      .map((entry) => nameOf(entry.path))
      .sort();

  it('lists exactly the tracked directories and files at the root', () => {
    const tracked = listTrackedChildren('');

    expect(childrenOf('', true)).toEqual(tracked.directories);
    expect(childrenOf('', false)).toEqual(tracked.files);
  });

  it('lists every subdirectory of each directory it expands', () => {
    const expanded = [...new Set(entries.filter((entry) => entry.path.includes('/')).map((e) => parentOf(e.path)))];

    for (const dir of expanded) {
      expect(childrenOf(dir, true), dir).toEqual(listTrackedChildren(dir).directories);
    }
  });

  it('lists only files that are tracked', () => {
    const listedFiles = entries.filter((entry) => !entry.isDirectory).map((entry) => entry.path);

    expect(listedFiles.filter((path) => !trackedFiles.includes(path))).toEqual([]);
  });
});

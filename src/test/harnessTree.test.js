import { describe, it, expect } from 'vitest';
import { parseTree, readTreeBlock } from '@/test/harnessTree';

describe('parseTree', () => {
  it('nests entries by indentation and expands brace groups', () => {
    const lines = [
      'src/',
      '├── main.js          # comment',
      '├── lib/',
      '│   └── state/',
      '├── locales/',
      '│   └── {en,ru}/',
      '└── views/',
      '    ├── Map/',
      '    └── index.js',
    ];

    expect(parseTree(lines)).toEqual([
      { path: 'main.js', isDirectory: false },
      { path: 'lib', isDirectory: true },
      { path: 'lib/state', isDirectory: true },
      { path: 'locales', isDirectory: true },
      { path: 'locales/en', isDirectory: true },
      { path: 'locales/ru', isDirectory: true },
      { path: 'views', isDirectory: true },
      { path: 'views/Map', isDirectory: true },
      { path: 'views/index.js', isDirectory: false },
    ]);
  });

  it('skips the root line and comment continuation lines', () => {
    expect(parseTree(['src/', '├── App.svelte  # shell', '│                #   more'])).toEqual([
      { path: 'App.svelte', isDirectory: false },
    ]);
  });
});

describe('readTreeBlock', () => {
  it('throws when the heading is missing', () => {
    expect(() => readTreeBlock('harness/architecture.md', '### No such heading')).toThrow(/not found/);
  });
});

import { describe, it, expect } from 'vitest';
import resources from '@/locales/resources';

// harness/i18n.md: every locale has the same keys as ru (the primary language), with the same
// {{placeholders}} and the same inline HTML markup. A key missing in one locale silently falls
// back to English at runtime, so nothing else would catch it.
const REFERENCE_LANGUAGE = 'ru';
const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;
const HTML_TAG = /<\/?([a-zA-Z][\w-]*)/g;
// Line breaks only split prose into paragraphs, and a translation may split it differently.
const IGNORED_TAGS = new Set(['br']);

/**
 * Flattens a nested translation object into `path → value` pairs (arrays index like objects).
 * @param {object} node
 * @param {string} [prefix]
 * @returns {Map<string, unknown>} only leaves (non-object values) are included
 */
function flatten(node, prefix = '') {
  const leaves = new Map();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object') {
      for (const [leafPath, leaf] of flatten(value, path)) leaves.set(leafPath, leaf);
    } else {
      leaves.set(path, value);
    }
  }
  return leaves;
}

function matchesOf(text, pattern) {
  return [...String(text).matchAll(pattern)].map((match) => match[1]);
}

function markupOf(text) {
  return matchesOf(text, HTML_TAG)
    .filter((tag) => !IGNORED_TAGS.has(tag.toLowerCase()))
    .join(',');
}

/**
 * Lists every difference between one language's namespace and the reference one.
 * @param {Map<string, unknown>} reference
 * @param {Map<string, unknown>} translation
 * @returns {string[]} human-readable problems, empty when the two are in step
 */
function compareNamespace(reference, translation) {
  const problems = [];

  for (const [path, referenceValue] of reference) {
    if (!translation.has(path)) {
      problems.push(`missing: ${path}`);
      continue;
    }
    const value = translation.get(path);
    if (typeof value !== typeof referenceValue) {
      problems.push(`type: ${path} is ${typeof value}, expected ${typeof referenceValue}`);
      continue;
    }

    const placeholders = matchesOf(value, PLACEHOLDER).sort().join(',');
    const referencePlaceholders = matchesOf(referenceValue, PLACEHOLDER).sort().join(',');
    if (placeholders !== referencePlaceholders) {
      problems.push(`placeholders: ${path} has {${placeholders}}, expected {${referencePlaceholders}}`);
    }

    const tags = markupOf(value);
    const referenceTags = markupOf(referenceValue);
    if (tags !== referenceTags) {
      problems.push(`markup: ${path} has <${tags}>, expected <${referenceTags}>`);
    }
  }

  for (const path of translation.keys()) {
    if (!reference.has(path)) problems.push(`extra: ${path}`);
  }

  return problems;
}

describe('locale parity', () => {
  const reference = resources[REFERENCE_LANGUAGE];
  const otherLanguages = Object.keys(resources).filter((language) => language !== REFERENCE_LANGUAGE);

  it.each(otherLanguages)('%s has the same namespaces as ru', (language) => {
    expect(Object.keys(resources[language]).sort()).toEqual(Object.keys(reference).sort());
  });

  describe.each(Object.keys(reference))('namespace %s', (namespace) => {
    it.each(otherLanguages)('%s matches ru: keys, placeholders, markup', (language) => {
      const translation = resources[language][namespace] ?? {};
      expect(compareNamespace(flatten(reference[namespace]), flatten(translation))).toEqual([]);
    });
  });
});

describe('compareNamespace', () => {
  const reference = flatten({ a: 'A {{count}}', b: { c: '<b>C</b>' }, list: ['x', 'y'] });

  it('reports nothing for a translation in step', () => {
    const translation = flatten({ a: 'А {{count}}', b: { c: '<b>Ц</b><br><br>' }, list: ['х', 'у'] });
    expect(compareNamespace(reference, translation)).toEqual([]);
  });

  it('reports missing, extra, placeholder, markup and type differences', () => {
    const translation = flatten({ a: 'А {{max}}', b: { c: 'Ц' }, list: ['х'], extra: 'E' });

    expect(compareNamespace(reference, translation)).toEqual([
      'placeholders: a has {max}, expected {count}',
      'markup: b.c has <>, expected <b,b>',
      'missing: list.1',
      'extra: extra',
    ]);
  });

  it('reports a value of a different type', () => {
    expect(compareNamespace(flatten({ a: 1 }), flatten({ a: 'one' }))).toEqual([
      'type: a is string, expected number',
    ]);
  });
});

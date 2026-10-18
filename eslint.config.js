import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import jsdoc from 'eslint-plugin-jsdoc';
import vitest from '@vitest/eslint-plugin';
import prettier from 'eslint-config-prettier';
import svelteConfig from './svelte.config.js';

// Each rule below enforces a rule of the harness (harness/code-style.md unless noted); formatting
// is Prettier's job, so eslint-config-prettier switches off every stylistic rule at the end.

const SVELTE_FILES = ['**/*.svelte', '**/*.svelte.js', '**/*.svelte.test.js'];
const TEST_FILES = ['src/**/*.test.js', 'src/test/**'];
const NODE_FILES = ['*.config.js'];
// `export function f`, `export class C`, `export const f = () => …` — the exported unit itself,
// not every function nested in an exported object
const EXPORTED_FUNCTIONS_AND_CLASSES = {
  publicOnly: true,
  require: { FunctionDeclaration: true, ClassDeclaration: true },
  contexts: ['VariableDeclarator > ArrowFunctionExpression'],
};
// Compile-time globals defined in vite.config.js
const BUILD_GLOBALS = { __APP_VERSION__: 'readonly', __APP_NAME__: 'readonly' };

export default defineConfig([
  // Dependencies, generated, native or hands-off (harness: .claude/rules/repository-layout.md);
  // ESLint skips node_modules/ on its own — listed anyway so the intent is visible
  globalIgnores([
    'node_modules/',
    'dist/',
    'coverage/',
    'public/',
    'android/',
    'ios/',
    'scripts/',
    'appstore/',
    'resources/',
    'Banners/',
  ]),

  js.configs.recommended,
  svelte.configs.recommended,
  jsdoc.configs['flat/recommended'],

  {
    languageOptions: {
      globals: { ...globals.browser, ...BUILD_GLOBALS },
    },
    rules: {
      // Logging: the project logger only (utils/debugMode.js), never console.* directly
      'no-console': 'error',
      // No dead code: unused variables, imports and parameters (a leading `_` marks a parameter
      // that must exist for its position)
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'smart'],

      // JSDoc is mandatory on every exported function (and class); its contents are checked
      // too, but as warnings — the types are documentation, not enforced (jsconfig checkJs: false)
      'jsdoc/require-jsdoc': ['error', EXPORTED_FUNCTIONS_AND_CLASSES],
      // The project's own JSDoc conventions, which these would only churn: `{Object}`,
      // `{Function}`, `{*}`, `[name=default]`, library types like `maplibregl.Map`, no blank line
      // before the tags
      'jsdoc/check-types': 'off',
      'jsdoc/reject-function-type': 'off',
      'jsdoc/reject-any-type': 'off',
      'jsdoc/no-defaults': 'off',
      'jsdoc/no-undefined-types': 'off',
      'jsdoc/tag-lines': 'off',
    },
  },

  {
    files: SVELTE_FILES,
    languageOptions: {
      parserOptions: { svelteConfig },
    },
    rules: {
      // `let { a, b = $bindable() } = $props()` is the idiom; the Svelte variant knows the runes
      'prefer-const': 'off',
      'svelte/prefer-const': 'error',
    },
  },

  {
    files: ['src/utils/debugMode.js'],
    rules: {
      // The logger itself is the one place that calls console.*
      'no-console': 'off',
    },
  },

  {
    files: NODE_FILES,
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: TEST_FILES,
    ...vitest.configs.recommended,
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      ...vitest.configs.recommended.rules,
      // Vitest takes a failure message as the second argument: expect(value, 'message')
      'vitest/valid-expect': ['error', { maxArgs: 2 }],
      // JSDoc is for app code; a test helper documents itself where it's shared (src/test/)
      'jsdoc/require-jsdoc': 'off',
    },
  },

  {
    // Svelte compiles these test files (vitest.config.js), but the ESLint parser only treats
    // `.svelte.js` as a runes module, so the runes are declared here
    files: ['**/*.svelte.test.js'],
    languageOptions: {
      globals: {
        $state: 'readonly',
        $derived: 'readonly',
        $effect: 'readonly',
        $props: 'readonly',
        $bindable: 'readonly',
        $inspect: 'readonly',
      },
    },
  },

  {
    files: ['src/test/**'],
    rules: {
      'jsdoc/require-jsdoc': ['warn', EXPORTED_FUNCTIONS_AND_CLASSES],
    },
  },

  // Last: turns off everything that would fight Prettier, Svelte rules included
  prettier,
  svelte.configs.prettier,
]);

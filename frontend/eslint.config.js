import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

// Starting point for a codebase with no prior lint history: error on patterns
// that are almost always real bugs (undefined vars, broken hooks usage),
// warn on hygiene (unused vars, console) so CI can pass today without a mass
// cleanup PR. Tighten rules to "error" incrementally per file as they're
// touched, rather than fixing 79k lines in one pass.
export default [
  {
    ignores: ['node_modules/**', 'dist/**', 'android/**', 'ios/**', 'build/**']
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      'no-undef': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-fallthrough': 'error',
      'no-unreachable': 'error',
      'no-const-assign': 'error',
      'no-unsafe-negation': 'error',
      'valid-typeof': 'error',
      // Real-bug class: stale closures, missing deps, hooks called conditionally.
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': [
        'warn',
        { args: 'none', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'react-refresh/only-export-components': 'off'
    }
  }
];

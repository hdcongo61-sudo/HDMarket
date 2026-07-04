import globals from 'globals';

// Starting point for a codebase with no prior lint history: error on patterns
// that are almost always real bugs (undefined vars, duplicate keys, broken
// case blocks), warn on hygiene (unused vars, console) so CI can pass today
// without a mass cleanup PR. Tighten rules to "error" incrementally per file
// as they're touched, rather than fixing 189k lines in one pass.
export default [
  {
    ignores: ['node_modules/**', 'seed/**/*.json', 'uploads/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
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
      'no-unused-vars': [
        'warn',
        { args: 'none', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ],
      // Warn (not error) — flags where console.* should become structured
      // logging/Sentry calls without blocking CI on the existing 40+ call sites.
      'no-console': ['warn', { allow: ['error', 'warn'] }]
    }
  }
];

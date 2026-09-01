// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'dist-check/*', 'node_modules/*', '.expo/*'],
  },
  {
    // Setup and maintenance scripts run under Node, not in the app bundle, so
    // they get Node's globals rather than the client's.
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
  {
    // Jest globals are injected by the runner, not imported.
    files: ['jest.setup.js', '**/*.test.ts', '**/*.test.tsx'],
    languageOptions: {
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        it: 'readonly',
        jest: 'readonly',
      },
    },
  },
]);

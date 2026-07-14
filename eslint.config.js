// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const reactHooksPlugin = require('eslint-plugin-react-hooks');
const typescriptEslintPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = defineConfig([
  {
    ignores: ['.expo/**', '.yalc/**', 'dist/**', 'build/**', 'node_modules/**'],
  },
  expoConfig,
  {
    plugins: {
      '@typescript-eslint': typescriptEslintPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: {
      'import/core-modules': ['react-native-ios-context-menu'],
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Reanimated shared values and Animated refs intentionally use mutable values that these
      // compiler rules currently treat as regular React state.
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'error',
      'react-hooks/refs': 'off',
      // Several state machines intentionally synchronize external media and navigation state.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'error',
    },
  },
]);

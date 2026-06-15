// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: ['.expo/**', '.yalc/**', 'dist/**', 'build/**', 'node_modules/**'],
  },
  expoConfig,
  {
    settings: {
      'import/core-modules': ['react-native-ios-context-menu'],
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      // SDK 56 enables stricter React Compiler lint rules through eslint-config-expo.
      // Keep the upgrade focused; migrate these patterns in a dedicated refactor.
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
    },
  },
]);

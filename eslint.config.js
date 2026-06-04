// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: ['.expo/**', '.yalc/**', 'dist/**', 'build/**', 'node_modules/**'],
  },
  expoConfig,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]);

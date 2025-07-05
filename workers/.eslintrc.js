module.exports = {
  env: {
    browser: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/explicit-function-return-type': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'no-unused-vars': 'off',
  },
  globals: {
    Request: 'readonly',
    Response: 'readonly',
    Headers: 'readonly',
    FormData: 'readonly',
    File: 'readonly',
    Blob: 'readonly',
    ReadableStream: 'readonly',
    TextEncoder: 'readonly',
    TextDecoder: 'readonly',
    crypto: 'readonly',
    console: 'readonly',
    R2Bucket: 'readonly',
    D1Database: 'readonly',
  },
};
import globals from 'globals';
import tseslint from 'typescript-eslint';
import importX from 'eslint-plugin-import-x';
import eslintPluginPromise from 'eslint-plugin-promise';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';

// Configuración base: TypeScript + reglas generales (sin React ni específicas de server)
export const base = tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/.agents/**',
      '**/.idea/**',
      '**/.vscode/**',
      'apps/*/dist',
      'packages/*/dist',
      'apps/api/src/infrastructure/adapters/database/generated/',
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      'import-x': importX,
      promise: eslintPluginPromise,
      unicorn: eslintPluginUnicorn,
    },
    languageOptions: {
      globals: { ...globals.node, ...globals.browser, ...globals.es2020 },
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'import-x/no-unresolved': 'off',
      'import-x/order': [
        'error',
        {
          'newlines-between': 'always',
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        },
      ],
      'import-x/no-duplicates': 'error',
      'promise/always-return': 'error',
      'promise/catch-or-return': 'error',
      'unicorn/prefer-node-protocol': 'error',
      'unicorn/no-array-for-each': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);

// Configuración específica para React (frontend)
export const reactConfig = {
  plugins: {
    react,
    'react-hooks': reactHooks,
    'jsx-a11y': jsxA11y,
  },
  settings: {
    react: { version: 'detect' },
  },
  languageOptions: {
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
    globals: { ...globals.browser, ...globals.es2020 },
  },
  rules: {
    ...react.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    ...jsxA11y.configs.recommended.rules,
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    'react/jsx-no-leaked-render': ['error', { validStrategies: ['ternary'] }],
  },
};

// Configuración específica para servidor Node.js (backend)
export const server = [
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2020,
      },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    files: ['**/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/application/*', '@/infrastructure/*'],
              message:
                'Violación de Arquitectura Hexagonal: El Dominio no puede importar de Aplicación o Infraestructura.',
            },
            {
              group: [
                '../application/*',
                '../../application/*',
                '../infrastructure/*',
                '../../infrastructure/*',
              ],
              message:
                'Violación de Arquitectura Hexagonal: No se permiten imports relativos hacia capas superiores.',
            },
          ],
        },
      ],
    },
  },
];

// Default export: base config (para retrocompatibilidad)
export default base;

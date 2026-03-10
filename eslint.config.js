import eslintConfigPrettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import baseConfig from '@pixel-mentor/eslint-config-custom';
import reactConfig from '@pixel-mentor/eslint-config-custom/react';
import serverConfig from '@pixel-mentor/eslint-config-custom/server';

export default [
  ...baseConfig,

  {
    files: ['apps/web/**/*.ts', 'apps/web/**/*.tsx', 'packages/ui/**/*.ts', 'packages/ui/**/*.tsx'],
    ...reactConfig[reactConfig.length - 1],
  },

  {
    files: ['apps/api/**/*.ts'],
    ...serverConfig[serverConfig.length - 1],
  },
  {
    files: ['apps/api/**/*.ts'],
    ...serverConfig[serverConfig.length - 2],
  },

  {
    files: ['**/*.{spec,test}.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'import/no-extraneous-dependencies': 'off',
      'no-restricted-imports': 'off',
    },
  },

  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'error',
    },
  },
  eslintConfigPrettier,
];

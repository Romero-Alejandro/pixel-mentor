import eslintConfigPrettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import { base, reactConfig, server } from '@pixel-mentor/eslint-config-custom';

export default [
  // Base TypeScript rules for entire monorepo
  ...base,

  // React/Next.js frontend applications
  {
    files: [
      'apps/web/**/*.{ts,tsx}',
      'apps/web/**/*.{js,jsx}',
      'packages/ui/**/*.{ts,tsx}',
      'packages/ui/**/*.{js,jsx}',
    ],
    ...reactConfig,
  },

  // Backend Node.js API
  // server is an array of configs; we apply each with files restricted to api/
  ...server.map((conf) => ({
    files: ['apps/api/**/*.ts'],
    ...conf,
  })),

  // Test files: relax rules
  {
    files: ['**/*.{spec,test}.{ts,tsx}'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'import/no-extraneous-dependencies': 'off',
      'no-restricted-imports': 'off',
    },
  },

  // Prettier integration
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

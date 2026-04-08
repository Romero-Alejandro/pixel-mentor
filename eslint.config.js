import eslintConfigPrettier from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import { base, reactConfig, server } from '@pixel-mentor/eslint-config-custom';

export default [
  // Base TypeScript rules for entire monorepo
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      '.agents/**',
      '**/*.d.ts',
      '**/*.js',
      'apps/api/src/database/generated/**',
    ],
  },
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
    rules: {
      ...reactConfig.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
      'react/no-unescaped-entities': 'off',
      'jsx-a11y/no-noninteractive-element-interactions': 'off',
      'jsx-a11y/no-noninteractive-tabindex': 'off',
      'import-x/order': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },

  // Backend Node.js API
  // server is an array of configs; we apply each with files restricted to api/
  ...server.map((conf) => ({
    files: ['apps/api/**/*.ts'],
    ...conf,
    rules: {
      ...conf.rules,
      'no-var': 'off',
    },
  })),

  // Test files: relax rules
  {
    files: [
      '**/*.{spec,test}.{ts,tsx}',
      'apps/api/prisma/**/*.ts',
      'apps/api/src/**/*.test.ts',
      'apps/api/tests/**/*.ts',
      'apps/api/src/features/evaluation/**/*.ts',
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'import/no-extraneous-dependencies': 'off',
      'no-restricted-imports': 'off',
      'promise/catch-or-return': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'unicorn/no-array-for-each': 'off',
      'import-x/order': 'off',
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

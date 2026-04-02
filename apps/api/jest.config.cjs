module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/tests/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': '@swc/jest',
  },
  resolver: '<rootDir>/jest-resolver.cjs',
  moduleNameMapper: {
    // Feature-sliced paths - map @/features/* to src/features/*
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    // Direct path aliases matching tsconfig
    '^@/(.*)$': '<rootDir>/src/$1',
    // Legacy relative path mappings from old structure
    '^tests/(.*)$': '<rootDir>/tests/$1',
    // Database client mappings
    '^\\.\\./client\\.js$': '<rootDir>/src/infrastructure/adapters/database/client.ts',
    '^\\.\\./error-handler\\.js$':
      '<rootDir>/src/infrastructure/adapters/database/error-handler.ts',
    '^\\.\\./\\.\\./client\\.js$': '<rootDir>/src/infrastructure/adapters/database/client.ts',
  },
  // Run orchestrate-recipe tests in same worker to avoid mock state leakage
  workerIdleMemoryLimit: '512MB',
  collectCoverageFrom: [
    'src/application/**/*.ts',
    'src/domain/**/*.ts',
    'src/infrastructure/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
    './src/application/**/*.ts': {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    './src/domain/**/*.ts': {
      branches: 45,
      functions: 45,
      lines: 45,
      statements: 45,
    },
    './src/infrastructure/**/*.ts': {
      branches: 15,
      functions: 15,
      lines: 15,
      statements: 15,
    },
  },
};

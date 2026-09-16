module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': '@swc/jest',
  },
  resolver: '<rootDir>/jest-resolver.cjs',
  moduleNameMapper: {
    // Feature-sliced paths - map @/features/* to src/features/*
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    // Direct path aliases matching tsconfig
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Run orchestrate-recipe tests in same worker to avoid mock state leakage
  workerIdleMemoryLimit: '512MB',
  collectCoverageFrom: [
    'src/features/**/*.ts',
    'src/shared/**/*.ts',
    'src/main/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/database/generated/**',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
    './src/features/**/*.ts': {
      branches: 45,
      functions: 45,
      lines: 45,
      statements: 45,
    },
    './src/shared/**/*.ts': {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
};

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': '@swc/jest',
  },
  moduleNameMapper: {
    '^@/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^\\.\\./client\\.js$': '<rootDir>/src/infrastructure/adapters/database/client.ts',
    '^\\.\\./error-handler\\.js$':
      '<rootDir>/src/infrastructure/adapters/database/error-handler.ts',
    '^\\.\\./\\.\\./client\\.js$': '<rootDir>/src/infrastructure/adapters/database/client.ts',
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/__tests__/**'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

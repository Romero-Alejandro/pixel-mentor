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
    '^\\./routes/leccion\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/leccion.ts',
    '^\\./routes/lessons\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/lessons.ts',
    '^\\./routes/sessions\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/sessions.ts',
    '^\\./routes/auth\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/auth.ts',
    '^\\./middleware/auth\\.js$': '<rootDir>/src/infrastructure/adapters/http/middleware/auth.ts',
    '^\\./middleware/request-id\\.js$':
      '<rootDir>/src/infrastructure/adapters/http/middleware/request-id.ts',
    '^\\./middleware/timeout\\.js$':
      '<rootDir>/src/infrastructure/adapters/http/middleware/timeout.ts',
    '^\\./middleware/request-logger\\.js$':
      '<rootDir>/src/infrastructure/adapters/http/middleware/request-logger.ts',
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

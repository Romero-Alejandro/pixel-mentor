module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/tests/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': '@swc/jest',
  },
  moduleNameMapper: {
    '^@/(.*)\\.js$': '<rootDir>/src/$1.ts',
    '^@/(.*)\\.ts$': '<rootDir>/src/$1.ts',
    '^@/(.*)/index\\.ts$': '<rootDir>/src/$1/index.ts',
    '^@/(.*)/index\\.js$': '<rootDir>/src/$1/index.ts',
    '^@/prompt/(.*)$': '<rootDir>/src/prompt/$1.ts',
    '^@/evaluator/(.*)$': '<rootDir>/src/evaluator/$1.ts',
    '^@/config/(.*)$': '<rootDir>/src/config/$1.ts',
    '^@/monitoring/(.*)$': '<rootDir>/src/monitoring/$1.ts',
    '^@/domain/errors/(.*)$': '<rootDir>/src/domain/errors/$1.ts',
    '^@/domain/validators/(.*)$': '<rootDir>/src/domain/validators/$1.ts',
    '^@/infrastructure/http/(.*)$': '<rootDir>/src/infrastructure/http/$1.ts',
    '^@/infrastructure/transactions/(.*)$': '<rootDir>/src/infrastructure/transactions/$1.ts',
    '^@/infrastructure/observability/(.*)$': '<rootDir>/src/infrastructure/observability/$1.ts',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^tests/(.*)$': '<rootDir>/tests/$1',
    '^\\.\\./client\\.js$': '<rootDir>/src/infrastructure/adapters/database/client.ts',
    '^\\.\\./error-handler\\.js$':
      '<rootDir>/src/infrastructure/adapters/database/error-handler.ts',
    '^\\.\\./\\.\\./client\\.js$': '<rootDir>/src/infrastructure/adapters/database/client.ts',
    // Relative imports within infrastructure adapters
    '^\\./routes/leccion\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/leccion.ts',
    '^\\./routes/lessons\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/lessons.ts',
    '^\\./routes/sessions\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/sessions.ts',
    '^\\./routes/auth\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/auth.ts',
    '^\\./routes/recipes\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/recipes.ts',
    '^\\./routes/recipe\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/recipe.ts',
    '^\\./routes/class-templates\\.js$':
      '<rootDir>/src/infrastructure/adapters/http/routes/class-templates.ts',
    '^\\./routes/classes\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/classes.ts',
    '^\\./routes/health\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/health.ts',
    '^\\./routes/tts\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/tts.ts',
    '^\\./routes/recipe-ai\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/recipe-ai.ts',
    '^\\./routes/class-ai\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/class-ai.ts',
    '^\\./routes/gamification\\.js$':
      '<rootDir>/src/infrastructure/adapters/http/routes/gamification.ts',
    '^\\./routes/gamification-events\\.js$':
      '<rootDir>/src/infrastructure/adapters/http/routes/gamification-events.ts',
    '^\\./routes/admin\\.js$': '<rootDir>/src/infrastructure/adapters/http/routes/admin.ts',
    '^\\./middleware/auth\\.js$': '<rootDir>/src/infrastructure/adapters/http/middleware/auth.ts',
    '^\\./middleware/request-id\\.js$':
      '<rootDir>/src/infrastructure/adapters/http/middleware/request-id.ts',
    '^\\./middleware/timeout\\.js$':
      '<rootDir>/src/infrastructure/adapters/http/middleware/timeout.ts',
    '^\\./middleware/request-logger\\.js$':
      '<rootDir>/src/infrastructure/adapters/http/middleware/request-logger.ts',
    // Domain relative imports
    '^\\./app-error\\.js$': '<rootDir>/src/domain/errors/app-error.ts',
    '^\\./entity-validators\\.js$': '<rootDir>/src/domain/validators/entity-validators.ts',
    // Game engine relative imports
    '^\\./badge-types\\.js$': '<rootDir>/src/game-engine/badge-types.ts',
    '^\\./badge-progress\\.js$': '<rootDir>/src/game-engine/badge-progress.ts',
    '^\\./index\\.js$': '<rootDir>/src/game-engine/index.ts',
    '^\\./level\\.service\\.js$': '<rootDir>/src/game-engine/level.service.ts',
    '^\\./streak\\.service\\.js$': '<rootDir>/src/game-engine/streak.service.ts',
    '^\\./strategies/index\\.js$': '<rootDir>/src/game-engine/strategies/index.ts',
    // Config imports
    '^\\./evaluation-flags\\.js$': '<rootDir>/src/config/evaluation-flags.ts',
    // Infrastructure relative imports
    '^\\./health-check\\.service\\.js$':
      '<rootDir>/src/infrastructure/observability/health-check.service.ts',
    '^\\./cache\\.service\\.js$': '<rootDir>/src/infrastructure/cache/cache.service.ts',
    '^\\./circuit-breaker\\.js$': '<rootDir>/src/infrastructure/resilience/circuit-breaker.ts',
    '^\\./transaction\\.service\\.js$':
      '<rootDir>/src/infrastructure/transactions/transaction.service.ts',
    // Repository relative imports (for base repository)
    '^\\./prisma-base\\.repository\\.js$':
      '<rootDir>/src/infrastructure/repositories/prisma-base.repository.ts',
    '^\\./prisma-class-lesson\\.repository\\.js$':
      '<rootDir>/src/infrastructure/repositories/prisma-class-lesson.repository.ts',
    // Additional entity and port mappings from .js imports in TypeScript files
    '^\\.\\./middleware/auth\\.js$': '<rootDir>/src/middleware/auth.js',
    '^\\.\\./entities/atom-competency\\.js$': '<rootDir>/src/domain/entities/atom-competency.js',
    '^\\.\\./entities/competency-mastery\\.js$':
      '<rootDir>/src/domain/entities/competency-mastery.js',
    '^\\.\\./entities/event-log\\.js$': '<rootDir>/src/domain/entities/event-log.js',
    '^\\.\\./entities/knowledge-chunk\\.js$': '<rootDir>/src/domain/entities/knowledge-chunk.js',
    '^\\.\\./entities/micro-interaction\\.js$':
      '<rootDir>/src/domain/entities/micro-interaction.js',
    '^\\.\\./entities/pedagogical-state\\.js$':
      '<rootDir>/src/domain/entities/pedagogical-state.js',
    '^\\.\\./entities/recipe\\.js$': '<rootDir>/src/domain/entities/recipe.js',
    '^\\.\\./entities/recipe-tag\\.js$': '<rootDir>/src/domain/entities/recipe-tag.js',
    '^\\.\\./entities/tag\\.js$': '<rootDir>/src/domain/entities/tag.js',
    '^\\.\\./entities/user-progress\\.js$': '<rootDir>/src/domain/entities/user-progress.js',
    '^\\.\\./ports/atom-repository\\.js$': '<rootDir>/src/domain/ports/atom-repository.js',
    '^\\.\\./ports/event-log-repository\\.js$':
      '<rootDir>/src/domain/ports/event-log-repository.js',
    '^\\.\\./ports/progress-repository\\.js$': '<rootDir>/src/domain/ports/progress-repository.js',
  },
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

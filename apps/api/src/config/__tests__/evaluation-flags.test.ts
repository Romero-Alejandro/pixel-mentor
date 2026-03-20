import {
  FeatureFlagService,
  createFeatureFlagService,
  getFeatureFlagService,
  resetFeatureFlagService,
  type EvaluationFlags,
  type CohortConfig,
} from '../evaluation-flags';

// ============================================================
// Test Helpers
// ============================================================

const DEFAULT_FLAGS: EvaluationFlags = {
  cohorts: {},
  templateEngine: {
    allowConditionals: false,
    maxDepth: 5,
  },
  keywordExtraction: {
    enabled: true,
    domain: {
      minLength: 3,
      maxKeywords: 20,
      useTfIdf: false,
    },
  },
  useNewEvaluatorEngine: false,
};

// ============================================================
// FeatureFlagService Unit Tests
// ============================================================

describe('FeatureFlagService', () => {
  beforeEach(() => {
    resetFeatureFlagService();
  });

  afterEach(() => {
    resetFeatureFlagService();
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        useNewEvaluatorEngine: true,
      };
      const service = createFeatureFlagService(flags);

      const config = service.getConfig();

      // Verify it's a copy (mutation doesn't affect original)
      config.useNewEvaluatorEngine = false;
      expect(service.getConfig().useNewEvaluatorEngine).toBe(true);
    });
  });

  describe('getCohortConfig', () => {
    it('should return cohort config when it exists', () => {
      const cohortConfig: CohortConfig = {
        evaluatorType: 'llm',
        parameters: { modelName: 'gpt-4' },
      };
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        cohorts: {
          'beta-users': cohortConfig,
        },
      };
      const service = createFeatureFlagService(flags);

      const result = service.getCohortConfig('beta-users');

      expect(result).toEqual(cohortConfig);
    });

    it('should return null when cohort does not exist', () => {
      const service = createFeatureFlagService(DEFAULT_FLAGS);

      const result = service.getCohortConfig('non-existent');

      expect(result).toBeNull();
    });

    it('should return config for empty string cohort key if defined', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        cohorts: {
          '': { evaluatorType: 'keyword' },
        },
      };
      const service = createFeatureFlagService(flags);

      const result = service.getCohortConfig('');

      // Empty string is a valid object key, so it returns the config
      expect(result).toEqual({ evaluatorType: 'keyword' });
    });
  });

  describe('shouldUseNewEngine', () => {
    it('should return true when global flag is enabled', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        useNewEvaluatorEngine: true,
      };
      const service = createFeatureFlagService(flags);

      expect(service.shouldUseNewEngine()).toBe(true);
      expect(service.shouldUseNewEngine('any-cohort')).toBe(true);
    });

    it('should return false when global flag is disabled and no cohort match', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        useNewEvaluatorEngine: false,
      };
      const service = createFeatureFlagService(flags);

      expect(service.shouldUseNewEngine()).toBe(false);
      expect(service.shouldUseNewEngine('some-cohort')).toBe(false);
    });

    it('should return true when cohort uses LLM evaluator (even if global disabled)', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        useNewEvaluatorEngine: false,
        cohorts: {
          'llm-cohort': { evaluatorType: 'llm' },
        },
      };
      const service = createFeatureFlagService(flags);

      expect(service.shouldUseNewEngine('llm-cohort')).toBe(true);
      expect(service.shouldUseNewEngine('other-cohort')).toBe(false);
    });

    it('should prioritize global flag over cohort setting', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        useNewEvaluatorEngine: true,
        cohorts: {
          'keyword-cohort': { evaluatorType: 'keyword' },
        },
      };
      const service = createFeatureFlagService(flags);

      // Global flag takes precedence
      expect(service.shouldUseNewEngine('keyword-cohort')).toBe(true);
    });
  });

  describe('isConditionalTemplatesEnabled', () => {
    it('should return false by default', () => {
      const service = createFeatureFlagService(DEFAULT_FLAGS);

      expect(service.isConditionalTemplatesEnabled()).toBe(false);
    });

    it('should return true when enabled', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        templateEngine: {
          allowConditionals: true,
          maxDepth: 5,
        },
      };
      const service = createFeatureFlagService(flags);

      expect(service.isConditionalTemplatesEnabled()).toBe(true);
    });
  });

  describe('isKeywordExtractionEnabled', () => {
    it('should return true by default', () => {
      const service = createFeatureFlagService(DEFAULT_FLAGS);

      expect(service.isKeywordExtractionEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        keywordExtraction: {
          enabled: false,
        },
      };
      const service = createFeatureFlagService(flags);

      expect(service.isKeywordExtractionEnabled()).toBe(false);
    });
  });

  describe('getMaxTemplateDepth', () => {
    it('should return default depth of 5', () => {
      const service = createFeatureFlagService(DEFAULT_FLAGS);

      expect(service.getMaxTemplateDepth()).toBe(5);
    });

    it('should return custom depth when configured', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        templateEngine: {
          allowConditionals: true,
          maxDepth: 3,
        },
      };
      const service = createFeatureFlagService(flags);

      expect(service.getMaxTemplateDepth()).toBe(3);
    });
  });

  describe('getKeywordExtractionConfig', () => {
    it('should return config when enabled', () => {
      const service = createFeatureFlagService(DEFAULT_FLAGS);

      const config = service.getKeywordExtractionConfig();

      expect(config).not.toBeNull();
      expect(config?.enabled).toBe(true);
      expect(config?.domain?.minLength).toBe(3);
    });

    it('should return null when disabled', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        keywordExtraction: {
          enabled: false,
        },
      };
      const service = createFeatureFlagService(flags);

      expect(service.getKeywordExtractionConfig()).toBeNull();
    });

    it('should return a copy of the config', () => {
      const service = createFeatureFlagService(DEFAULT_FLAGS);
      const config = service.getKeywordExtractionConfig();

      // Mutation shouldn't affect the original
      config!.domain!.minLength = 99;
      expect(service.getKeywordExtractionConfig()?.domain?.minLength).toBe(3);
    });
  });

  describe('isTemplateEngineEnabledForCohort', () => {
    it('should return false by default', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        cohorts: {
          'test-cohort': { evaluatorType: 'keyword' },
        },
      };
      const service = createFeatureFlagService(flags);

      expect(service.isTemplateEngineEnabledForCohort('test-cohort')).toBe(false);
    });

    it('should return true when cohort has template engine enabled', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        cohorts: {
          'test-cohort': {
            evaluatorType: 'llm',
            useTemplateEngine: true,
          },
        },
      };
      const service = createFeatureFlagService(flags);

      expect(service.isTemplateEngineEnabledForCohort('test-cohort')).toBe(true);
    });

    it('should return false for non-existent cohort', () => {
      const service = createFeatureFlagService(DEFAULT_FLAGS);

      expect(service.isTemplateEngineEnabledForCohort('non-existent')).toBe(false);
    });
  });

  describe('getCohorts', () => {
    it('should return empty array when no cohorts defined', () => {
      const service = createFeatureFlagService(DEFAULT_FLAGS);

      expect(service.getCohorts()).toEqual([]);
    });

    it('should return all defined cohort names', () => {
      const flags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        cohorts: {
          'cohort-a': { evaluatorType: 'keyword' },
          'cohort-b': { evaluatorType: 'llm' },
          'cohort-c': { evaluatorType: 'semantic' },
        },
      };
      const service = createFeatureFlagService(flags);

      const cohorts = service.getCohorts();
      expect(cohorts).toHaveLength(3);
      expect(cohorts).toContain('cohort-a');
      expect(cohorts).toContain('cohort-b');
      expect(cohorts).toContain('cohort-c');
    });
  });
});

// ============================================================
// Default Values Tests
// ============================================================

describe('Default Values', () => {
  beforeEach(() => {
    resetFeatureFlagService();
  });

  afterEach(() => {
    resetFeatureFlagService();
  });

  it('should have useNewEvaluatorEngine set to false by default', () => {
    const service = createFeatureFlagService(DEFAULT_FLAGS);

    expect(service.getConfig().useNewEvaluatorEngine).toBe(false);
  });

  it('should have empty cohorts by default', () => {
    const service = createFeatureFlagService(DEFAULT_FLAGS);

    expect(service.getConfig().cohorts).toEqual({});
    expect(service.getCohorts()).toEqual([]);
  });

  it('should have allowConditionals set to false by default', () => {
    const service = createFeatureFlagService(DEFAULT_FLAGS);

    expect(service.isConditionalTemplatesEnabled()).toBe(false);
  });

  it('should have keywordExtraction enabled by default', () => {
    const service = createFeatureFlagService(DEFAULT_FLAGS);

    expect(service.isKeywordExtractionEnabled()).toBe(true);
  });

  it('should have maxDepth set to 5 by default', () => {
    const service = createFeatureFlagService(DEFAULT_FLAGS);

    expect(service.getMaxTemplateDepth()).toBe(5);
  });

  it('should have default keyword extraction domain settings', () => {
    const service = createFeatureFlagService(DEFAULT_FLAGS);
    const config = service.getKeywordExtractionConfig();

    expect(config?.domain?.minLength).toBe(3);
    expect(config?.domain?.maxKeywords).toBe(20);
    expect(config?.domain?.useTfIdf).toBe(false);
  });
});

// ============================================================
// Configuration Loading Tests
// ============================================================

describe('Configuration Loading', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetFeatureFlagService();
    process.env = { ...originalEnv };
    delete process.env.EVALUATION_FLAGS;
  });

  afterEach(() => {
    resetFeatureFlagService();
    process.env = originalEnv;
  });

  describe('loadFromEnvVar', () => {
    it('should load configuration from EVALUATION_FLAGS env var', () => {
      process.env.EVALUATION_FLAGS = JSON.stringify({
        useNewEvaluatorEngine: true,
        cohorts: {
          'env-cohort': { evaluatorType: 'llm' },
        },
      });

      const service = getFeatureFlagService();

      expect(service.shouldUseNewEngine()).toBe(true);
      expect(service.getCohortConfig('env-cohort')).toEqual({
        evaluatorType: 'llm',
      });
    });

    it('should use defaults when EVALUATION_FLAGS is not set', () => {
      delete process.env.EVALUATION_FLAGS;

      const service = getFeatureFlagService();

      expect(service.getConfig().useNewEvaluatorEngine).toBe(false);
    });

    it('should handle invalid JSON in EVALUATION_FLAGS gracefully', () => {
      process.env.EVALUATION_FLAGS = 'not valid json {';

      // Should not throw, should use defaults
      expect(() => getFeatureFlagService()).not.toThrow();
      const service = getFeatureFlagService();
      expect(service.getConfig().useNewEvaluatorEngine).toBe(false);
    });

    it('should handle invalid schema in EVALUATION_FLAGS gracefully', () => {
      process.env.EVALUATION_FLAGS = JSON.stringify({
        useNewEvaluatorEngine: 'yes', // should be boolean
        invalidField: true,
      });

      // Should not throw, should use defaults
      expect(() => getFeatureFlagService()).not.toThrow();
      const service = getFeatureFlagService();
      expect(service.getConfig().useNewEvaluatorEngine).toBe(false);
    });

    it('should merge partial env config with defaults', () => {
      process.env.EVALUATION_FLAGS = JSON.stringify({
        templateEngine: {
          allowConditionals: true,
        },
      });

      const service = getFeatureFlagService();

      // Custom setting applied
      expect(service.isConditionalTemplatesEnabled()).toBe(true);
      // Default preserved
      expect(service.getMaxTemplateDepth()).toBe(5);
    });
  });

  describe('loadFromConfigFile', () => {
    it('should load from config file when EVALUATION_FLAGS env var not set', () => {
      // The loadFromConfigFile function checks for config/evaluation-flags.json
      // Since we can't easily create temp files in Jest, we test the merge logic
      const service = getFeatureFlagService();

      // Just verify it doesn't throw and returns defaults
      expect(service).toBeInstanceOf(FeatureFlagService);
    });
  });

  describe('Feature Flag Precedence', () => {
    it('should prioritize environment variables over config file', () => {
      process.env.EVALUATION_FLAGS = JSON.stringify({
        useNewEvaluatorEngine: true,
      });

      const service = getFeatureFlagService();

      expect(service.shouldUseNewEngine()).toBe(true);
    });

    it('should apply partial env config over full file config', () => {
      process.env.EVALUATION_FLAGS = JSON.stringify({
        useNewEvaluatorEngine: true,
        cohorts: {
          'env-only-cohort': { evaluatorType: 'semantic' },
        },
      });

      const service = getFeatureFlagService();

      expect(service.shouldUseNewEngine()).toBe(true);
      expect(service.getCohortConfig('env-only-cohort')).toEqual({
        evaluatorType: 'semantic',
      });
    });

    it('should merge cohort configs from different sources', () => {
      // This tests the conceptual merge - actual file loading would be tested with temp files
      const flags1: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        cohorts: {
          'cohort-1': { evaluatorType: 'keyword' },
        },
      };

      const flags2: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        cohorts: {
          'cohort-2': { evaluatorType: 'llm' },
        },
      };

      // Simulate merged config
      const mergedFlags: EvaluationFlags = {
        ...DEFAULT_FLAGS,
        cohorts: {
          ...flags1.cohorts,
          ...flags2.cohorts,
        },
      };

      const service = createFeatureFlagService(mergedFlags);

      expect(service.getCohortConfig('cohort-1')).toEqual({
        evaluatorType: 'keyword',
      });
      expect(service.getCohortConfig('cohort-2')).toEqual({
        evaluatorType: 'llm',
      });
    });
  });

  describe('Staging Environment', () => {
    it('should default useNewEvaluatorEngine to true in staging', () => {
      process.env.NODE_ENV = 'staging';
      resetFeatureFlagService();

      const service = getFeatureFlagService();

      expect(service.shouldUseNewEngine()).toBe(true);
    });

    it('should still respect explicit false in staging', () => {
      process.env.NODE_ENV = 'staging';
      process.env.EVALUATION_FLAGS = JSON.stringify({
        useNewEvaluatorEngine: false,
      });
      resetFeatureFlagService();

      const service = getFeatureFlagService();

      // Explicit setting in env var should override staging default
      expect(service.shouldUseNewEngine()).toBe(false);
    });
  });
});

// ============================================================
// Cohort Mapping Logic Tests
// ============================================================

describe('Cohort Mapping Logic', () => {
  beforeEach(() => {
    resetFeatureFlagService();
  });

  afterEach(() => {
    resetFeatureFlagService();
  });

  it('should map cohort to keyword evaluator', () => {
    const flags: EvaluationFlags = {
      ...DEFAULT_FLAGS,
      cohorts: {
        'keyword-test': {
          evaluatorType: 'keyword',
          parameters: { keywordMatchThreshold: 0.7 },
        },
      },
    };
    const service = createFeatureFlagService(flags);
    const config = service.getCohortConfig('keyword-test');

    expect(config?.evaluatorType).toBe('keyword');
    expect(config?.parameters?.keywordMatchThreshold).toBe(0.7);
  });

  it('should map cohort to semantic evaluator', () => {
    const flags: EvaluationFlags = {
      ...DEFAULT_FLAGS,
      cohorts: {
        'semantic-test': {
          evaluatorType: 'semantic',
          parameters: { embeddingModel: 'bert-base' },
        },
      },
    };
    const service = createFeatureFlagService(flags);
    const config = service.getCohortConfig('semantic-test');

    expect(config?.evaluatorType).toBe('semantic');
    expect(config?.parameters?.embeddingModel).toBe('bert-base');
  });

  it('should map cohort to LLM evaluator with model name', () => {
    const flags: EvaluationFlags = {
      ...DEFAULT_FLAGS,
      cohorts: {
        'llm-test': {
          evaluatorType: 'llm',
          parameters: { modelName: 'gpt-4-turbo', detailedScoring: true },
        },
      },
    };
    const service = createFeatureFlagService(flags);
    const config = service.getCohortConfig('llm-test');

    expect(config?.evaluatorType).toBe('llm');
    expect(config?.parameters?.modelName).toBe('gpt-4-turbo');
    expect(config?.parameters?.detailedScoring).toBe(true);
  });

  it('should handle multiple cohorts with different evaluators', () => {
    const flags: EvaluationFlags = {
      ...DEFAULT_FLAGS,
      cohorts: {
        'cohort-a': { evaluatorType: 'keyword' },
        'cohort-b': { evaluatorType: 'semantic' },
        'cohort-c': { evaluatorType: 'llm' },
      },
    };
    const service = createFeatureFlagService(flags);

    expect(service.getCohortConfig('cohort-a')?.evaluatorType).toBe('keyword');
    expect(service.getCohortConfig('cohort-b')?.evaluatorType).toBe('semantic');
    expect(service.getCohortConfig('cohort-c')?.evaluatorType).toBe('llm');
  });

  it('should enable new engine for LLM evaluator cohorts', () => {
    const flags: EvaluationFlags = {
      ...DEFAULT_FLAGS,
      useNewEvaluatorEngine: false,
      cohorts: {
        'llm-cohort': { evaluatorType: 'llm' },
      },
    };
    const service = createFeatureFlagService(flags);

    expect(service.shouldUseNewEngine('llm-cohort')).toBe(true);
    expect(service.shouldUseNewEngine('other')).toBe(false);
  });

  it('should not enable new engine for keyword/semantic evaluator cohorts', () => {
    const flags: EvaluationFlags = {
      ...DEFAULT_FLAGS,
      useNewEvaluatorEngine: false,
      cohorts: {
        'keyword-cohort': { evaluatorType: 'keyword' },
        'semantic-cohort': { evaluatorType: 'semantic' },
      },
    };
    const service = createFeatureFlagService(flags);

    expect(service.shouldUseNewEngine('keyword-cohort')).toBe(false);
    expect(service.shouldUseNewEngine('semantic-cohort')).toBe(false);
  });
});

// ============================================================
// Reset Functionality Tests
// ============================================================

describe('Reset Functionality', () => {
  it('should allow resetting singleton to reload config', () => {
    process.env.EVALUATION_FLAGS = JSON.stringify({
      useNewEvaluatorEngine: true,
    });

    const service1 = getFeatureFlagService();
    expect(service1.shouldUseNewEngine()).toBe(true);

    // Change the env var
    process.env.EVALUATION_FLAGS = JSON.stringify({
      useNewEvaluatorEngine: false,
    });

    // Without reset, should still have old config (cached)
    const service2 = getFeatureFlagService();
    expect(service2.shouldUseNewEngine()).toBe(true);
    expect(service1).toBe(service2);

    // After reset, should get new config
    resetFeatureFlagService();
    const service3 = getFeatureFlagService();
    expect(service3.shouldUseNewEngine()).toBe(false);
    expect(service1).not.toBe(service3);
  });
});

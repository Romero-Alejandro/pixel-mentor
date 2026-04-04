/**
 * Unit Tests for TokenTracker (standalone functions)
 *
 * Tests cover:
 * - estimateTokens returns correct count (chars / 3.5)
 * - estimateTokenUsage splits input/output
 * - estimateCost calculates correctly with pricing
 * - estimateCostFromText works end-to-end
 * - Empty strings return 0
 */

import {
  estimateTokens,
  estimateTokenUsage,
  estimateCost,
  estimateCostFromText,
} from '@/shared/ai/governance/token-tracker.js';
import type { TokenUsage, ProviderPricing } from '@/shared/ai/governance/governance.types.js';

describe('TokenTracker', () => {
  const SAMPLE_PRICING: ProviderPricing = {
    inputPerMillion: 0.2,
    outputPerMillion: 0.6,
  };

  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      expect(estimateTokens(null as unknown as string)).toBe(0);
      expect(estimateTokens(undefined as unknown as string)).toBe(0);
    });

    it('should estimate tokens using chars / 3.5 ratio', () => {
      // 35 characters / 3.5 = 10 tokens
      const text = 'a'.repeat(35);

      expect(estimateTokens(text)).toBe(10);
    });

    it('should round up fractional tokens', () => {
      // 4 characters / 3.5 = 1.14... -> ceil = 2
      const text = 'test';

      expect(estimateTokens(text)).toBe(2);
    });

    it('should return 1 for very short text', () => {
      expect(estimateTokens('a')).toBe(1);
    });

    it('should handle longer text correctly', () => {
      // 350 characters / 3.5 = 100 tokens
      const text = 'a'.repeat(350);

      expect(estimateTokens(text)).toBe(100);
    });

    it('should count spaces and special characters', () => {
      // "hello world" = 11 chars / 3.5 = 3.14... -> ceil = 4
      expect(estimateTokens('hello world')).toBe(4);
    });
  });

  describe('estimateTokenUsage', () => {
    it('should split input and output tokens correctly', () => {
      // 35 chars / 3.5 = 10 input tokens
      // 70 chars / 3.5 = 20 output tokens
      const prompt = 'a'.repeat(35);
      const response = 'b'.repeat(70);

      const usage = estimateTokenUsage(prompt, response);

      expect(usage.inputTokens).toBe(10);
      expect(usage.outputTokens).toBe(20);
      expect(usage.totalTokens).toBe(30);
    });

    it('should handle empty prompt', () => {
      const usage = estimateTokenUsage('', 'response');

      expect(usage.inputTokens).toBe(0);
      expect(usage.outputTokens).toBeGreaterThan(0);
    });

    it('should handle empty response', () => {
      const usage = estimateTokenUsage('prompt', '');

      expect(usage.inputTokens).toBeGreaterThan(0);
      expect(usage.outputTokens).toBe(0);
    });

    it('should handle both empty', () => {
      const usage = estimateTokenUsage('', '');

      expect(usage.inputTokens).toBe(0);
      expect(usage.outputTokens).toBe(0);
      expect(usage.totalTokens).toBe(0);
    });

    it('should correctly sum total tokens', () => {
      const prompt = 'Hello';
      const response = 'Hi there!';

      const usage = estimateTokenUsage(prompt, response);

      expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens);
    });
  });

  describe('estimateCost', () => {
    it('should calculate cost correctly for input and output', () => {
      const usage: TokenUsage = {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      };

      const cost = estimateCost(usage, SAMPLE_PRICING);

      expect(cost.costUsd).toBe(0.2 + 0.6); // $0.20 + $0.60
      expect(cost.inputCostPerMillion).toBe(0.2);
      expect(cost.outputCostPerMillion).toBe(0.6);
    });

    it('should calculate cost for zero tokens', () => {
      const usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      };

      const cost = estimateCost(usage, SAMPLE_PRICING);

      expect(cost.costUsd).toBe(0);
    });

    it('should handle fractional token costs', () => {
      const usage: TokenUsage = {
        inputTokens: 500_000,
        outputTokens: 500_000,
        totalTokens: 1_000_000,
      };

      const cost = estimateCost(usage, SAMPLE_PRICING);

      expect(cost.costUsd).toBeCloseTo(0.4, 2); // (0.5 * 0.2) + (0.5 * 0.6) = 0.4
    });

    it('should handle free pricing (openrouter)', () => {
      const usage: TokenUsage = {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        totalTokens: 2_000_000,
      };
      const freePricing: ProviderPricing = {
        inputPerMillion: 0,
        outputPerMillion: 0,
      };

      const cost = estimateCost(usage, freePricing);

      expect(cost.costUsd).toBe(0);
    });

    it('should calculate cost with only input tokens', () => {
      const usage: TokenUsage = {
        inputTokens: 1_000_000,
        outputTokens: 0,
        totalTokens: 1_000_000,
      };

      const cost = estimateCost(usage, SAMPLE_PRICING);

      expect(cost.costUsd).toBe(0.2);
    });

    it('should calculate cost with only output tokens', () => {
      const usage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 1_000_000,
        totalTokens: 1_000_000,
      };

      const cost = estimateCost(usage, SAMPLE_PRICING);

      expect(cost.costUsd).toBe(0.6);
    });
  });

  describe('estimateCostFromText', () => {
    it('should work end-to-end with text inputs', () => {
      // 350 chars / 3.5 = 100 input tokens
      // 700 chars / 3.5 = 200 output tokens
      const prompt = 'a'.repeat(350);
      const response = 'b'.repeat(700);

      const cost = estimateCostFromText(prompt, response, SAMPLE_PRICING);

      // (100 / 1_000_000 * 0.2) + (200 / 1_000_000 * 0.6)
      const expectedCost = (100 / 1_000_000) * 0.2 + (200 / 1_000_000) * 0.6;
      expect(cost.costUsd).toBeCloseTo(expectedCost, 6);
    });

    it('should return 0 cost for empty strings', () => {
      const cost = estimateCostFromText('', '', SAMPLE_PRICING);

      expect(cost.costUsd).toBe(0);
    });

    it('should use correct pricing from the pricing object', () => {
      const geminiPricing: ProviderPricing = {
        inputPerMillion: 0.075,
        outputPerMillion: 0.3,
      };
      const prompt = 'a'.repeat(3500); // 1000 tokens
      const response = 'b'.repeat(3500); // 1000 tokens

      const cost = estimateCostFromText(prompt, response, geminiPricing);

      // (1000 / 1_000_000 * 0.075) + (1000 / 1_000_000 * 0.3)
      const expectedCost = 0.000075 + 0.0003;
      expect(cost.costUsd).toBeCloseTo(expectedCost, 6);
    });

    it('should handle realistic prompt/response sizes', () => {
      const prompt = 'Explain quantum computing in simple terms.'; // ~40 chars
      const response =
        'Quantum computing uses quantum bits (qubits) that can exist in multiple states at once, ' +
        'allowing it to perform certain calculations much faster than classical computers.'; // ~170 chars

      const cost = estimateCostFromText(prompt, response, SAMPLE_PRICING);

      expect(cost.costUsd).toBeGreaterThan(0);
      expect(cost.costUsd).toBeLessThan(0.001); // Very small for short text
    });
  });
});

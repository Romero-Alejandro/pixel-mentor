import type { PromptValidationResult } from './governance.types.js';

// ==================== Prompt Injection Patterns ====================

/**
 * Patterns that may indicate prompt injection attempts.
 */
const INJECTION_PATTERNS = [
  // System prompt override attempts
  /\b(ignore\s+(previous|all|above|prior))\b/i,
  /\b(you\s+are\s+now)\b/i,
  /\b(new\s+(system|role|instruction))\b/i,
  // Code execution attempts
  /\b(execute|run|eval)\s*\(/i,
  // URL/data exfiltration
  /\b(send|post|fetch|exfiltrate)\s+(data|info|context|prompt)/i,
  // Role-play attacks
  /\b(acting\s+as|pretend\s+to\s+be|roleplay\s+as)\b/i,
];

/**
 * Dangerous content patterns to sanitize.
 */
const DANGEROUS_PATTERNS = [
  // HTML/script injection
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  // Null bytes
  /\x00/g,
];

/**
 * Validates and sanitizes user input for LLM prompts.
 *
 * Security measures:
 * 1. Length validation - rejects inputs exceeding max length
 * 2. Pattern detection - flags potential prompt injection
 * 3. Content sanitization - removes dangerous patterns
 * 4. Unicode normalization - prevents homoglyph attacks
 */
export class PromptValidator {
  constructor(
    private maxPromptLength: number = 16000,
    private maxUserInputLength: number = 2000,
  ) {}

  /**
   * Validates and sanitizes a complete prompt.
   */
  validatePrompt(prompt: string): PromptValidationResult {
    if (!prompt) {
      return {
        valid: false,
        sanitizedInput: '',
        reason: 'Empty prompt',
        originalLength: 0,
        sanitizedLength: 0,
      };
    }

    if (prompt.length > this.maxPromptLength) {
      return {
        valid: false,
        sanitizedInput: prompt.slice(0, this.maxPromptLength),
        reason: `Prompt exceeds maximum length of ${this.maxPromptLength} characters (${prompt.length})`,
        originalLength: prompt.length,
        sanitizedLength: this.maxPromptLength,
      };
    }

    // Sanitize dangerous patterns
    const sanitized = this.sanitize(prompt);

    return {
      valid: true,
      sanitizedInput: sanitized,
      originalLength: prompt.length,
      sanitizedLength: sanitized.length,
    };
  }

  /**
   * Validates and sanitizes user input (student input) before embedding in a prompt.
   */
  validateUserInput(input: string): PromptValidationResult {
    if (!input) {
      return {
        valid: false,
        sanitizedInput: '',
        reason: 'Empty input',
        originalLength: 0,
        sanitizedLength: 0,
      };
    }

    if (input.length > this.maxUserInputLength) {
      return {
        valid: false,
        sanitizedInput: input.slice(0, this.maxUserInputLength),
        reason: `User input exceeds maximum length of ${this.maxUserInputLength} characters (${input.length})`,
        originalLength: input.length,
        sanitizedLength: this.maxUserInputLength,
      };
    }

    // Check for injection patterns
    const injectionScore = this.scoreInjectionRisk(input);
    if (injectionScore >= 2) {
      return {
        valid: false,
        sanitizedInput: this.sanitize(input),
        reason: `Potential prompt injection detected (risk score: ${injectionScore})`,
        originalLength: input.length,
        sanitizedLength: input.length,
      };
    }

    const sanitized = this.sanitize(input);

    return {
      valid: true,
      sanitizedInput: sanitized,
      originalLength: input.length,
      sanitizedLength: sanitized.length,
    };
  }

  /**
   * Scores the injection risk of an input string.
   * Returns 0 (safe) to N (high risk).
   */
  private scoreInjectionRisk(input: string): number {
    let score = 0;
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        score++;
      }
    }
    return score;
  }

  /**
   * Sanitizes a string by removing dangerous patterns.
   */
  private sanitize(input: string): string {
    let sanitized = input;

    // Remove dangerous HTML/script patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Unicode normalization (NFC) to prevent homoglyph attacks
    sanitized = sanitized.normalize('NFC');

    // Trim excessive whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();

    return sanitized;
  }
}

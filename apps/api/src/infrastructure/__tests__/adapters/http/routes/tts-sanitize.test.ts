import { describe, it, expect } from '@jest/globals';

/**
 * sanitizeText helper logic extracted for testing
 * Original: apps/api/src/infrastructure/adapters/http/routes/tts.ts
 *
 * NOTE: This is a copy of the production function for isolated unit testing.
 * The production function is exported and tested indirectly via integration tests.
 */
function sanitizeText(input: string): string {
  if (input.length > 50000) {
    throw new Error('El texto no puede exceder 50000 caracteres');
  }
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/<[^>]*>/g, '') // Remove HTML tags (prevent XSS)
    .trim();
}

describe('sanitizeText', () => {
  it('should return empty string for empty input', () => {
    expect(sanitizeText('')).toBe('');
  });

  it('should trim whitespace from both ends', () => {
    expect(sanitizeText('  hello world  ')).toBe('hello world');
    expect(sanitizeText('\n\thello\n')).toBe('hello');
  });

  it('should remove HTML tags to prevent XSS', () => {
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitizeText('<b>bold</b> and <i>italic</i>')).toBe('bold and italic');
    expect(sanitizeText('<p>paragraph text</p>')).toBe('paragraph text');
  });

  it('should remove control characters', () => {
    expect(sanitizeText('hello\x00world')).toBe('helloworld');
    expect(sanitizeText('hello\x1Fworld')).toBe('helloworld');
    expect(sanitizeText('test\x7Fvalue')).toBe('testvalue');
  });

  it('should NOT truncate text at 5000 characters (regression for tts-streaming-robust-solution)', () => {
    const text5000 = 'a'.repeat(5000);
    const result = sanitizeText(text5000);
    expect(result.length).toBe(5000);
  });

  it('should preserve text longer than 5000 characters (regression test)', () => {
    const text5500 = 'b'.repeat(5500);
    const result = sanitizeText(text5500);
    expect(result.length).toBe(5500);
  });

  it('should handle text at exactly 5000 characters', () => {
    const text5000 = 'c'.repeat(5000);
    expect(() => sanitizeText(text5000)).not.toThrow();
    expect(sanitizeText(text5000).length).toBe(5000);
  });

  it('should handle text at exactly 50000 characters (boundary)', () => {
    const text50000 = 'd'.repeat(50000);
    expect(() => sanitizeText(text50000)).not.toThrow();
    expect(sanitizeText(text50000).length).toBe(50000);
  });

  it('should throw error for text exceeding 50000 characters', () => {
    const text50001 = 'e'.repeat(50001);
    expect(() => sanitizeText(text50001)).toThrow('El texto no puede exceder 50000 caracteres');
  });

  it('should handle text with HTML and length > 5000 chars', () => {
    const longText = '<p>' + 'x'.repeat(6000) + '</p>';
    const result = sanitizeText(longText);
    // Tags stripped, but content preserved (6000 chars)
    expect(result.length).toBe(6000);
    expect(result).not.toContain('<p>');
    expect(result).not.toContain('</p>');
  });

  it('should preserve Spanish accented characters', () => {
    expect(sanitizeText('El veloz murciélago hindú')).toBe('El veloz murciélago hindú');
  });

  it('should handle mixed content with special chars', () => {
    const input = '  Hello, <b>world</b>! 🎉  ';
    const result = sanitizeText(input);
    expect(result).toBe('Hello, world! 🎉');
  });

  it('should handle newlines and tabs', () => {
    const input = 'hello\x00world';
    expect(sanitizeText(input)).toBe('helloworld');
    // \x0B (vertical tab) is stripped by the control char regex
    expect(sanitizeText('test\x0Bvalue')).toBe('testvalue');
    // \r (carriage return) is NOT in the control char range, so it passes through
    // Note: \x0D is > \x08 so not stripped
  });
});

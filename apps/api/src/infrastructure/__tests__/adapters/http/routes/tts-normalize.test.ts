import { describe, it, expect } from '@jest/globals';

/**
 * normalizeLanguageCode helper logic extracted for testing
 * Original: apps/api/src/infrastructure/adapters/http/routes/tts.ts
 */
function normalizeLanguageCode(lang: string | undefined): string {
  return lang?.split('-')[0]?.toLowerCase() || 'es';
}

/**
 * formatMessage helper logic extracted for testing
 * Original: apps/api/src/services/ttsStream.ts
 */
function formatMessage(type: string, data: any): string {
  let payload: any = data;

  // Handle undefined/null data to ensure valid JSON
  if (payload === undefined || payload === null) {
    payload = { message: 'Unknown error', code: 'UNKNOWN' };
  }

  // Ensure the payload can be stringified to valid JSON
  try {
    const stringified = JSON.stringify(payload);
    if (stringified === undefined) {
      payload = { message: 'Unknown error', code: 'UNKNOWN' };
    }
  } catch {
    payload = { message: 'Unknown error', code: 'UNKNOWN' };
  }

  const message = { type, data: payload };
  return `event: ${type}\ndata: ${JSON.stringify(message.data)}\n\n`;
}

describe('normalizeLanguageCode', () => {
  it('should normalize es-ES to es', () => {
    expect(normalizeLanguageCode('es-ES')).toBe('es');
  });

  it('should normalize en-US to en', () => {
    expect(normalizeLanguageCode('en-US')).toBe('en');
  });

  it('should normalize fr-FR to fr', () => {
    expect(normalizeLanguageCode('fr-FR')).toBe('fr');
  });

  it('should return language code as-is if no hyphen', () => {
    expect(normalizeLanguageCode('es')).toBe('es');
    expect(normalizeLanguageCode('en')).toBe('en');
    expect(normalizeLanguageCode('fr')).toBe('fr');
  });

  it('should handle undefined input and return default es', () => {
    expect(normalizeLanguageCode(undefined)).toBe('es');
  });

  it('should handle empty string and return default es', () => {
    expect(normalizeLanguageCode('')).toBe('es');
  });

  it('should handle null input and return default es', () => {
    // @ts-expect-error - testing null input
    expect(normalizeLanguageCode(null)).toBe('es');
  });

  it('should handle invalid language codes gracefully', () => {
    // Invalid but shouldn't crash
    expect(normalizeLanguageCode('invalid')).toBe('invalid');
  });

  it('should handle language codes with multiple hyphens', () => {
    expect(normalizeLanguageCode('es-ES-419')).toBe('es');
  });

  it('should lowercase the language code', () => {
    expect(normalizeLanguageCode('ES-ES')).toBe('es');
    expect(normalizeLanguageCode('EN-US')).toBe('en');
  });
});

describe('formatMessage', () => {
  it('should format valid data correctly', () => {
    const result = formatMessage('audio', { audioBase64: 'test123' });
    expect(result).toContain('event: audio');
    expect(result).toContain('data:');
    expect(result).toContain('test123');
    expect(result).toMatch(/\n\n$/); // Ends with double newline
  });

  it('should handle undefined data and return valid JSON', () => {
    const result = formatMessage('error', undefined);
    expect(result).toContain('event: error');
    expect(result).toContain('message');
    expect(result).toContain('Unknown error');
    expect(result).toContain('code');
    expect(result).toContain('UNKNOWN');

    // Verify it's valid JSON by parsing the data portion
    const dataMatch = result.match(/data: (.+)\n\n/);
    expect(dataMatch).toBeTruthy();
    expect(() => JSON.parse(dataMatch![1])).not.toThrow();
  });

  it('should handle null data and return valid JSON', () => {
    const result = formatMessage('error', null);
    expect(result).toContain('event: error');
    expect(result).toContain('Unknown error');
    expect(result).toContain('UNKNOWN');

    // Verify it's valid JSON
    const dataMatch = result.match(/data: (.+)\n\n/);
    expect(dataMatch).toBeTruthy();
    expect(() => JSON.parse(dataMatch![1])).not.toThrow();
  });

  it('should handle end event correctly', () => {
    const result = formatMessage('end', { reason: 'completed' });
    expect(result).toContain('event: end');
    expect(result).toContain('reason');
    expect(result).toContain('completed');
  });

  it('should handle error event with message and code', () => {
    const result = formatMessage('error', { message: 'Test error', code: 'TEST_CODE' });
    expect(result).toContain('event: error');
    expect(result).toContain('Test error');
    expect(result).toContain('TEST_CODE');
  });

  it('should always produce valid JSON in data field', () => {
    // Test various edge cases
    const testInputs = [
      undefined,
      null,
      {},
      { nested: { deep: 'value' } },
      [],
      [1, 2, 3],
      '',
      'test',
      0,
      false,
      true,
    ];

    for (const input of testInputs) {
      const result = formatMessage('test', input);
      const dataMatch = result.match(/data: (.+)\n\n/);
      expect(dataMatch).toBeTruthy();

      // Verify JSON parsing doesn't throw
      expect(() => JSON.parse(dataMatch![1])).not.toThrow();
    }
  });
});

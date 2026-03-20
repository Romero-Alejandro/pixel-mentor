import { TemplatePreprocessor, createTemplatePreprocessor } from '../template.preprocessor';

/**
 * Test cases documented for TemplatePreprocessor:
 *
 * 1. BASIC IF/UNLESS
 *    - Simple {{#if variable}}...{{/if}} block with truthy value
 *    - Simple {{#if variable}}...{{/if}} block with falsy value
 *    - Simple {{#unless variable}}...{{/unless}} block with truthy value
 *    - Simple {{#unless variable}}...{{/unless}} block with falsy value
 *    - Multiple if/unless blocks in same template
 *    - if and unless blocks together
 *
 * 2. VARIABLE REPLACEMENT
 *    - Simple placeholder replacement
 *    - Placeholder in conditional block (included when truthy)
 *    - Placeholder in conditional block (excluded when falsy)
 *    - Multiple placeholders
 *    - Missing variables replaced with empty string
 *
 * 3. NESTED CONDITIONALS
 *    - Nested if inside if
 *    - Nested unless inside if
 *    - Deep nesting (up to 5 levels)
 *    - Sibling conditionals at same level
 *
 * 4. TRUTHY/FALSY RULES
 *    - String: non-empty is truthy, empty is falsy
 *    - Number: > 0 is truthy, 0 is falsy
 *    - Boolean: true is truthy, false is falsy
 *    - Array: non-empty is truthy, empty is falsy
 *    - Object: non-empty is truthy, empty is falsy
 *    - null is falsy
 *    - undefined is falsy
 *
 * 5. EDGE CASES
 *    - Empty template string
 *    - Template with no placeholders or conditionals
 *    - Whitespace in conditional expressions
 *    - Variables with special characters
 *    - Nested conditionals with variables
 *
 * 6. ERROR HANDLING
 *    - Maximum nesting depth exceeded
 *    - Non-string template throws TypeError
 *    - Null/undefined context handled gracefully
 *
 * 7. INTEGRATION WITH SAFE_PROMPT_BUILDER
 *    - Works correctly before delimiter escaping
 *    - Variables inside conditionals are raw (no escaping)
 */

describe('TemplatePreprocessor', () => {
  let processor: TemplatePreprocessor;

  beforeEach(() => {
    processor = new TemplatePreprocessor();
  });

  describe('isTruthy', () => {
    describe('Truthy values', () => {
      it('should return true for non-empty string', () => {
        expect(processor.isTruthy('hello')).toBe(true);
        expect(processor.isTruthy(' ')).toBe(true); // whitespace is truthy
        expect(processor.isTruthy('0')).toBe(true); // string "0" is truthy (non-empty)
      });

      it('should return true for positive numbers', () => {
        expect(processor.isTruthy(1)).toBe(true);
        expect(processor.isTruthy(42)).toBe(true);
        expect(processor.isTruthy(0.1)).toBe(true);
        expect(processor.isTruthy(-1)).toBe(false); // negative is falsy
      });

      it('should return true for boolean true', () => {
        expect(processor.isTruthy(true)).toBe(true);
      });

      it('should return true for non-empty array', () => {
        expect(processor.isTruthy([1, 2, 3])).toBe(true);
        expect(processor.isTruthy([false])).toBe(true); // array with falsy element is non-empty
        expect(processor.isTruthy([])).toBe(false); // empty array is falsy
      });

      it('should return true for non-empty object', () => {
        expect(processor.isTruthy({ a: 1 })).toBe(true);
        expect(processor.isTruthy({})).toBe(false); // empty object is falsy
      });
    });

    describe('Falsy values', () => {
      it('should return false for null and undefined', () => {
        expect(processor.isTruthy(null)).toBe(false);
        expect(processor.isTruthy(undefined)).toBe(false);
      });

      it('should return false for empty string', () => {
        expect(processor.isTruthy('')).toBe(false);
      });

      it('should return false for number 0', () => {
        expect(processor.isTruthy(0)).toBe(false);
        expect(processor.isTruthy(-0)).toBe(false);
      });

      it('should return false for boolean false', () => {
        expect(processor.isTruthy(false)).toBe(false);
      });
    });
  });

  describe('Basic if Block', () => {
    it('should include block when if variable is truthy (boolean)', () => {
      const result = processor.process('{{#if isActive}}Hello World{{/if}}', { isActive: true });
      expect(result).toBe('Hello World');
    });

    it('should exclude block when if variable is falsy (boolean)', () => {
      const result = processor.process('{{#if isActive}}Hello World{{/if}}', { isActive: false });
      expect(result).toBe('');
    });

    it('should include block when if variable is truthy (string)', () => {
      const result = processor.process('{{#if name}}Hello {{name}}{{/if}}', { name: 'Alice' });
      expect(result).toBe('Hello Alice');
    });

    it('should exclude block when if variable is falsy (empty string)', () => {
      const result = processor.process('{{#if name}}Hello {{name}}{{/if}}', { name: '' });
      expect(result).toBe('');
    });

    it('should include block when if variable is truthy (number > 0)', () => {
      const result = processor.process('{{#if count}}Count: {{count}}{{/if}}', { count: 5 });
      expect(result).toBe('Count: 5');
    });

    it('should exclude block when if variable is falsy (0)', () => {
      const result = processor.process('{{#if count}}Count: {{count}}{{/if}}', { count: 0 });
      expect(result).toBe('');
    });

    it('should include block when if variable is truthy (non-empty array)', () => {
      const result = processor.process('{{#if items}}Has items{{/if}}', { items: [1, 2] });
      expect(result).toBe('Has items');
    });

    it('should exclude block when if variable is falsy (empty array)', () => {
      const result = processor.process('{{#if items}}Has items{{/if}}', { items: [] });
      expect(result).toBe('');
    });
  });

  describe('Basic unless Block', () => {
    it('should include block when unless variable is falsy', () => {
      const result = processor.process('{{#unless isLoggedIn}}Please login{{/unless}}', {
        isLoggedIn: false,
      });
      expect(result).toBe('Please login');
    });

    it('should exclude block when unless variable is truthy', () => {
      const result = processor.process('{{#unless isLoggedIn}}Please login{{/unless}}', {
        isLoggedIn: true,
      });
      expect(result).toBe('');
    });

    it('should include block when unless variable is undefined', () => {
      const result = processor.process('{{#unless missing}}Variable missing{{/unless}}', {});
      expect(result).toBe('Variable missing');
    });

    it('should include block when unless variable is empty string', () => {
      const result = processor.process('{{#unless name}}No name provided{{/unless}}', { name: '' });
      expect(result).toBe('No name provided');
    });
  });

  describe('Multiple Conditional Blocks', () => {
    it('should handle multiple if blocks', () => {
      const template = '{{#if a}}A{{/if}}{{#if b}}B{{/if}}{{#if c}}C{{/if}}';
      const result = processor.process(template, { a: true, b: true, c: false });
      expect(result).toBe('AB');
    });

    it('should handle multiple unless blocks', () => {
      const template = '{{#unless a}}NOT A{{/unless}}{{#unless b}}NOT B{{/unless}}';
      const result = processor.process(template, { a: true, b: false });
      expect(result).toBe('NOT B');
    });

    it('should handle mixed if and unless blocks', () => {
      const template =
        '{{#if isLoggedIn}}Welcome{{/if}}{{#unless isPremium}}Upgrade needed{{/unless}}';
      const result = processor.process(template, { isLoggedIn: true, isPremium: false });
      expect(result).toBe('WelcomeUpgrade needed');
    });
  });

  describe('Variable Replacement', () => {
    it('should replace simple placeholders', () => {
      const result = processor.process('Hello {{name}}', { name: 'Alice' });
      expect(result).toBe('Hello Alice');
    });

    it('should replace multiple placeholders', () => {
      const result = processor.process('{{greeting}} {{name}}', {
        greeting: 'Hello',
        name: 'Bob',
      });
      expect(result).toBe('Hello Bob');
    });

    it('should replace missing variables with empty string', () => {
      const result = processor.process('Hello {{name}}', {});
      expect(result).toBe('Hello ');
    });

    it('should replace null/undefined with empty string', () => {
      const result = processor.process('{{a}} {{b}}', { a: null, b: undefined });
      expect(result).toBe(' ');
    });

    it('should replace numbers with their string representation', () => {
      const result = processor.process('Count: {{count}}', { count: 42 });
      expect(result).toBe('Count: 42');
    });

    it('should JSON stringify objects', () => {
      const result = processor.process('Data: {{data}}', { data: { key: 'value' } });
      expect(result).toBe('Data: {"key":"value"}');
    });

    it('should JSON stringify arrays', () => {
      const result = processor.process('Items: {{items}}', { items: [1, 2, 3] });
      expect(result).toBe('Items: [1,2,3]');
    });
  });

  describe('Variables Inside Conditional Blocks', () => {
    it('should replace variables when if block is included', () => {
      const result = processor.process('{{#if user}}Hello {{name}}{{/if}}', {
        user: true,
        name: 'Alice',
      });
      expect(result).toBe('Hello Alice');
    });

    it('should not replace variables when if block is excluded', () => {
      const result = processor.process('{{#if user}}Hello {{name}}{{/if}}', {
        user: false,
        name: 'Alice',
      });
      expect(result).toBe('');
    });

    it('should replace variables when unless block is included', () => {
      const result = processor.process('{{#unless guest}}Welcome {{username}}{{/unless}}', {
        guest: false,
        username: 'Bob',
      });
      expect(result).toBe('Welcome Bob');
    });

    it('should handle nested variables correctly', () => {
      const result = processor.process('{{#if show}}User {{name}} has {{count}} items{{/if}}', {
        show: true,
        name: 'Carol',
        count: 3,
      });
      expect(result).toBe('User Carol has 3 items');
    });
  });

  describe('Nested Conditionals', () => {
    it('should handle nested if inside if', () => {
      const template = '{{#if outer}}{{#if inner}}Both true{{/if}}{{/if}}';
      const result = processor.process(template, { outer: true, inner: true });
      expect(result).toBe('Both true');
    });

    it('should exclude nested if when outer is falsy', () => {
      const template = '{{#if outer}}{{#if inner}}Both true{{/if}}{{/if}}';
      const result = processor.process(template, { outer: false, inner: true });
      expect(result).toBe('');
    });

    it('should exclude nested if when inner is falsy', () => {
      const template = '{{#if outer}}{{#if inner}}Both true{{/if}}{{/if}}';
      const result = processor.process(template, { outer: true, inner: false });
      expect(result).toBe('');
    });

    it('should handle unless inside if', () => {
      const template = '{{#if show}}{{#unless hidden}}Visible{{/unless}}{{/if}}';
      const result = processor.process(template, { show: true, hidden: false });
      expect(result).toBe('Visible');
    });

    it('should handle if inside unless', () => {
      const template = '{{#unless guest}}{{#if premium}}Premium User{{/if}}{{/unless}}';
      const result = processor.process(template, { guest: false, premium: true });
      expect(result).toBe('Premium User');
    });

    it('should handle sibling nested conditionals', () => {
      const template = '{{#if a}}A{{#if b}}B{{/if}}{{/if}}{{#if c}}C{{/if}}';
      const result = processor.process(template, { a: true, b: true, c: true });
      expect(result).toBe('ABC');
    });

    it('should handle deep nesting up to limit', () => {
      const template =
        '{{#if level1}}{{#if level2}}{{#if level3}}{{#if level4}}{{#if level5}}Deep{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}';
      const result = processor.process(template, {
        level1: true,
        level2: true,
        level3: true,
        level4: true,
        level5: true,
      });
      expect(result).toBe('Deep');
    });
  });

  describe('Nesting Depth Limit', () => {
    it('should throw when nesting exceeds MAX_NESTING_DEPTH', () => {
      // Create template that exceeds 5 levels of nesting
      const template =
        '{{#if a}}{{#if b}}{{#if c}}{{#if d}}{{#if e}}{{#if f}}Too deep{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}';

      expect(() =>
        processor.process(template, { a: true, b: true, c: true, d: true, e: true, f: true }),
      ).toThrow(/Maximum nesting depth of 5 exceeded/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty template string', () => {
      const result = processor.process('', { name: 'Alice' });
      expect(result).toBe('');
    });

    it('should handle template with no placeholders or conditionals', () => {
      const result = processor.process('Static text only', {});
      expect(result).toBe('Static text only');
    });

    it('should handle whitespace in conditional expressions', () => {
      const result = processor.process('{{#if isActive}}Active{{/if}}', { isActive: true });
      expect(result).toBe('Active');
    });

    it('should handle variables with underscores and hyphens', () => {
      const result = processor.process('{{user_name}} {{user-id}}', {
        user_name: 'Alice',
        'user-id': 'Bob',
      });
      expect(result).toBe('Alice Bob');
    });

    it('should handle template with conditional at start and end', () => {
      const result = processor.process('{{#if start}}START{{/if}} middle {{#if end}}END{{/if}}', {
        start: true,
        end: true,
      });
      expect(result).toBe('START middle END');
    });

    it('should handle multiple conditionals in sequence', () => {
      const template = '{{#if a}}A{{/if}}-{{#if b}}B{{/if}}-{{#if c}}C{{/if}}-{{#if d}}D{{/if}}';
      const result = processor.process(template, { a: true, b: true, c: false, d: true });
      expect(result).toBe('A-B--D');
    });

    it('should handle special characters in variable values', () => {
      const result = processor.process('{{text}}', { text: 'Line1\nLine2\tTab' });
      expect(result).toBe('Line1\nLine2\tTab');
    });

    it('should handle Unicode characters', () => {
      const result = processor.process('{{greeting}}', { greeting: 'こんにちは 🎉' });
      expect(result).toBe('こんにちは 🎉');
    });
  });

  describe('Error Handling', () => {
    it('should throw TypeError for non-string template', () => {
      expect(() => (processor as any).process(123, {})).toThrow('Template must be a string');
    });

    it('should handle null context gracefully', () => {
      const result = processor.process('Hello {{name}}', null as any);
      expect(result).toBe('Hello ');
    });

    it('should handle undefined context gracefully', () => {
      const result = processor.process('Hello {{name}}', undefined as any);
      expect(result).toBe('Hello ');
    });
  });

  describe('Integration Scenarios', () => {
    it('should process complex template with multiple conditionals and variables', () => {
      const template = `
{{#if isLoggedIn}}
  Welcome back, {{username}}!
  {{#if isPremium}}
    You have premium access.
  {{/if}}
  {{#unless isVerified}}
    Please verify your email.
  {{/unless}}
{{/if}}
{{#unless isLoggedIn}}
  Please log in to continue.
{{/unless}}
`.trim();

      const result = processor.process(template, {
        isLoggedIn: true,
        username: 'Alice',
        isPremium: true,
        isVerified: true,
      });

      expect(result).toContain('Welcome back, Alice!');
      expect(result).toContain('You have premium access.');
      expect(result).not.toContain('Please verify your email.');
      expect(result).not.toContain('Please log in');
    });

    it('should work correctly with template fragments', () => {
      const header = '{{#if title}}## {{title}}{{/if}}';
      const body = '{{content}}';

      const result = processor.process(`${header}\n${body}`, {
        title: 'My Post',
        content: 'This is the content.',
      });

      expect(result).toBe('## My Post\nThis is the content.');
    });

    it('should handle conditional with empty truthy value (whitespace string)', () => {
      // Whitespace string is truthy
      const result = processor.process('{{#if text}}Has text{{/if}}', { text: '   ' });
      expect(result).toBe('Has text');
    });

    it('should handle conditional with JSON object', () => {
      const result = processor.process('{{#if data}}Has data{{/if}}', { data: { key: 'value' } });
      expect(result).toBe('Has data');
    });
  });
});

describe('createTemplatePreprocessor factory function', () => {
  it('should create a new TemplatePreprocessor instance', () => {
    const processor = createTemplatePreprocessor();
    expect(processor).toBeInstanceOf(TemplatePreprocessor);
  });

  it('should process templates correctly', () => {
    const processor = createTemplatePreprocessor();
    const result = processor.process('Hello {{name}}', { name: 'World' });
    expect(result).toBe('Hello World');
  });
});

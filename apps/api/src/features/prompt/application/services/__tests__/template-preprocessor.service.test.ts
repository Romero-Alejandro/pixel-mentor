import {
  TemplatePreprocessor,
  createTemplatePreprocessor,
} from '@/features/prompt/application/services/template-preprocessor.service.js';

describe('TemplatePreprocessor', () => {
  const processor = new TemplatePreprocessor();

  describe('isTruthy', () => {
    it('treats null, undefined, empty string, zero, false, empty array and empty object as falsy', () => {
      for (const value of [null, undefined, '', 0, false, [], {}]) {
        expect(processor.isTruthy(value)).toBe(false);
      }
    });

    it('treats non-empty strings, positive numbers, true, non-empty arrays and objects as truthy', () => {
      for (const value of ['x', 1, true, [0], { a: 1 }]) {
        expect(processor.isTruthy(value)).toBe(true);
      }
    });

    it('treats a negative number as falsy, because the rule is "greater than zero"', () => {
      expect(processor.isTruthy(-1)).toBe(false);
      expect(processor.isTruthy(-0.5)).toBe(false);
    });
  });

  describe('input validation', () => {
    it('rejects a non-string template', () => {
      expect(() => processor.process(42 as unknown as string, {})).toThrow(TypeError);
    });

    it('returns an empty template untouched', () => {
      expect(processor.process('', { a: 1 })).toBe('');
    });

    it('treats a null context as empty instead of crashing', () => {
      expect(processor.process('Hello {{name}}', null as unknown as Record<string, unknown>)).toBe(
        'Hello ',
      );
    });
  });

  describe('conditionals', () => {
    it('includes an if block when the variable is truthy', () => {
      const result = processor.process('{{#if user}}Welcome {{name}}{{/if}}', {
        user: true,
        name: 'Ana',
      });

      expect(result).toBe('Welcome Ana');
    });

    it('drops an if block when the variable is falsy', () => {
      const result = processor.process('A{{#if user}}hidden{{/if}}B', { user: false });

      expect(result).toBe('AB');
    });

    it('drops an if block when the variable is missing', () => {
      expect(processor.process('A{{#if missing}}hidden{{/if}}B', {})).toBe('AB');
    });

    it('includes an unless block when the variable is falsy', () => {
      const result = processor.process('{{#unless user}}Guest{{/unless}}', { user: '' });

      expect(result).toBe('Guest');
    });

    it('drops an unless block when the variable is truthy', () => {
      expect(processor.process('A{{#unless user}}Guest{{/unless}}B', { user: 'Ana' })).toBe('AB');
    });

    it('processes nested conditionals that are both truthy', () => {
      const result = processor.process('{{#if a}}{{#if b}}both{{/if}}{{/if}}', {
        a: true,
        b: true,
      });

      expect(result).toBe('both');
    });

    it('keeps outer content when only the inner conditional fails', () => {
      const result = processor.process('{{#if a}}outer{{#if b}}inner{{/if}}{{/if}}', {
        a: true,
        b: false,
      });

      expect(result).toBe('outer');
    });

    it('handles five levels of nesting', () => {
      const template =
        '{{#if a}}{{#if a}}{{#if a}}{{#if a}}{{#if a}}deep{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}';

      expect(processor.process(template, { a: true })).toBe('deep');
    });

    it('throws beyond the documented nesting limit instead of overflowing the stack', () => {
      const template =
        '{{#if a}}{{#if a}}{{#if a}}{{#if a}}{{#if a}}{{#if a}}too deep{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}';

      expect(() => processor.process(template, { a: true })).toThrow(
        /Maximum nesting depth of 5 exceeded/,
      );
    });
  });

  describe('placeholder replacement', () => {
    it('replaces a placeholder with its string value', () => {
      expect(processor.process('Hello {{name}}', { name: 'Ana' })).toBe('Hello Ana');
    });

    it('renders a missing variable as an empty string', () => {
      expect(processor.process('Hello {{name}}!', {})).toBe('Hello !');
    });

    it('renders numbers and booleans as text', () => {
      expect(processor.process('{{zero}} {{one}} {{yes}}', { zero: 0, one: 1, yes: true })).toBe(
        '0 1 true',
      );
    });

    it('serializes arrays and objects as JSON', () => {
      expect(processor.process('{{list}} {{obj}}', { list: ['a'], obj: { k: 1 } })).toBe(
        '["a"] {"k":1}',
      );
    });

    it('replaces every occurrence of the same placeholder', () => {
      expect(processor.process('{{name}}-{{name}}', { name: 'Ana' })).toBe('Ana-Ana');
    });

    it('leaves an unclosed tag as literal text', () => {
      expect(processor.process('Hello {{name', { name: 'Ana' })).toBe('Hello {{name');
    });

    it('leaves an unknown tag as literal text', () => {
      expect(processor.process('{{#each items}}x{{/each}}', { items: [1] })).toBe(
        '{{#each items}}x{{/each}}',
      );
    });
  });

  describe('factory', () => {
    it('createTemplatePreprocessor returns a working processor', () => {
      expect(createTemplatePreprocessor().process('{{a}}', { a: 'ok' })).toBe('ok');
    });
  });
});

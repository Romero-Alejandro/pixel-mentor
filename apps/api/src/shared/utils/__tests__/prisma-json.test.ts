import { Prisma } from '@/database/client.js';
import {
  toPrismaJson,
  toPrismaJsonRequired,
  toPrismaJsonOrUndefined,
  toPrismaJsonRequiredOrUndefined,
} from '@/shared/utils/prisma-json.js';

describe('prisma-json helpers', () => {
  describe('toPrismaJson (nullable columns)', () => {
    it('maps undefined to DbNull (clear the column)', () => {
      expect(toPrismaJson(undefined, 'f')).toBe(Prisma.DbNull);
    });

    it('maps null to JsonNull (explicit SQL NULL)', () => {
      expect(toPrismaJson(null, 'f')).toBe(Prisma.JsonNull);
    });

    it('passes JSON primitives through', () => {
      expect(toPrismaJson('text', 'f')).toBe('text');
      expect(toPrismaJson(42, 'f')).toBe(42);
      expect(toPrismaJson(true, 'f')).toBe(true);
    });

    it('round-trips objects and arrays into plain JSON structures', () => {
      const payload = { text: 'hola', duration: 5, nested: { a: [1, 2] } };
      expect(toPrismaJson(payload, 'f')).toEqual(payload);

      const arr = [{ text: 'x' }];
      expect(toPrismaJson(arr, 'f')).toEqual(arr);
    });

    it('strips prototype-backed and #private class state down to plain JSON data', () => {
      class VO {
        readonly #v: string;
        constructor(v: string) {
          this.#v = v;
        }
        get value(): string {
          return this.#v;
        }
      }
      // #fields are not enumerable own properties and getters live on the
      // prototype, so the round-trip reduces the VO to `{}` — loud proof that
      // passing a VO-shaped payload here would silently lose its data.
      const result = toPrismaJson({ wrapped: new VO('abc') }, 'f');
      expect(result).toEqual({ wrapped: {} });
    });

    it('drops function values during the round-trip', () => {
      expect(toPrismaJson({ fn: () => 1 }, 'f')).toEqual({});
    });

    it('throws for non-JSON-representable top-level values', () => {
      expect(() => toPrismaJson(() => 1, 'field')).toThrow(/field/);
    });
  });

  describe('toPrismaJsonRequired (required NOT NULL columns)', () => {
    it('throws on undefined and null instead of writing a silent SQL NULL', () => {
      expect(() => toPrismaJsonRequired(undefined, 'req')).toThrow(/req/);
      expect(() => toPrismaJsonRequired(null, 'req')).toThrow(/req/);
    });

    it('validates the payload like the nullable variant', () => {
      const payload = { correct: 'ok', incorrect: 'no', partial: 'meh' };
      expect(toPrismaJsonRequired(payload, 'req')).toEqual(payload);
      expect(() => toPrismaJsonRequired(() => 1, 'req')).toThrow(/req/);
    });
  });

  describe('toPrismaJsonOrUndefined (partial update, nullable column)', () => {
    it('returns undefined for undefined so the key is omitted', () => {
      expect(toPrismaJsonOrUndefined(undefined, 'f')).toBeUndefined();
    });

    it('delegates to toPrismaJson otherwise', () => {
      expect(toPrismaJsonOrUndefined(null, 'f')).toBe(Prisma.JsonNull);
      expect(toPrismaJsonOrUndefined({ a: 1 }, 'f')).toEqual({ a: 1 });
    });
  });

  describe('toPrismaJsonRequiredOrUndefined (partial update, NOT NULL column)', () => {
    it('returns undefined for undefined so the key is omitted', () => {
      expect(toPrismaJsonRequiredOrUndefined(undefined, 'req')).toBeUndefined();
    });

    it('throws on null: a NOT NULL column cannot store SQL NULL', () => {
      expect(() => toPrismaJsonRequiredOrUndefined(null, 'req')).toThrow(/NOT NULL/);
    });

    it('validates real payloads', () => {
      expect(toPrismaJsonRequiredOrUndefined({ text: 'x' }, 'req')).toEqual({ text: 'x' });
    });
  });
});

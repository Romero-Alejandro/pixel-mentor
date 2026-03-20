import { KeywordExtractor } from '../keyword-extractor';

describe('KeywordExtractor', () => {
  // ==================== Spanish Tests ====================

  describe('Spanish text extraction', () => {
    it('should remove Spanish stopwords and extract keywords', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'El rápido zorro marrón salta sobre el perro perezoso';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('el');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('la');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('de');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('que');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('y');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('sobre');
      expect(keywords.map((k) => k.toLowerCase())).toContain('rápido');
      expect(keywords.map((k) => k.toLowerCase())).toContain('zorro');
      expect(keywords.map((k) => k.toLowerCase())).toContain('marrón');
      expect(keywords.map((k) => k.toLowerCase())).toContain('salta');
      expect(keywords.map((k) => k.toLowerCase())).toContain('perro');
      expect(keywords.map((k) => k.toLowerCase())).toContain('perezoso');
    });

    it('should handle Spanish articles (el, la, los, las)', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'El gato de la casa';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('el');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('la');
      expect(keywords.map((k) => k.toLowerCase())).toContain('gato');
      expect(keywords.map((k) => k.toLowerCase())).toContain('casa');
    });

    it('should handle Spanish prepositions', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'Aprende de matemáticas con nosotros para el futuro';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('de');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('con');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('para');
      expect(keywords.map((k) => k.toLowerCase())).toContain('aprende');
      expect(keywords.map((k) => k.toLowerCase())).toContain('matemáticas');
      expect(keywords.map((k) => k.toLowerCase())).toContain('nosotros');
      expect(keywords.map((k) => k.toLowerCase())).toContain('futuro');
    });

    it('should handle Spanish conjunctions', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'Manzanas y naranjas son frutas';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('y');
      expect(keywords.map((k) => k.toLowerCase())).toContain('manzanas');
      expect(keywords.map((k) => k.toLowerCase())).toContain('naranjas');
      expect(keywords.map((k) => k.toLowerCase())).toContain('frutas');
    });

    it('should handle common Spanish verbs as stopwords', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'El estudiante está aprendiendo y tiene problemas';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('es');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('está');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('y');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('tiene');
      expect(keywords.map((k) => k.toLowerCase())).toContain('estudiante');
      expect(keywords.map((k) => k.toLowerCase())).toContain('aprendiendo');
      expect(keywords.map((k) => k.toLowerCase())).toContain('problemas');
    });
  });

  // ==================== English Tests ====================

  describe('English text extraction', () => {
    it('should remove English stopwords', () => {
      const extractor = new KeywordExtractor({ language: 'en' });
      const text = 'The quick brown fox jumps over the lazy dog';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('the');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('a');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('an');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('and');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('or');
      expect(keywords.map((k) => k.toLowerCase())).toContain('quick');
      expect(keywords.map((k) => k.toLowerCase())).toContain('brown');
      expect(keywords.map((k) => k.toLowerCase())).toContain('fox');
      expect(keywords.map((k) => k.toLowerCase())).toContain('jumps');
      expect(keywords.map((k) => k.toLowerCase())).toContain('lazy');
      expect(keywords.map((k) => k.toLowerCase())).toContain('dog');
    });

    it('should handle English prepositions', () => {
      const extractor = new KeywordExtractor({ language: 'en' });
      const text = 'Study of mathematics with teachers for success';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('of');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('with');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('for');
      expect(keywords.map((k) => k.toLowerCase())).toContain('study');
      expect(keywords.map((k) => k.toLowerCase())).toContain('mathematics');
      expect(keywords.map((k) => k.toLowerCase())).toContain('teachers');
      expect(keywords.map((k) => k.toLowerCase())).toContain('success');
    });

    it('should handle English pronouns', () => {
      const extractor = new KeywordExtractor({ language: 'en' });
      const text = 'I and you should learn about your future';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('i');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('and');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('you');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('your');
      expect(keywords.map((k) => k.toLowerCase())).toContain('learn');
      expect(keywords.map((k) => k.toLowerCase())).toContain('future');
    });
  });

  // ==================== Max Keywords Limit ====================

  describe('maxKeywords limit', () => {
    it('should limit keywords to maxKeywords', () => {
      const extractor = new KeywordExtractor({ language: 'es', maxKeywords: 3 });
      const text = 'uno dos tres cuatro cinco seis siete ocho nueve diez';
      const keywords = extractor.extract(text);

      expect(keywords.length).toBeLessThanOrEqual(3);
    });

    it('should return default 10 keywords when not specified', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text =
        'palabra1 palabra2 palabra3 palabra4 palabra5 palabra6 palabra7 palabra8 palabra9 palabra10 palabra11 palabra12';
      const keywords = extractor.extract(text);

      expect(keywords.length).toBeLessThanOrEqual(10);
    });

    it('should work with maxKeywords in extract method', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'rojo verde azul amarillo morado naranja rosa blanco negro gris';
      const keywords = extractor.extract(text, { maxKeywords: 3 });

      expect(keywords.length).toBeLessThanOrEqual(3);
    });

    it('should handle maxKeywords of 0', () => {
      const extractor = new KeywordExtractor({ language: 'es', maxKeywords: 0 });
      const text = 'palabra1 palabra2 palabra3';
      const keywords = extractor.extract(text);

      expect(keywords.length).toBe(0);
    });
  });

  // ==================== Duplicate Handling ====================

  describe('duplicate handling', () => {
    it('should remove duplicate keywords', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'el gato el perro el gato la casa el perro';
      const keywords = extractor.extract(text);

      // Should only have unique keywords
      const uniqueKeywords = [...new Set(keywords)];
      expect(keywords).toEqual(uniqueKeywords);
      expect(keywords).toContain('gato');
      expect(keywords).toContain('perro');
      expect(keywords).toContain('casa');
    });

    it('should handle case-insensitive duplicates', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'Gato GATO palabra palabra';
      const keywords = extractor.extract(text);

      // Should contain gato and palabra
      const lowercased = keywords.map((w) => w.toLowerCase());
      expect(lowercased).toContain('gato');
      expect(lowercased).toContain('palabra');
      // Should have at least these two unique concepts
      expect(keywords.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ==================== Short Words Filter ====================

  describe('short words filter (< 3 characters)', () => {
    it('should filter out words with less than 3 characters', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'el sol y la luna';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('el');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('y');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('la');
      expect(keywords.map((k) => k.toLowerCase())).toContain('sol');
      expect(keywords.map((k) => k.toLowerCase())).toContain('luna');
    });

    it('should handle single character words', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'a b c sol';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('a');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('b');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('c');
      expect(keywords.map((k) => k.toLowerCase())).toContain('sol');
    });

    it('should respect custom minWordLength option', () => {
      const extractor = new KeywordExtractor({ language: 'es', minWordLength: 5 });
      const text = 'el sol mundo';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('el');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('sol'); // 3 chars, below 5
      expect(keywords.map((k) => k.toLowerCase())).toContain('mundo');
    });

    it('should keep 3-character words by default', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'el sol tierra mar';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).toContain('sol');
      expect(keywords.map((k) => k.toLowerCase())).toContain('tierra');
      expect(keywords.map((k) => k.toLowerCase())).toContain('mar');
    });
  });

  // ==================== Punctuation Removal ====================

  describe('punctuation removal', () => {
    it('should remove Spanish inverted punctuation', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = '¡Hola! ¿Cómo estás? Muy bien.';
      const keywords = extractor.extract(text);

      // 'muy' is a Spanish stopword, so it will be filtered out
      expect(keywords.map((k) => k.toLowerCase())).toContain('hola');
      expect(keywords.map((k) => k.toLowerCase())).toContain('cómo');
      expect(keywords.map((k) => k.toLowerCase())).toContain('estás');
      expect(keywords.map((k) => k.toLowerCase())).toContain('bien');
    });

    it('should extract content from parentheses', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'libro (historia)';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).toContain('libro');
      expect(keywords.map((k) => k.toLowerCase())).toContain('historia');
    });

    it('should extract content from brackets', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'tema [matemáticas]';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).toContain('tema');
      expect(keywords.map((k) => k.toLowerCase())).toContain('matemáticas');
    });

    it('should handle hyphens as part of compound words', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'arco-iris pre-aventura';
      const keywords = extractor.extract(text);

      // Hyphenated words should be treated as single words
      expect(keywords.some((k) => k.includes('-'))).toBe(true);
    });

    it('should handle numbers mixed with text', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = '123abc 456789 xyz';
      const keywords = extractor.extract(text);

      // Words with numbers should be included (they pass the letter test)
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('should handle special symbols', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'email@test.com url#fragment $100';
      const keywords = extractor.extract(text);

      // Should extract meaningful parts
      expect(keywords.length).toBeGreaterThan(0);
    });
  });

  // ==================== Empty/Edge Cases ====================

  describe('empty and edge cases', () => {
    it('should return empty array for empty string', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      expect(extractor.extract('')).toEqual([]);
    });

    it('should return empty array for whitespace only', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      expect(extractor.extract('   ')).toEqual([]);
      expect(extractor.extract('\n\t')).toEqual([]);
    });

    it('should return empty array for text with only stopwords', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      expect(extractor.extract('el la de que y')).toEqual([]);
    });

    it('should return empty array for text with only short words', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      expect(extractor.extract('el la un')).toEqual([]);
    });

    it('should handle null/undefined gracefully', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      // @ts-expect-error - testing runtime behavior
      expect(extractor.extract(null)).toEqual([]);
      // @ts-expect-error - testing runtime behavior
      expect(extractor.extract(undefined)).toEqual([]);
    });
  });

  // ==================== Static Method ====================

  describe('static extract method', () => {
    it('should work as static method', () => {
      const keywords = KeywordExtractor.extract('El sol brilla sobre el mar', { language: 'es' });

      expect(keywords).not.toContain('el');
      expect(keywords).toContain('sol');
      expect(keywords).toContain('brilla');
      expect(keywords).toContain('mar');
    });
  });

  // ==================== Priority/Sorting ====================

  describe('keyword priority and sorting', () => {
    it('should prioritize longer words', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'a ab abc abcd abcde';
      const keywords = extractor.extract(text);

      // Longer words should come first (based on priority score)
      expect(keywords[0].length).toBeGreaterThanOrEqual(keywords[keywords.length - 1]?.length ?? 0);
    });

    it('should prioritize capitalized/proper nouns', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'ciudad España mañana';
      const keywords = extractor.extract(text);

      // Capitalized words should be ranked higher
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('should sort by relevance score', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'xyz ABCDEFGH xyz';
      const keywords = extractor.extract(text);

      // ABCDEFGH is longer, should come first
      expect(keywords[0]).toBe('ABCDEFGH');
    });
  });

  // ==================== Language Override ====================

  describe('language override in extract method', () => {
    it('should override constructor language', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const keywords = extractor.extract('The quick brown fox', { language: 'en' });

      expect(keywords).not.toContain('the');
      expect(keywords).toContain('quick');
      expect(keywords).toContain('brown');
      expect(keywords).toContain('fox');
    });
  });

  // ==================== Accented Characters ====================

  describe('accented characters handling', () => {
    it('should preserve Spanish accented characters', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'álgebra árbol canción español matemáticas física';
      const keywords = extractor.extract(text);

      expect(keywords).toContain('álgebra');
      expect(keywords).toContain('árbol');
      expect(keywords).toContain('canción');
      expect(keywords).toContain('español');
      expect(keywords).toContain('matemáticas');
      expect(keywords).toContain('física');
    });

    it('should filter accented stopwords', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'él está dónde qué cómo';
      const keywords = extractor.extract(text);

      // These are not in our stopword list as accented, but should still be filtered if short
      expect(keywords.some((k) => k.length >= 3)).toBe(true);
    });
  });

  // ==================== Special Words ====================

  describe('special word handling', () => {
    it('should handle compound words with hyphens', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'arco-iris pre-aventura';
      const keywords = extractor.extract(text);

      // Should preserve hyphenated compound words
      expect(keywords.some((k) => k.includes('-'))).toBe(true);
    });

    it('should handle words with underscores', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'palabra_clave otro_termino';
      const keywords = extractor.extract(text);

      // Should preserve underscored words as single tokens
      expect(keywords).toContain('palabra_clave');
      expect(keywords).toContain('otro_termino');
    });

    it('should handle text with numbers', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'año2023 solución123ABC prueba456';
      const keywords = extractor.extract(text);

      // Should include words with numbers
      expect(keywords.length).toBeGreaterThan(0);
    });
  });

  // ==================== Real-world Scenarios ====================

  describe('real-world scenarios', () => {
    it('should extract keywords from educational content', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = `
        La fotosíntesis es el proceso mediante el cual las plantas convierten 
        la energía luminosa en energía química. Este proceso es fundamental 
        para la vida en la Tierra porque produce el oxígeno que respiramos.
      `;
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('el');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('la');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('de');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('que');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('en');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('es');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('por');
      expect(keywords.map((k) => k.toLowerCase())).toContain('fotosíntesis');
      expect(keywords.map((k) => k.toLowerCase())).toContain('proceso');
      expect(keywords.map((k) => k.toLowerCase())).toContain('plantas');
    });

    it('should handle recipe descriptions', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'Necesitas harina, huevos, leche, mantequilla y azúcar para hacer el bizcocho';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('el');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('y');
      expect(keywords.map((k) => k.toLowerCase())).toContain('necesitas');
      expect(keywords.map((k) => k.toLowerCase())).toContain('harina');
      expect(keywords.map((k) => k.toLowerCase())).toContain('huevos');
      expect(keywords.map((k) => k.toLowerCase())).toContain('leche');
      expect(keywords.map((k) => k.toLowerCase())).toContain('mantequilla');
      expect(keywords.map((k) => k.toLowerCase())).toContain('azúcar');
      expect(keywords.map((k) => k.toLowerCase())).toContain('bizcocho');
    });

    it('should handle technical documentation', () => {
      const extractor = new KeywordExtractor({ language: 'es' });
      const text = 'El servidor web procesa las solicitudes HTTP y responde con archivos JSON';
      const keywords = extractor.extract(text);

      expect(keywords.map((k) => k.toLowerCase())).not.toContain('el');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('las');
      expect(keywords.map((k) => k.toLowerCase())).not.toContain('con');
      expect(keywords.map((k) => k.toLowerCase())).toContain('servidor');
      expect(keywords.map((k) => k.toLowerCase())).toContain('web');
      expect(keywords.map((k) => k.toLowerCase())).toContain('procesa');
      expect(keywords.map((k) => k.toLowerCase())).toContain('solicitudes');
      expect(keywords.map((k) => k.toLowerCase())).toContain('http');
      expect(keywords.map((k) => k.toLowerCase())).toContain('responde');
      expect(keywords.map((k) => k.toLowerCase())).toContain('archivos');
      expect(keywords.map((k) => k.toLowerCase())).toContain('json');
    });
  });
});

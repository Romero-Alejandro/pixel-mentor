import { splitTextForSynthesis } from '@/features/tts/infrastructure/persistence/tts-factory.js';

describe('splitTextForSynthesis', () => {
  it('should return a single part for short text', () => {
    expect(splitTextForSynthesis('Hola mundo')).toEqual(['Hola mundo']);
  });

  it('should split long text at word boundaries within the limit', () => {
    const text = `${'palabra '.repeat(60).trim()}`;
    const parts = splitTextForSynthesis(text, 200);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(200);
    }
    // No words lost or duplicated: rejoining restores the word sequence.
    expect(parts.join(' ').split(/\s+/)).toEqual(text.split(/\s+/));
  });

  it('should cover the text contiguously so word counts add up', () => {
    const text = `¡Hola! Esta es una prueba más larga para el karaoke. ${'Relleno '.repeat(40)}Fin.`;
    const parts = splitTextForSynthesis(text);
    const total = text.trim().split(/\s+/).length;
    const sum = parts.reduce(
      (acc, part) => acc + (part.trim().length === 0 ? 0 : part.trim().split(/\s+/).length),
      0,
    );
    expect(sum).toBe(total);
  });

  it('should return an empty array for blank text', () => {
    expect(splitTextForSynthesis('   ')).toEqual([]);
  });

  it('should prefer sentence boundaries when packing parts', () => {
    const text = `Primera oración corta. Segunda oración corta. ${'Relleno '.repeat(50)}Tercera oración final.`;
    const parts = splitTextForSynthesis(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(200);
    }
    // Every part boundary (except the last) falls at a sentence terminator,
    // unless it comes from splitting an overlong sentence (full ~200-char
    // parts) or packs short sentences (ends at a terminator by construction).
    for (const part of parts.slice(0, -1)) {
      const endsAtTerminator = /[.!?…;:]$/.test(part);
      const isFull = part.length > 180;
      expect(endsAtTerminator || isFull).toBe(true);
    }
    // Still contiguous.
    expect(parts.join(' ').split(/\s+/)).toEqual(text.trim().split(/\s+/));
  });

  it('should keep short multi-sentence text in a single part', () => {
    expect(splitTextForSynthesis('Hola. Chau.')).toEqual(['Hola. Chau.']);
  });
});

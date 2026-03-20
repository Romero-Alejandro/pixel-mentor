/**
 * Keyword Extraction Utility
 *
 * Pure utility to extract keywords from text when requiredKeywords is empty.
 * Supports Spanish and English text with stopword filtering.
 * No external NLP dependencies - lightweight and fast.
 */

// ==================== Stopwords ====================

const SPANISH_STOPWORDS = new Set([
  // Articles
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  // Prepositions
  'de',
  'del',
  'a',
  'al',
  'en',
  'con',
  'para',
  'por',
  'sin',
  'sobre',
  'entre',
  'hasta',
  'desde',
  'hacia',
  // Conjunctions
  'y',
  'e',
  'o',
  'u',
  'ni',
  'que',
  'pero',
  'sino',
  'aunque',
  // Pronouns
  'se',
  'su',
  'sus',
  'lo',
  'le',
  'les',
  'me',
  'te',
  'nos',
  'os',
  'mi',
  'tu',
  'yo',
  'él',
  'ella',
  // Verbs (common)
  'es',
  'son',
  'está',
  'están',
  'fue',
  'fueron',
  'ser',
  'estar',
  'ser',
  'hay',
  'tener',
  'tiene',
  // Adverbs
  'muy',
  'más',
  'menos',
  'también',
  'así',
  'ya',
  'ahora',
  'aquí',
  'allí',
  'donde',
  'cuando',
  // Other common
  'como',
  'si',
  'no',
  'sí',
  'porque',
  'este',
  'esta',
  'esto',
  'estos',
  'estas',
  'ese',
  'esa',
  'eso',
  'esos',
  'esas',
  'aquel',
  'aquella',
  'aquellos',
  'aquellas',
  'cual',
  'cuales',
  'quien',
  'quienes',
  // Numbers
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  // Misc
  'todo',
  'toda',
  'todos',
  'todas',
  'mismo',
  'misma',
  'mismos',
  'mismas',
  'otro',
  'otra',
  'otros',
  'otras',
  'cada',
  'algún',
  'alguno',
  'algunos',
  'alguna',
  'algunas',
  'ningún',
  'ninguno',
  'ninguna',
  'puede',
  'pueden',
  'hacer',
  'hecho',
  'tiene',
  'tienen',
  // Determiners
  'tan',
  'tanto',
  'tanta',
  'tantos',
  'tantas',
  'cuanto',
  'cuanta',
  'cuantos',
  'cuantas',
]);

const ENGLISH_STOPWORDS = new Set([
  // Articles
  'a',
  'an',
  'the',
  // Prepositions
  'of',
  'in',
  'to',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',
  'as',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'under',
  'again',
  'further',
  'then',
  'once',
  // Conjunctions
  'and',
  'or',
  'but',
  'nor',
  'so',
  'yet',
  'both',
  'either',
  'neither',
  // Pronouns
  'i',
  'me',
  'my',
  'myself',
  'we',
  'our',
  'ours',
  'ourselves',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'he',
  'him',
  'his',
  'himself',
  'she',
  'her',
  'hers',
  'herself',
  'it',
  'its',
  'itself',
  'they',
  'them',
  'their',
  'theirs',
  'themselves',
  // Verbs (common)
  'is',
  'am',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'do',
  'does',
  'did',
  'doing',
  'would',
  'should',
  'could',
  'ought',
  'will',
  'shall',
  'can',
  // Adverbs
  'very',
  'just',
  'still',
  'also',
  'only',
  'even',
  'back',
  'there',
  'here',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  // Other
  'not',
  'no',
  'yes',
  'because',
  'if',
  'than',
  'too',
  'very',
  'just',
  'about',
  'which',
]);

// ==================== Utility Functions ====================

/**
 * Tokenize text into words
 * Handles punctuation removal while preserving word order
 * Note: underscores and hyphens are preserved as they're used in compound words
 */
function tokenize(text: string): string[] {
  // Split on any sequence of whitespace and/or punctuation
  // Underscores and hyphens are NOT in the split pattern to preserve compound_words
  const tokens = text
    .split(/[\s¡!¿?.,;:—–‒()[\]{}'"«»""''#$%&*+/<=>@\\^`{|}~]+/)
    .filter((word) => word.length > 0);
  return tokens;
}

/**
 * Check if word is a valid keyword candidate
 */
function isValidKeyword(word: string, stopwords: Set<string>, minLength: number = 3): boolean {
  const normalized = word.toLowerCase();
  // Must be longer than minLength
  if (normalized.length < minLength) return false;
  // Must not be a stopword
  if (stopwords.has(normalized)) return false;
  // Must contain at least one letter (not just numbers)
  if (!/[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/.test(normalized)) return false;
  return true;
}

/**
 * Calculate word priority score for sorting
 * Higher score = more likely to be a meaningful keyword
 */
function calculatePriority(word: string): number {
  const normalized = word.toLowerCase();
  let score = 0;

  // Prefer longer words (most important heuristic)
  score += normalized.length * 0.5;

  // Capitalized words (potential proper nouns) get a boost
  if (/^[A-ZÁÉÍÓÚÜÑ]/.test(word)) {
    score += 3;
  }

  // Words in title case
  if (/^[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+$/.test(word)) {
    score += 2;
  }

  // Words with numbers mixed in (technical terms, codes)
  if (/\d/.test(word)) {
    score += 1;
  }

  // Words with underscores or hyphens (compound terms)
  if (/_|-/.test(word)) {
    score += 2;
  }

  return score;
}

// ==================== KeywordExtractor Class ====================

export interface KeywordExtractorOptions {
  /** Maximum number of keywords to return (default: 10) */
  maxKeywords?: number;
  /** Language for stopword filtering (default: 'es' for Spanish) */
  language?: 'es' | 'en';
  /** Minimum word length (default: 3) */
  minWordLength?: number;
}

export class KeywordExtractor {
  private readonly maxKeywords: number;
  private readonly language: 'es' | 'en';
  private readonly minWordLength: number;
  private readonly stopwords: Set<string>;

  constructor(options: KeywordExtractorOptions = {}) {
    this.maxKeywords = options.maxKeywords ?? 10;
    this.language = options.language ?? 'es';
    this.minWordLength = options.minWordLength ?? 3;
    this.stopwords = this.language === 'es' ? SPANISH_STOPWORDS : ENGLISH_STOPWORDS;
  }

  /**
   * Extract keywords from text
   *
   * @param text - The input text to extract keywords from
   * @param options - Optional extraction options (overrides constructor options)
   * @returns Array of unique keywords, sorted by relevance
   *
   * @example
   * ```typescript
   * const extractor = new KeywordExtractor({ language: 'es' });
   * const keywords = extractor.extract('El rápido zorro marrón salta sobre el perro lazy');
   * // Returns: ['rápido', 'zorro', 'marrón', 'salta', 'perro']
   * ```
   */
  extract(text: string, options?: KeywordExtractorOptions): string[] {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return [];
    }

    const maxKeywords = options?.maxKeywords ?? this.maxKeywords;
    const language = options?.language ?? this.language;
    const minLength = options?.minWordLength ?? this.minWordLength;
    const stopwords = language === 'es' ? SPANISH_STOPWORDS : ENGLISH_STOPWORDS;

    // Tokenize the text
    const tokens = tokenize(text);

    // Filter and validate keywords
    const validKeywords = tokens.filter((word) => isValidKeyword(word, stopwords, minLength));

    // Remove duplicates while preserving order
    const uniqueKeywords = [...new Set(validKeywords)];

    // Score and sort by relevance
    const scored = uniqueKeywords.map((word) => ({
      word,
      score: calculatePriority(word),
    }));

    scored.sort((a, b) => b.score - a.score);

    // Return top N keywords
    return scored.slice(0, maxKeywords).map((item) => item.word);
  }

  /**
   * Static method for one-off extraction
   *
   * @param text - The input text to extract keywords from
   * @param options - Extraction options
   * @returns Array of unique keywords, sorted by relevance
   */
  static extract(text: string, options?: KeywordExtractorOptions): string[] {
    const extractor = new KeywordExtractor(options);
    return extractor.extract(text, options);
  }
}

// ==================== Exports ====================

export default KeywordExtractor;

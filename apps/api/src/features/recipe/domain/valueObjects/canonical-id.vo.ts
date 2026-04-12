export class CanonicalId {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  get value(): string {
    return this.#value;
  }

  static create(value: string): CanonicalId {
    const sanitized = CanonicalId.sanitize(value);
    if (!sanitized) {
      throw new Error('CanonicalId cannot be empty');
    }
    return new CanonicalId(sanitized);
  }

  static fromTitle(title: string): CanonicalId {
    // First, remove special chars but keep letters in any language (including Unicode)
    // Then normalize and create slug
    const cleaned = title
      .trim()
      // Keep Unicode word characters, spaces, hyphens
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      // Replace multiple spaces/hyphens with single hyphen
      .replace(/[\s_-]+/g, '-')
      // Trim hyphens
      .trim();

    // If after cleaning we have nothing, use a default based on timestamp
    if (!cleaned || cleaned.length < 2) {
      const timestamp = Date.now().toString(36);
      const uniqueSuffix = crypto.randomUUID().slice(0, 8);
      return new CanonicalId(`recipe-${timestamp}-${uniqueSuffix}`);
    }

    const slug = cleaned
      .toLowerCase()
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);

    const uniqueSuffix = crypto.randomUUID().slice(0, 8);
    return new CanonicalId(`${slug}-${uniqueSuffix}`);
  }

  static sanitize(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  toString(): string {
    return this.#value;
  }

  equals(other: CanonicalId): boolean {
    return this.#value === other.#value;
  }
}

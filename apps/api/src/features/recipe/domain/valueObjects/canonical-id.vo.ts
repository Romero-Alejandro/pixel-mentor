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
    const slug = title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
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
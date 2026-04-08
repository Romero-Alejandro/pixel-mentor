export class SemanticVersion {
  readonly #major: number;
  readonly #minor: number;
  readonly #patch: number;

  private constructor(major: number, minor: number, patch: number) {
    this.#major = major;
    this.#minor = minor;
    this.#patch = patch;
  }

  get major(): number {
    return this.#major;
  }

  get minor(): number {
    return this.#minor;
  }

  get patch(): number {
    return this.#patch;
  }

  static parse(value: string): SemanticVersion {
    const parts = value.split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) {
      throw new Error(`Invalid semantic version: ${value}`);
    }
    const [major, minor, patch] = parts;
    if (major < 0 || minor < 0 || patch < 0) {
      throw new Error(`Invalid semantic version: ${value}`);
    }
    return new SemanticVersion(major, minor, patch);
  }

  static create(major: number, minor: number, patch: number): SemanticVersion {
    if (major < 0 || minor < 0 || patch < 0) {
      throw new Error('Version numbers cannot be negative');
    }
    return new SemanticVersion(major, minor, patch);
  }

  static initial(): SemanticVersion {
    return new SemanticVersion(1, 0, 0);
  }

  incrementPatch(): SemanticVersion {
    return new SemanticVersion(this.#major, this.#minor, this.#patch + 1);
  }

  incrementMinor(): SemanticVersion {
    return new SemanticVersion(this.#major, this.#minor + 1, 0);
  }

  incrementMajor(): SemanticVersion {
    return new SemanticVersion(this.#major + 1, 0, 0);
  }

  toString(): string {
    return `${this.#major}.${this.#minor}.${this.#patch}`;
  }

  equals(other: SemanticVersion): boolean {
    return (
      this.#major === other.#major &&
      this.#minor === other.#minor &&
      this.#patch === other.#patch
    );
  }
}
export class ExpectedDuration {
  readonly #minutes: number;

  private constructor(minutes: number) {
    this.#minutes = minutes;
  }

  get minutes(): number {
    return this.#minutes;
  }

  static create(minutes: number): ExpectedDuration {
    if (!Number.isInteger(minutes) || minutes <= 0) {
      throw new Error(`ExpectedDuration must be a positive integer, got: ${minutes}`);
    }
    return new ExpectedDuration(minutes);
  }

  static createOptional(minutes: number | undefined): ExpectedDuration | undefined {
    if (minutes === undefined || minutes === null) {
      return undefined;
    }
    return ExpectedDuration.create(minutes);
  }

  toString(): string {
    return `${this.#minutes} minutes`;
  }

  equals(other: ExpectedDuration): boolean {
    return this.#minutes === other.#minutes;
  }
}

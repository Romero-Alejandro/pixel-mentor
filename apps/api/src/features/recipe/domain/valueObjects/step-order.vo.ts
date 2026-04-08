export class StepOrder {
  readonly #value: number;

  private constructor(value: number) {
    this.#value = value;
  }

  get value(): number {
    return this.#value;
  }

  static create(value: number): StepOrder {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`StepOrder must be a non-negative integer, got: ${value}`);
    }
    return new StepOrder(value);
  }

  static next(currentMax: number): StepOrder {
    return new StepOrder(currentMax + 1);
  }

  toString(): string {
    return String(this.#value);
  }

  equals(other: StepOrder): boolean {
    return this.#value === other.#value;
  }
}
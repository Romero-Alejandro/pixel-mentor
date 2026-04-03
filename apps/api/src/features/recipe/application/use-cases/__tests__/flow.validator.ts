export class FlowValidator {
  private actualFlow: Array<{ stepIndex: number; state: string; studentInput?: string }> = [];
  private expectedFlow: Array<{ stepIndex: number; state: string; studentInput?: string }> = [];
  private currentExpectedIndex = 0;

  recordActualStep(stepIndex: number, state: string, studentInput?: string) {
    this.actualFlow.push({ stepIndex, state, studentInput });
  }

  expectStep(stepIndex: number, state: string, studentInput?: string) {
    this.expectedFlow.push({ stepIndex, state, studentInput });
  }

  validate() {
    if (this.actualFlow.length !== this.expectedFlow.length) {
      throw new Error(
        `Flow length mismatch. Expected ${this.expectedFlow.length}, got ${this.actualFlow.length}.\n` +
          `Expected: ${JSON.stringify(this.expectedFlow, null, 2)}\n` +
          `Actual: ${JSON.stringify(this.actualFlow, null, 2)}`,
      );
    }

    for (let i = 0; i < this.actualFlow.length; i++) {
      const actual = this.actualFlow[i];
      const expected = this.expectedFlow[i];

      if (actual.stepIndex !== expected.stepIndex || actual.state !== expected.state) {
        throw new Error(
          `Flow mismatch at index ${i}.\n` +
            `Expected: ${JSON.stringify(expected)}\n` +
            `Actual: ${JSON.stringify(actual)}`,
        );
      }
    }
  }

  getCurrentExpectedStep(): { stepIndex: number; state: string } | undefined {
    return this.expectedFlow[this.currentExpectedIndex];
  }

  advanceExpectedStep() {
    this.currentExpectedIndex++;
  }
}

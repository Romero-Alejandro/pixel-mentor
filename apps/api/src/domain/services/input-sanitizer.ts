export class InputSanitizer {
  sanitize(input: string): string {
    // Allowlist-based sanitization
    const allowedPattern = /[a-zA-Z0-9\s\.,!?]+/g;
    return input.match(allowedPattern)?.join('') || '';
  }
}

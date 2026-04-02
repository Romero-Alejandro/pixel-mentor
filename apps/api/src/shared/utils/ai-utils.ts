/**
 * AI Utilities
 *
 * Shared utility functions for AI operations including JSON parsing
 * and similarity calculations.
 */

/**
 * Cleans and parses JSON from LLM responses
 * Removes markdown code blocks and trims whitespace
 */
export function cleanJsonResponse(rawText: string): string {
  return (
    rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim() || '{}'
  );
}

/**
 * Calculates cosine similarity between two vectors
 * Used for semantic similarity comparisons
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

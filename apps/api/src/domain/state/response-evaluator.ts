import type { Question } from '@/domain/entities/lesson';

export interface EvaluationResult {
  readonly isCorrect: boolean;
  readonly score: number;
  readonly feedback: string;
  readonly explanation?: string;
}

export function evaluateAnswer(question: Question, studentAnswer: string): EvaluationResult {
  const normalizedAnswer = normalizeText(studentAnswer);
  const normalizedExpected = normalizeText(question.expectedAnswer);

  const similarity = calculateSimilarity(normalizedAnswer, normalizedExpected);

  if (similarity >= 0.8) {
    return {
      isCorrect: true,
      score: 100,
      feedback: '¡Excelente! Has respondido correctamente.',
      explanation: question.feedbackExplanation,
    };
  }

  if (similarity >= 0.5) {
    return {
      isCorrect: false,
      score: 50,
      feedback: '¡Casi lo tienes! Tu respuesta está cerca.',
      explanation: question.feedbackExplanation,
    };
  }

  return {
    isCorrect: false,
    score: 0,
    feedback: 'No es correcto. ¡Inténtalo de nuevo!',
    explanation: question.feedbackExplanation,
  };
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\s\w]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[str1.length][str2.length];
}

export function evaluateMultipleChoice(
  question: Question,
  selectedOption: string,
): EvaluationResult {
  const validOptions = question.multipleChoiceOptions ?? [];
  const isCorrect = validOptions.includes(selectedOption);

  if (isCorrect) {
    return {
      isCorrect: true,
      score: 100,
      feedback: '¡Correcto! Has elegido la respuesta adecuada.',
      explanation: question.feedbackExplanation,
    };
  }

  return {
    isCorrect: false,
    score: 0,
    feedback: 'No es correcto. Intenta de nuevo.',
    explanation: question.feedbackExplanation,
  };
}

export function calculateTotalScore(evaluations: readonly EvaluationResult[]): number {
  if (evaluations.length === 0) return 0;
  const sum = evaluations.reduce((acc, ev) => acc + ev.score, 0);
  return Math.round(sum / evaluations.length);
}

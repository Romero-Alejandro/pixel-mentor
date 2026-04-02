export const EVALUATION_OUTCOME = {
  CONCEPTUALLY_CORRECT: 'conceptually_correct',
  INTUITIVE_CORRECT: 'intuitive_correct',
  PARTIALLY_CORRECT: 'partially_correct',
  RELEVANT_BUT_INCOMPLETE: 'relevant_but_incomplete',
  CONCEPTUAL_ERROR: 'conceptual_error',
  NO_RESPONSE: 'no_response',
} as const;

export type EvaluationOutcome = (typeof EVALUATION_OUTCOME)[keyof typeof EVALUATION_OUTCOME];

export interface ExtractedConcepts {
  readonly ideas: readonly string[];
  readonly languageComplexity: 'simple' | 'moderate' | 'advanced';
  readonly hasAnalogies: boolean;
}

export interface LessonContext {
  readonly subject: string;
  readonly gradeLevel: string;
  readonly topic: string;
}

export interface StudentProfile {
  readonly name?: string;
  readonly learningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
}

export interface TeacherConfig {
  readonly centralTruth: string;
  readonly requiredKeywords: readonly string[];
  readonly exemplars?: Readonly<{
    correct: string[];
    partial: string[];
    incorrect: string[];
  }>;
  readonly maxScore?: number;
}

export interface EvaluationRequest {
  readonly studentAnswer: string;
  readonly questionText: string;
  readonly teacherConfig: TeacherConfig;
  readonly lessonContext: LessonContext;
  readonly studentProfile?: StudentProfile;
}

export interface EvaluationResult {
  readonly outcome: EvaluationOutcome;
  readonly score: number;
  readonly feedback: string;
  readonly improvementSuggestion?: string;
  readonly confidence: number;
}

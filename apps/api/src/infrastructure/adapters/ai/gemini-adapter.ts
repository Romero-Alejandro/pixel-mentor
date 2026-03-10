import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

import type { AIService, GeneratedResponse, PromptParameters } from '@/domain/ports/ai-service';
import { generateWithTimeout, AIGenerationError } from '@/domain/ports/ai-service';
import type { QuestionClassification } from '@/domain/entities/question-classification';
import type {
  ClassificationPayload,
  ComprehensionEvaluation,
  ComprehensionPayload,
} from '@/domain/ports/question-classifier';

const GeminiResponseSchema = z.object({
  voiceText: z.string(),
  pedagogicalState: z.enum(['EXPLANATION', 'QUESTION', 'EVALUATION']),
  feedback: z.string().optional(),
  isCorrect: z.boolean().optional(),
  extraExplanation: z.string().optional(),
  chainOfThought: z.string().optional(),
});

const ClassificationSchema = z.object({
  intent: z.enum(['question', 'answer', 'statement', 'greeting', 'other']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

const ComprehensionSchema = z.object({
  result: z.enum(['correct', 'partial', 'incorrect']),
  confidence: z.number().min(0).max(1),
  hint: z.string().optional(),
  shouldEscalate: z.boolean(),
});

export class GeminiAIModelAdapter implements AIService {
  private client: GoogleGenerativeAI;

  private readonly standardModels = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'];

  private readonly fastModels = [
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash-lite',
    'gemini-2.5-flash',
  ];

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(parameters: PromptParameters): Promise<GeneratedResponse> {
    const systemPrompt = this.buildSystemPrompt(parameters);
    const userPrompt = this.buildUserPrompt(parameters);
    const schemaInstruction = `\nResponde ÚNICAMENTE con un JSON válido usando este esquema exacto:\n{"voiceText": "texto","pedagogicalState": "EXPLANATION" | "QUESTION" | "EVALUATION","feedback": "texto opcional","isCorrect": true,"extraExplanation": "texto opcional","chainOfThought": "razonamiento"}`;
    const fullPrompt = `${systemPrompt}\n\n${userPrompt}${schemaInstruction}`;

    try {
      return await this.executeWithFallback(fullPrompt, GeminiResponseSchema, this.standardModels);
    } catch (error) {
      console.error('[GeminiAdapter] generateResponse error:', error);
      return {
        voiceText: 'Hubo un pequeño problema técnico. ¿Podrías repetir lo que dijiste?',
        pedagogicalState: 'QUESTION',
      };
    }
  }

  async generateExplanation(parameters: {
    lesson: import('@/domain/entities/lesson').Lesson;
    conceptIndex: number;
  }): Promise<GeneratedResponse> {
    const concept = parameters.lesson.concepts[parameters.conceptIndex];
    if (!concept) {
      return {
        voiceText: 'No encontré ese concepto en la lección.',
        pedagogicalState: 'EXPLANATION',
      };
    }

    const schemaInstruction = `\nResponde ÚNICAMENTE en JSON con este esquema:\n{"voiceText": "explicación","pedagogicalState": "EXPLANATION","chainOfThought": "razonamiento"}`;
    const prompt = `Explica el concepto "${concept.title}" de forma amigable, educativa y muy concisa para un niño de 6 a 11 años. El texto será leído por un sintetizador de voz. PROHIBIDO usar emojis, viñetas o caracteres especiales.\n\nTítulo: ${concept.title}\nDescripción: ${concept.description}\n${concept.example ? `Ejemplo: ${concept.example}` : ''}${schemaInstruction}`;

    try {
      return await this.executeWithFallback(prompt, GeminiResponseSchema, this.standardModels);
    } catch (error) {
      console.error('[GeminiAdapter] generateExplanation error:', error);
      return {
        voiceText: `El concepto ${concept.title} es importante. ${concept.description}`,
        pedagogicalState: 'EXPLANATION',
      };
    }
  }

  async evaluateResponse(parameters: {
    question: { text: string; expectedAnswer: string };
    studentAnswer: string;
  }): Promise<GeneratedResponse> {
    const schemaInstruction = `\nResponde ÚNICAMENTE en JSON con este esquema:\n{"voiceText": "retroalimentación","pedagogicalState": "EVALUATION","isCorrect": true/false,"feedback": "texto"}`;
    const prompt = `Evalúa si la respuesta del estudiante es correcta. Sé muy conciso, motivador y puramente auditivo (sin emojis ni caracteres de formato).\n\nPregunta: ${parameters.question.text}\nRespuesta esperada: ${parameters.question.expectedAnswer}\nRespuesta del estudiante: ${parameters.studentAnswer}${schemaInstruction}`;

    try {
      return await this.executeWithFallback(prompt, GeminiResponseSchema, this.standardModels);
    } catch (error) {
      console.error('[GeminiAdapter] evaluateResponse error:', error);
      return {
        voiceText: 'Gracias por tu respuesta. Continuemos.',
        pedagogicalState: 'EVALUATION',
        isCorrect: false,
      };
    }
  }

  async classifyQuestion(payload: ClassificationPayload): Promise<QuestionClassification> {
    const history = payload.lastTurns
      .map((t) => `${t.role === 'user' ? 'Estudiante' : 'Tutor'}: ${t.content}`)
      .join('\n');
    const meta = payload.lessonMetadata
      ? `Lección: ${payload.lessonMetadata.title}\nConceptos: ${payload.lessonMetadata.concepts.join(', ')}`
      : '';
    const schemaInstruction = `\nResponde ÚNICAMENTE en JSON con este esquema:\n{"intent": "question" | "answer" | "statement" | "greeting" | "other","confidence": 0.9,"reasoning": "motivo"}`;
    const prompt = `Clasifica el texto del estudiante.\n\nHistorial:\n${history}\n\nTexto actual: "${payload.transcript}"\n\n${meta}${schemaInstruction}`;

    try {
      return await this.executeWithFallback(prompt, ClassificationSchema, this.fastModels);
    } catch (error) {
      console.error('[GeminiAdapter] classifyQuestion error:', error);
      return {
        intent: 'other',
        confidence: 0.5,
        reasoning: 'Error de contingencia en clasificación',
      };
    }
  }

  async evaluateComprehension(payload: ComprehensionPayload): Promise<ComprehensionEvaluation> {
    const schemaInstruction = `\nResponde ÚNICAMENTE en JSON con este esquema:\n{"result": "correct" | "partial" | "incorrect","confidence": 0.9,"hint": "pista","shouldEscalate": false}`;
    const prompt = `Evalúa la comprensión del estudiante.\n\nPregunta: ${payload.microQuestion}\nEsperada: ${payload.expectedAnswer}\nEstudiante: ${payload.studentAnswer}\nIntento: ${payload.attemptNumber}${schemaInstruction}`;

    try {
      return await this.executeWithFallback(prompt, ComprehensionSchema, this.fastModels);
    } catch (error) {
      console.error('[GeminiAdapter] evaluateComprehension error:', error);
      return {
        result: 'incorrect',
        confidence: 0.5,
        shouldEscalate: false,
      };
    }
  }

  private async executeWithFallback<T>(
    prompt: string,
    schema: z.ZodType<T>,
    modelSelection: string[],
  ): Promise<T> {
    let lastError: unknown;

    for (const modelId of modelSelection) {
      try {
        const model = this.client.getGenerativeModel({
          model: modelId,
          generationConfig: {
            responseMimeType: 'application/json',
          },
        });

        const generationPromise = model.generateContent(prompt);
        const result = await generateWithTimeout(generationPromise);

        let responseText = result.response.text();
        responseText = responseText
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();

        const parsedJson = JSON.parse(responseText);
        return schema.parse(parsedJson);
      } catch (error: any) {
        lastError = error;

        if (error.name === 'AITimeoutError') {
          console.warn(`[GeminiAdapter] Timeout on model ${modelId}, trying next...`);
          continue;
        }

        if (error.status === 429 || error.status === 503 || error.status === 404) {
          console.warn(
            `[GeminiAdapter] Status ${error.status} on model ${modelId}, trying next...`,
          );
          continue;
        }

        throw new AIGenerationError(error.message || 'Error parsing or generating AI content');
      }
    }

    throw lastError;
  }

  private buildSystemPrompt(parameters: PromptParameters): string {
    const concepts = parameters.lesson.concepts
      .map((c) => `- ${c.title}: ${c.description}`)
      .join('\n');
    const analogies = parameters.lesson.analogies.map((a) => `- ${a.text}`).join('\n');
    const errors = parameters.lesson.commonErrors
      .map((e) => `- ${e.incorrectConcept}: ${e.correctionExplanation}`)
      .join('\n');

    return `Eres Pixel Mentor, un tutor interactivo para niños de 6 a 11 años.

Lección: "${parameters.lesson.title}"
${parameters.lesson.description ? `Descripción: ${parameters.lesson.description}` : ''}

CONCEPTOS CLAVE:
${concepts}

ANALOGÍAS:
${analogies}

ERRORES COMUNES A EVITAR:
${errors}

EXPLICACIÓN BASE:
${parameters.lesson.baseExplanation}

Estado pedagógico actual: ${parameters.currentState}

Instrucciones vitales para tu respuesta:
1. AUDIO PRIMERO: El texto será dictado por voz. Escribe exactamente como hablarías en una conversación natural.
2. CERO EMOJIS: Está estrictamente prohibido usar emojis, asteriscos, guiones, hashtags o formato Markdown.
3. CONCISIÓN: Sé directo y elimina cualquier palabra de relleno. Respuestas cortas mantienen la atención.
4. TONO: Sé muy amable, paciente y educativo. Guía al niño hacia la respuesta con preguntas breves en lugar de darle la solución de inmediato. Utiliza solo comas, puntos y signos de interrogación o exclamación.`;
  }

  private buildUserPrompt(parameters: PromptParameters): string {
    let prompt = 'Contexto de la conversación:\n';

    if (parameters.conversationHistory.length > 0) {
      prompt += parameters.conversationHistory
        .map((h) => `${h.role === 'user' ? 'Estudiante' : 'Tutor'}: ${h.content}`)
        .join('\n');
    }

    if (parameters.currentQuestion) {
      prompt += `\n\nPregunta actual: ${parameters.currentQuestion.text}`;
      if (parameters.currentQuestion.options) {
        prompt += `\nOpciones: ${parameters.currentQuestion.options.join(', ')}`;
      }
    }

    return prompt;
  }
}

import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

import type { AIService, GeneratedResponse, PromptParameters } from '@/domain/ports/ai-service';
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
  private model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({
      model: 'gemini-1.5-flash',
    });
  }

  async generateResponse(parameters: PromptParameters): Promise<GeneratedResponse> {
    const systemPrompt = this.buildSystemPrompt(parameters);
    const userPrompt = this.buildUserPrompt(parameters);

    const fullPrompt = `${systemPrompt}

${userPrompt}

Responde en JSON con este esquema exacto:
{
  "voiceText": "texto que escuchará el niño",
  "pedagogicalState": "EXPLANATION" | "QUESTION" | "EVALUATION",
  "feedback": "retroalimentación opcional",
  "isCorrect": true/false (solo en EVALUATION),
  "extraExplanation": "explicación adicional opcional",
  "chainOfThought": "tu razonamiento interno"
}`;

    try {
      const result = await this.model.generateContent(fullPrompt);
      const responseText = result.response.text();
      const parsed = JSON.parse(responseText);
      const validated = GeminiResponseSchema.parse(parsed);

      return {
        voiceText: validated.voiceText,
        pedagogicalState: validated.pedagogicalState,
        feedback: validated.feedback,
        isCorrect: validated.isCorrect,
        extraExplanation: validated.extraExplanation,
        chainOfThought: validated.chainOfThought,
      };
    } catch (error) {
      console.error('Failed to parse Gemini response:', error);
      return {
        voiceText: 'Algo salió mal. ¿Podrías repetir lo que dijiste?',
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

    const prompt = `Explica el concepto "${concept.title}" de forma clara y sencilla para un niño de 6-11 años.

Título: ${concept.title}
Descripción: ${concept.description}
${concept.example ? `Ejemplo: ${concept.example}` : ''}

Responde en JSON con:
{
  "voiceText": "explicación en voz",
  "pedagogicalState": "EXPLANATION",
  "chainOfThought": "tu razonamiento"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());
      const validated = GeminiResponseSchema.parse(parsed);
      return {
        voiceText: validated.voiceText,
        pedagogicalState: validated.pedagogicalState,
        chainOfThought: validated.chainOfThought,
      };
    } catch (error) {
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
    const prompt = `Evalúa si la respuesta del estudiante es correcta.

Pregunta: ${parameters.question.text}
Respuesta esperada: ${parameters.question.expectedAnswer}
Respuesta del estudiante: ${parameters.studentAnswer}

Responde en JSON:
{
  "voiceText": "retroalimentación en voz para el niño",
  "pedagogicalState": "EVALUATION",
  "isCorrect": true/false,
  "feedback": "retroalimentación detallada"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());
      const validated = GeminiResponseSchema.parse(parsed);
      return {
        voiceText: validated.voiceText,
        pedagogicalState: validated.pedagogicalState,
        isCorrect: validated.isCorrect,
        feedback: validated.feedback,
      };
    } catch (error) {
      return {
        voiceText: 'Gracias por tu respuesta. Continuemos con la siguiente pregunta.',
        pedagogicalState: 'EVALUATION',
        isCorrect: false,
      };
    }
  }

  async classifyQuestion(payload: ClassificationPayload): Promise<QuestionClassification> {
    const prompt = `Clasifica si el siguiente texto del estudiante es una pregunta, una respuesta, una afirmación, un saludo u otra cosa.

Historial de conversación:
${payload.lastTurns.map((t) => `${t.role === 'user' ? 'Estudiante' : 'Tutor'}: ${t.content}`).join('\n')}

Texto actual del estudiante: "${payload.transcript}"

${payload.lessonMetadata ? `Lección: ${payload.lessonMetadata.title}\nConceptos: ${payload.lessonMetadata.concepts.join(', ')}` : ''}

Responde en JSON:
{
  "intent": "question" | "answer" | "statement" | "greeting" | "other",
  "confidence": 0.0-1.0,
  "reasoning": "explicación breve de tu clasificación"
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());
      const validated = ClassificationSchema.parse(parsed);
      return {
        intent: validated.intent,
        confidence: validated.confidence,
        reasoning: validated.reasoning,
      };
    } catch (error) {
      return {
        intent: 'other',
        confidence: 0.5,
        reasoning: 'Error en la clasificación',
      };
    }
  }

  async evaluateComprehension(payload: ComprehensionPayload): Promise<ComprehensionEvaluation> {
    const prompt = `Evalúa la comprensión del estudiante después de una respuesta.

Pregunta de verificación: ${payload.microQuestion}
Respuesta esperada: ${payload.expectedAnswer}
Respuesta del estudiante: ${payload.studentAnswer}
Número de intento: ${payload.attemptNumber}

Responde en JSON:
{
  "result": "correct" | "partial" | "incorrect",
  "confidence": 0.0-1.0,
  "hint": "pista adicional si es partial o incorrect",
  "shouldEscalate": true/false
}`;

    try {
      const result = await this.model.generateContent(prompt);
      const parsed = JSON.parse(result.response.text());
      const validated = ComprehensionSchema.parse(parsed);
      return {
        result: validated.result,
        confidence: validated.confidence,
        hint: validated.hint,
        shouldEscalate: validated.shouldEscalate,
      };
    } catch (error) {
      return {
        result: 'incorrect',
        confidence: 0.5,
        shouldEscalate: false,
      };
    }
  }

  private buildSystemPrompt(parameters: PromptParameters): string {
    const concepts = parameters.lesson.concepts
      .map((c) => `- ${c.title}: ${c.description}`)
      .join('\n');
    const analogies = parameters.lesson.analogies.map((a) => `- ${a.text}`).join('\n');
    const errors = parameters.lesson.commonErrors
      .map((e) => `- ${e.incorrectConcept}: ${e.correctionExplanation}`)
      .join('\n');

    return `Eres Pixel Mentor, un tutor interactivo para niños de 6-11 años.

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

Instrucciones:
- Responde en español de forma clara y sencilla para niños de 6-11 años
- Usa analogías que los niños puedan entender
- Sé amigable, positivo y motivador
- Usa emojis apropiado para mantener el interés`;
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

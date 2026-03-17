import { randomUUID } from 'node:crypto';

import type { SessionRepository } from '@/domain/ports/session-repository.js';
import { SessionNotFoundError } from '@/domain/ports/session-repository.js';
import type { InteractionRepository } from '@/domain/ports/interaction-repository.js';
import type { RecipeRepository } from '@/domain/ports/recipe-repository.js';
import { RecipeNotFoundError } from '@/domain/ports/recipe-repository.js';
import type { ConceptRepository } from '@/domain/ports/concept-repository.js';
import type { ActivityRepository } from '@/domain/ports/activity-repository.js';
import type { AtomRepository } from '@/domain/ports/atom-repository.js';
import type { UserRepository } from '@/domain/ports/user-repository.js';
import type { AIService, AIResponse } from '@/domain/ports/ai-service.js';
import type {
  QuestionClassifier,
  ComprehensionEvaluator,
} from '@/domain/ports/question-classifier.js';
import type { RAGService } from '@/domain/ports/rag-service.js';
import type { AdvisoryLockManager } from '@/domain/ports/advisory-lock.js';
import { createSessionLockId } from '@/domain/ports/advisory-lock.js';
import type { PedagogicalState } from '@/domain/entities/pedagogical-state.js';
import type { Interaction } from '@/domain/entities/interaction.js';
import type { SessionCheckpoint } from '@/domain/entities/session.js';
import type { InteractRecipeOutput, StaticContent } from '@/application/dto/index.js';
import { determineClassificationAction } from '@/domain/entities/question-classification.js';
import { ContextWindowService } from '@/application/services/context-window.service.js';
import {
  parseRecipeConfig,
  fillTemplate,
  DEFAULT_CONFIG,
  type RecipeConfig,
} from '@/domain/entities/recipe-config.js';
import { isTerminalStatus } from '@/domain/entities/session.js';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos del script auto-contenido
// ─────────────────────────────────────────────────────────────────────────────

interface ContentScript {
  transition?: string;
  content?: string;
  examples?: string[];
  closure?: string;
}

interface QuestionScript extends ContentScript {
  question: string; // Texto de la pregunta de comprensión
  expectedAnswer: string; // Respuesta esperada (para el evaluador LLM)
  hint?: string;
  feedback: { correct: string; incorrect: string };
}

interface ActivityOption {
  text: string;
  isCorrect: boolean;
}

interface ActivityScript extends ContentScript {
  instruction: string; // Enunciado del MCQ
  options: ActivityOption[];
  feedback: { correct: string; incorrect: string };
}

type StepScript = ContentScript | QuestionScript | ActivityScript;

function isQuestionScript(s: unknown): s is QuestionScript {
  return typeof (s as QuestionScript)?.question === 'string';
}

function isActivityScript(s: unknown): s is ActivityScript {
  const opts = (s as ActivityScript)?.options;
  return Array.isArray(opts) && opts.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────────

export class OrchestrateRecipeUseCase {
  private config: RecipeConfig = DEFAULT_CONFIG;

  constructor(
    private sessionRepo: SessionRepository,
    private interactionRepo: InteractionRepository,
    private recipeRepo: RecipeRepository,
    private conceptRepo: ConceptRepository,
    private activityRepo: ActivityRepository,
    private atomRepo: AtomRepository,
    private userRepo: UserRepository,
    private aiService: AIService,
    private questionClassifier: QuestionClassifier,
    private ragService: RAGService,
    private comprehensionEvaluator: ComprehensionEvaluator,
    private advisoryLockManager?: AdvisoryLockManager,
    private contextWindowService: ContextWindowService = new ContextWindowService(),
  ) {
    // Mantenidos para compatibilidad futura
    void this.conceptRepo;
    void this.activityRepo;
  }

  // ─── extractStaticContent ────────────────────────────────────────────────
  /**
   * Lee TODO el contenido del paso desde step.script (JSON auto-contenido).
   *
   * CORRECCIÓN CLAVE respecto a la versión anterior:
   *   - La versión anterior leía `step.activityId` → siempre undefined porque
   *     el campo no existe en el schema de Prisma.
   *   - Ahora leemos directamente de `step.script.options` / `step.script.question`,
   *     que están embebidos en el JSON del paso. Sin dependencias de FKs externas.
   */
  private extractStaticContent(step: {
    stepType?: string | null;
    script?: unknown;
  }): StaticContent | undefined {
    const { stepType, script } = step;
    if (!stepType || !script) return undefined;

    // ── Contenido / intro / closure ──────────────────────────────────────
    if (stepType === 'content' || stepType === 'intro' || stepType === 'closure') {
      const s = script as ContentScript;
      return {
        stepType: stepType as 'content' | 'intro' | 'closure',
        script: {
          transition: s.transition ?? '',
          content: s.content ?? '',
          examples: s.examples ?? [],
          closure: s.closure ?? '',
        },
      };
    }

    // ── Pregunta de comprensión (respuesta libre) ─────────────────────────
    if (stepType === 'question' && isQuestionScript(script)) {
      return {
        stepType: 'activity', // La UI lo trata como panel interactivo
        script: {
          transition: script.transition ?? '',
          content: script.question,
          examples: [],
          closure: '',
        },
        activity: {
          instruction: script.question,
          options: [], // Sin opciones = input libre en el frontend
          feedback: {
            correct: script.feedback.correct,
            incorrect: script.feedback.incorrect,
            partial: script.hint,
          },
        },
      };
    }

    // ── Actividad / examen (opción múltiple) ──────────────────────────────
    if ((stepType === 'activity' || stepType === 'exam') && isActivityScript(script)) {
      return {
        stepType: 'activity',
        script: {
          transition: script.transition ?? '',
          content: script.instruction,
          examples: [],
          closure: script.closure ?? '',
        },
        activity: {
          instruction: script.instruction,
          options: script.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          feedback: {
            correct: script.feedback.correct,
            incorrect: script.feedback.incorrect,
          },
        },
      };
    }

    // Fallback
    const s = script as ContentScript;
    return {
      stepType: 'content',
      script: {
        transition: s.transition ?? '',
        content: s.content ?? '',
        examples: s.examples ?? [],
        closure: s.closure ?? '',
      },
    };
  }

  // ─── buildVoiceText ──────────────────────────────────────────────────────
  private buildVoiceText(step: { stepType?: string | null; script?: unknown }): string {
    const { stepType, script } = step;
    if (!script) return '';

    if (stepType === 'question' && isQuestionScript(script)) {
      return [script.transition, script.question].filter(Boolean).join(' ');
    }
    if ((stepType === 'activity' || stepType === 'exam') && isActivityScript(script)) {
      return [script.transition, script.instruction].filter(Boolean).join(' ');
    }
    const s = script as ContentScript;
    return [s.transition, s.content, s.closure].filter(Boolean).join(' ');
  }

  // ─── Helpers de clasificación de paso ───────────────────────────────────

  private requiresStudentInput(stepType?: string | null): boolean {
    return stepType === 'activity' || stepType === 'exam' || stepType === 'question';
  }

  private stateForStep(step: { stepType?: string | null }): PedagogicalState {
    return this.requiresStudentInput(step?.stepType) ? 'ACTIVITY_WAIT' : 'EXPLANATION';
  }

  private advanceStep(steps: any[], current: number): number | null {
    const next = current + 1;
    return next < steps.length ? next : null;
  }

  private findPreviousContentStep(steps: any[], from: number): number | null {
    for (let i = from - 1; i >= 0; i--) {
      if (!this.requiresStudentInput(steps[i].stepType)) return i;
    }
    return null;
  }

  private getFallbackResponse(state: PedagogicalState, title: string): AIResponse {
    return {
      explanation: `Continuemos con ${title}.`,
      supportQuotes: [],
      pedagogicalState: state,
    };
  }

  private async record(sessionId: string, turnBase: number, text: string, type: string | null) {
    await this.interactionRepo.create({
      id: randomUUID(),
      sessionId,
      turnNumber: turnBase + 1,
      transcript: text,
      aiResponse: type ? { text, responseType: type } : null,
      pausedForQuestion: false,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // start()
  // ─────────────────────────────────────────────────────────────────────────

  async start(recipeId: string, studentId: string) {
    const recipe = await this.recipeRepo.findById(recipeId);
    if (!recipe) throw new RecipeNotFoundError(recipeId);

    this.config = parseRecipeConfig(recipe.meta);
    const student = await this.userRepo.findById(studentId);
    const name = student?.name ?? 'estudiante';

    const steps = await this.recipeRepo.findStepsByRecipeId(recipeId);
    if (!steps.length) throw new Error('Recipe has no steps');

    const existing = await this.sessionRepo.findByStudentAndRecipe(studentId, recipeId);
    if (existing && !isTerminalStatus(existing.status)) {
      const idx = existing.stateCheckpoint.currentStepIndex ?? 0;
      const needsToStart = existing.stateCheckpoint.currentState === 'AWAITING_START';
      const resumeMsg = needsToStart
        ? fillTemplate(this.config.greetings.intro, {
            name,
            tutor: this.config.tutorName,
            title: recipe.title,
          })
        : `¡Bienvenido de vuelta, ${name}! Continuemos con ${recipe.title}.`;
      return {
        sessionId: existing.id,
        voiceText: resumeMsg,
        pedagogicalState: (needsToStart
          ? 'AWAITING_START'
          : existing.stateCheckpoint.currentState) as PedagogicalState,
        staticContent: this.extractStaticContent(steps[idx] ?? steps[0]),
        config: this.config as unknown as Record<string, unknown>,
        resumed: true,
        needsStart: needsToStart,
        lessonProgress: { currentStep: idx, totalSteps: steps.length },
      };
    }

    const sessionId = randomUUID();
    const voiceText = [
      fillTemplate(this.config.greetings.intro, {
        name,
        tutor: this.config.tutorName,
        title: recipe.title,
      }),
      fillTemplate(this.config.greetings.readyPrompt, {
        name,
        tutor: this.config.tutorName,
        title: recipe.title,
      }),
    ].join('. ');

    await this.sessionRepo.create({
      id: sessionId,
      studentId,
      recipeId,
      status: 'IDLE',
      stateCheckpoint: {
        currentState: 'AWAITING_START',
        currentStepIndex: 0,
        questionCount: 0,
        lastQuestionTime: null,
        skippedActivities: [],
        failedAttempts: 0,
      },
    });
    await this.sessionRepo.updateStatus(sessionId, 'ACTIVE');
    await this.record(sessionId, 0, voiceText, 'greeting');

    return {
      sessionId,
      voiceText,
      pedagogicalState: 'AWAITING_START' as PedagogicalState,
      staticContent: this.extractStaticContent(steps[0]),
      config: this.config as unknown as Record<string, unknown>,
      resumed: false,
      needsStart: true,
      lessonProgress: { currentStep: 0, totalSteps: steps.length },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // interact()
  // ─────────────────────────────────────────────────────────────────────────

  async interact(
    sessionId: string,
    studentInput: string,
    userId?: string,
  ): Promise<InteractRecipeOutput> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (userId && session.studentId !== userId)
      throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
    if (session.status !== 'ACTIVE') throw new Error(`Session not active: ${session.status}`);

    const recipe = await this.recipeRepo.findById(session.recipeId);
    if (!recipe) throw new RecipeNotFoundError(session.recipeId);
    this.config = parseRecipeConfig(recipe.meta);

    const steps = await this.recipeRepo.findStepsByRecipeId(session.recipeId);
    if (!steps.length) throw new Error('Recipe has no steps');

    const history = await this.interactionRepo.findBySessionOrdered(sessionId);
    const limited = this.contextWindowService.trimHistory(history);
    const recentHistory = limited.map((h: Interaction) => ({
      role: (h.turnNumber % 2 === 1 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: h.transcript,
    }));
    const historySummary = this.contextWindowService.summarizeOlderTurns(history);

    const cp = session.stateCheckpoint;
    const currentState = cp.currentState as PedagogicalState;
    let currentIdx = cp.currentStepIndex ?? 0;
    let questionCount = cp.questionCount ?? 0;
    let lastQuestionTime = cp.lastQuestionTime ?? null;
    let skippedActivities: string[] = cp.skippedActivities ?? [];
    let failedAttempts = cp.failedAttempts ?? 0;
    let savedStepIndex: number | undefined = cp.savedStepIndex;
    let doubtContext = cp.doubtContext;

    if (session.safetyFlag || session.outOfScope) {
      await this.sessionRepo.escalate(sessionId);
      return {
        voiceText: 'Sesión escalada.',
        pedagogicalState: currentState,
        sessionCompleted: true,
      };
    }

    const currentStep = steps[currentIdx];
    if (!currentStep) {
      await this.sessionRepo.complete(sessionId);
      return {
        voiceText: fillTemplate(this.config.greetings.completionMessage ?? '¡Felicitaciones!', {
          name: 'estudiante',
          title: recipe.title,
        }),
        pedagogicalState: 'COMPLETED',
        sessionCompleted: true,
        lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
      };
    }

    const currentAtom = await this.atomRepo.findById(currentStep.atomId);
    if (!currentAtom) throw new Error(`Atom ${currentStep.atomId} not found`);

    // ── AWAITING_START fast path ─────────────────────────────────────────
    if (currentState === 'AWAITING_START') {
      const lower = studentInput.toLowerCase();
      const ready = [
        'sí',
        'si',
        'comenzar',
        'start',
        'listo',
        'adelante',
        'vamos',
        'ready',
        'ok',
        'dale',
        'continuar',
      ].some((w) => lower.includes(w));

      if (ready) {
        const vt = this.buildVoiceText(currentStep);
        await this.record(sessionId, history.length, studentInput, null);
        await this.record(sessionId, history.length + 1, vt, 'answer');
        await this.sessionRepo.updateCheckpoint(sessionId, {
          ...cp,
          currentState: this.stateForStep(currentStep),
          currentStepIndex: currentIdx,
        });
        return {
          voiceText: vt,
          pedagogicalState: this.stateForStep(currentStep),
          staticContent: this.extractStaticContent(currentStep),
          lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
        };
      }

      const prompt = this.config.greetings.readyPrompt ?? '¿Estás listo?';
      await this.record(sessionId, history.length, studentInput, null);
      await this.record(sessionId, history.length + 1, prompt, 'answer');
      return {
        voiceText: prompt,
        pedagogicalState: 'AWAITING_START',
        staticContent: this.extractStaticContent(currentStep),
        lessonProgress: { currentStep: currentIdx, totalSteps: steps.length },
      };
    }

    // ── Clasificar input ──────────────────────────────────────────────────
    const classification = await this.questionClassifier.classify({
      transcript: studentInput,
      lastTurns: recentHistory,
      lessonMetadata: { title: recipe.title, concepts: [] },
    });
    const action = determineClassificationAction(classification);

    let ragContext: any;
    if (
      action.type === 'ACCEPT' &&
      classification.intent === 'question' &&
      currentState !== 'ACTIVITY_WAIT'
    ) {
      const r = await this.ragService.retrieveChunks({
        atomId: currentAtom.id,
        queryText: studentInput,
        k: 3,
      });
      ragContext = r.chunks;
    }

    let aiResponse: AIResponse;
    try {
      aiResponse = await this.aiService.generateResponse({
        recipe,
        currentState,
        conversationHistory: recentHistory,
        ragContext,
        currentSegment: {
          chunkText: currentAtom.content || currentAtom.title,
          order: currentStep.order,
        },
        totalSegments: steps.length,
        historySummary,
      });
    } catch (e: any) {
      console.warn('[Orchestrator] LLM fallback:', e.message);
      aiResponse = this.getFallbackResponse(currentState, currentAtom.title);
    }

    const canAsk = () => {
      if (questionCount >= this.config.maxQuestionsPerSession) return false;
      if (lastQuestionTime) {
        const ms = Date.now() - new Date(lastQuestionTime).getTime();
        if (ms < this.config.questionCooldownSeconds * 1_000) return false;
      }
      return true;
    };

    let voiceText = aiResponse.explanation;
    let responseFeedback: string | undefined;
    let nextState: PedagogicalState = currentState;
    let nextIdx = currentIdx;
    let willComplete = false;

    // ── Máquina de estados ────────────────────────────────────────────────

    if (currentState === 'ACTIVE_CLASS' || currentState === 'EXPLANATION') {
      if (action.type === 'ACCEPT' && classification.intent === 'question' && canAsk()) {
        questionCount++;
        lastQuestionTime = new Date().toISOString();
        nextState = 'RESOLVING_DOUBT';
        savedStepIndex = currentIdx;
        doubtContext = { question: studentInput, stepIndex: currentIdx };
      } else if (action.type === 'ACCEPT' && classification.intent === 'question') {
        voiceText = 'Continuemos con el tema por ahora.';
        nextState = currentState;
      } else {
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = 'COMPLETED';
        } else {
          nextIdx = adv;
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
        }
      }
    } else if (currentState === 'ACTIVITY_WAIT') {
      const script = currentStep.script;

      if (isQuestionScript(script)) {
        // ── Pregunta de comprensión: evaluar con LLM ─────────────────────
        const evaluation = await this.comprehensionEvaluator.evaluate({
          microQuestion: (script as QuestionScript).question,
          expectedAnswer: (script as QuestionScript).expectedAnswer ?? '',
          studentAnswer: studentInput,
          attemptNumber: failedAttempts + 1,
        });
        const qs = script as QuestionScript;
        if (evaluation.result === 'correct') {
          voiceText = qs.feedback.correct;
          responseFeedback = qs.feedback.correct;
          nextState = 'EVALUATION';
          failedAttempts = 0;
        } else if (evaluation.result === 'partial') {
          voiceText = qs.hint ?? evaluation.hint ?? qs.feedback.incorrect;
          nextState = 'ACTIVITY_WAIT';
        } else {
          failedAttempts++;
          voiceText = qs.feedback.incorrect;
          responseFeedback = qs.feedback.incorrect;
          nextState =
            failedAttempts >= this.config.skipAfterFailedAttempts && this.config.enableActivitySkip
              ? 'ACTIVITY_SKIP_OFFER'
              : 'EVALUATION';
        }
      } else if (isActivityScript(script)) {
        // ── Actividad MCQ: comparación directa (sin LLM) ─────────────────
        const as = script as ActivityScript;
        const norm = studentInput.trim().toLowerCase();
        const correct = as.options.find((o) => o.isCorrect);
        const isCorrect = !!correct && norm === correct.text.trim().toLowerCase();

        voiceText = isCorrect ? as.feedback.correct : as.feedback.incorrect;
        responseFeedback = voiceText;

        if (isCorrect) {
          nextState = 'EVALUATION';
          failedAttempts = 0;
        } else {
          failedAttempts++;
          nextState =
            failedAttempts >= this.config.skipAfterFailedAttempts && this.config.enableActivitySkip
              ? 'ACTIVITY_SKIP_OFFER'
              : 'EVALUATION';
        }
      }
    } else if (currentState === 'EVALUATION') {
      const lower = studentInput.toLowerCase();
      if (lower.includes('repetir') || lower.includes('otra vez')) {
        const ci = this.findPreviousContentStep(steps, currentIdx) ?? currentIdx;
        nextIdx = ci;
        nextState = this.stateForStep(steps[ci]);
        voiceText = this.buildVoiceText(steps[ci]);
        failedAttempts = 0;
      } else {
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = 'COMPLETED';
        } else {
          nextIdx = adv;
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
          failedAttempts = 0;
        }
      }
    } else if (currentState === 'ACTIVITY_SKIP_OFFER') {
      const lower = studentInput.toLowerCase();
      if (lower.includes('repetir') || lower.includes('otra vez')) {
        const ci = this.findPreviousContentStep(steps, currentIdx) ?? currentIdx;
        nextIdx = ci;
        nextState = this.stateForStep(steps[ci]);
        voiceText = this.buildVoiceText(steps[ci]);
        failedAttempts = 0;
      } else {
        skippedActivities = [...skippedActivities, currentStep.atomId];
        const adv = this.advanceStep(steps, currentIdx);
        if (adv === null) {
          willComplete = true;
          nextState = 'COMPLETED';
        } else {
          nextIdx = adv;
          nextState = this.stateForStep(steps[nextIdx]);
          voiceText = this.buildVoiceText(steps[nextIdx]);
        }
      }
    } else if (currentState === 'RESOLVING_DOUBT' || currentState === 'CLARIFYING') {
      const ri = savedStepIndex ?? currentIdx;
      nextIdx = ri;
      nextState = this.stateForStep(steps[ri] ?? currentStep);
      savedStepIndex = undefined;
      doubtContext = undefined;
      voiceText = `${aiResponse.explanation} Continuemos donde lo dejamos.`;
    }

    if (willComplete) {
      voiceText = fillTemplate(
        this.config.greetings.completionMessage ?? '¡Felicitaciones! Completaste {title}.',
        { name: 'estudiante', title: recipe.title },
      );
    }

    await this.record(sessionId, history.length, studentInput, null);
    await this.record(sessionId, history.length + 1, voiceText, 'answer');

    const newCp: SessionCheckpoint = {
      currentState: nextState,
      currentStepIndex: nextIdx,
      savedStepIndex,
      doubtContext,
      questionCount,
      lastQuestionTime,
      skippedActivities,
      failedAttempts,
    };

    const persist = async () => {
      if (willComplete) await this.sessionRepo.complete(sessionId);
      else await this.sessionRepo.updateCheckpoint(sessionId, newCp);
    };

    if (this.advisoryLockManager) {
      const lockId = createSessionLockId(sessionId);
      await this.advisoryLockManager.acquireLock(lockId);
      try {
        await persist();
      } finally {
        await this.advisoryLockManager.releaseLock(lockId);
      }
    } else {
      await persist();
    }

    // FIX CLAVE: usar nextIdx (paso destino) para el staticContent
    const displayStep = willComplete ? currentStep : (steps[nextIdx] ?? currentStep);
    const staticContent = this.extractStaticContent(displayStep);

    return {
      voiceText,
      pedagogicalState: nextState,
      sessionCompleted: willComplete || undefined,
      feedback: responseFeedback,
      isCorrect: aiResponse.isCorrect,
      staticContent,
      lessonProgress: { currentStep: nextIdx, totalSteps: steps.length },
    };
  }
}

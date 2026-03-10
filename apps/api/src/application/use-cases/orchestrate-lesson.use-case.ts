import { randomUUID } from 'node:crypto';

import type { SessionRepository } from '@/domain/ports/session-repository';
import type { InteractionRepository } from '@/domain/ports/interaction-repository';
import type { LessonRepository } from '@/domain/ports/lesson-repository';
import type { AIService } from '@/domain/ports/ai-service';
import type { PedagogicalState } from '@/domain/entities/pedagogical-state';
import type { Interaction } from '@/domain/entities/interaction';
import { SessionNotFoundError, ActiveSessionExistsError } from '@/domain/ports/session-repository';
import { LessonNotFoundError } from '@/domain/ports/lesson-repository';

export class OrchestrateLessonUseCase {
  constructor(
    private sessionRepo: SessionRepository,
    private interactionRepo: InteractionRepository,
    private lessonRepo: LessonRepository,
    private aiService: AIService,
  ) {}

  async start(
    lessonId: string,
    studentId: string,
  ): Promise<{
    sessionId: string;
    voiceText: string;
    pedagogicalState: 'EXPLANATION' | 'QUESTION' | 'EVALUATION';
  }> {
    // 1. Validate lesson exists
    const lesson = await this.lessonRepo.findById(lessonId);
    if (!lesson) throw new LessonNotFoundError(lessonId);

    // 2. Check for existing active session
    const existing = await this.sessionRepo.findByStudentAndLesson(studentId, lessonId);
    if (existing && existing.status === 'active') {
      throw new ActiveSessionExistsError(studentId, lessonId);
    }

    // 3. Create new session
    const sessionId = randomUUID();
    await this.sessionRepo.create({
      id: sessionId,
      studentId,
      lessonId,
      status: 'idle',
      stateCheckpoint: { currentState: 'EXPLANATION', currentQuestionIndex: 0 },
      currentInteractionId: null,
      lastActivityAt: new Date(),
      completedAt: null,
      escalatedAt: null,
    });

    // 4. Generate initial AI response
    const aiResponse = await this.aiService.generateResponse({
      lesson,
      currentState: 'EXPLANATION',
      conversationHistory: [],
    });

    // 5. Create tutor interaction
    const tutorInteractionId = randomUUID();
    await this.interactionRepo.create({
      id: tutorInteractionId,
      sessionId,
      turnNumber: 1,
      transcript: aiResponse.voiceText,
      aiResponse: {
        text: aiResponse.voiceText,
        responseType: 'explanation',
      },
      pausedForQuestion: false,
    });

    // 6. Update session
    await this.sessionRepo.setCurrentInteraction(sessionId, tutorInteractionId);
    await this.sessionRepo.updateStatus(sessionId, 'active');
    await this.sessionRepo.updateCheckpoint(sessionId, {
      currentState: aiResponse.pedagogicalState,
      currentQuestionIndex: 0,
    });

    return {
      sessionId,
      voiceText: aiResponse.voiceText,
      pedagogicalState: aiResponse.pedagogicalState,
    };
  }

  async interact(
    sessionId: string,
    studentInput: string,
  ): Promise<{
    voiceText: string;
    pedagogicalState: 'EXPLANATION' | 'QUESTION' | 'EVALUATION';
    sessionCompleted: boolean;
    feedback?: string;
    isCorrect?: boolean;
    extraExplanation?: string;
  }> {
    // 1. Get session
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    if (session.status !== 'active') {
      throw new Error(`Session is not active (status: ${session.status})`);
    }

    // 2. Get lesson
    const lesson = await this.lessonRepo.findById(session.lessonId);
    if (!lesson) throw new LessonNotFoundError(session.lessonId);

    // 3. Get conversation history
    const history = await this.interactionRepo.findBySessionOrdered(sessionId);
    const recentHistory: Array<{ readonly role: 'user' | 'assistant'; readonly content: string }> =
      history
        .slice(-5)
        .map(
          (h: Interaction): { readonly role: 'user' | 'assistant'; readonly content: string } => ({
            role: h.turnNumber % 2 === 1 ? 'user' : 'assistant',
            content: h.transcript,
          }),
        );

    // 4. Determine current state from checkpoint with proper typing
    const checkpoint = session.stateCheckpoint as {
      currentState: PedagogicalState;
      currentQuestionIndex: number;
    };
    const currentState = checkpoint.currentState;
    const currentQuestionIndex = checkpoint.currentQuestionIndex;

    // 5. Generate AI response
    const aiResponse = await this.aiService.generateResponse({
      lesson,
      currentState,
      conversationHistory: recentHistory,
      currentQuestion:
        currentQuestionIndex < lesson.questions.length
          ? {
              text: lesson.questions[currentQuestionIndex].text,
              options: lesson.questions[currentQuestionIndex].multipleChoiceOptions,
            }
          : undefined,
    });

    // 6. Determine next state using pedagogical FSM
    const nextState = this.determineNextState(
      currentState,
      aiResponse.pedagogicalState,
      currentQuestionIndex,
      lesson.questions.length,
    );

    // 7. Check if session will complete after this interaction
    const willComplete =
      nextState === 'EVALUATION' && currentQuestionIndex + 1 >= lesson.questions.length;

    // 8. Record student input
    await this.interactionRepo.create({
      id: randomUUID(),
      sessionId,
      turnNumber: history.length + 1,
      transcript: studentInput,
      aiResponse: null,
      pausedForQuestion: false,
    });

    // 9. Record tutor response
    await this.interactionRepo.create({
      id: randomUUID(),
      sessionId,
      turnNumber: history.length + 2,
      transcript: aiResponse.voiceText,
      aiResponse: {
        text: aiResponse.voiceText,
        responseType: 'answer',
      },
      pausedForQuestion: false,
    });

    // 10. Update session state
    if (willComplete) {
      await this.sessionRepo.complete(sessionId);
    } else {
      await this.sessionRepo.updateCheckpoint(sessionId, {
        currentState: nextState,
        currentQuestionIndex:
          nextState === 'QUESTION' ? currentQuestionIndex + 1 : currentQuestionIndex,
      });
    }

    // 11. Return response
    return {
      voiceText: aiResponse.voiceText,
      pedagogicalState: nextState,
      sessionCompleted: willComplete,
      feedback: aiResponse.feedback,
      isCorrect: aiResponse.isCorrect,
      extraExplanation: aiResponse.extraExplanation,
    };
  }

  private determineNextState(
    current: PedagogicalState,
    _aiSuggested: PedagogicalState,
    questionIndex: number,
    totalQuestions: number,
  ): PedagogicalState {
    // Finite state machine for lesson flow
    switch (current) {
      case 'EXPLANATION':
        return 'QUESTION';
      case 'QUESTION':
        return 'EVALUATION';
      case 'EVALUATION':
        return questionIndex + 1 < totalQuestions ? 'QUESTION' : 'EVALUATION';
    }
  }
}

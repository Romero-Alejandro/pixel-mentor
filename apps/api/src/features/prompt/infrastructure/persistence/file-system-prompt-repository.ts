import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createUnifiedPromptRenderer } from './unified-prompt-renderer.js';

import type {
  PromptRepository,
  PromptParams,
} from '@/features/recipe/domain/ports/prompt.repository.port.js';
import type { PedagogicalState } from '@/features/evaluation/domain/entities/pedagogical-state-machine.js';

type StateTemplateMap = Record<PedagogicalState, string>;

export class FileSystemPromptRepository implements PromptRepository {
  private templates: StateTemplateMap;
  private basePath: string;
  private renderer: ReturnType<typeof createUnifiedPromptRenderer>;

  constructor(promptsDir?: string) {
    const defaultDir = join(fileURLToPath(new URL('.', import.meta.url)), '../../prompts');
    this.basePath = promptsDir || defaultDir;
    this.renderer = createUnifiedPromptRenderer();
    this.templates = this.loadTemplates();
  }

  private loadTemplates(): StateTemplateMap {
    const states: PedagogicalState[] = [
      'AWAITING_START',
      'ACTIVE_CLASS',
      'RESOLVING_DOUBT',
      'CLARIFYING',
      'QUESTION',
      'EVALUATION',
      'COMPLETED',
      'EXPLANATION',
      'ACTIVITY_WAIT',
      'ACTIVITY_INACTIVITY_WARNING',
      'ACTIVITY_SKIP_OFFER',
    ];

    const templates: StateTemplateMap = {} as StateTemplateMap;

    for (const state of states) {
      const filePath = join(this.basePath, `${state.toLowerCase()}.txt`);
      if (existsSync(filePath)) {
        templates[state] = readFileSync(filePath, 'utf-8');
      } else {
        templates[state] = this.generateFallbackPrompt(state);
      }
    }

    return templates;
  }

  private generateFallbackPrompt(state: PedagogicalState): string {
    return `[SYSTEM]\nEstado: ${state}\n\nReglas pedagógicas estándar.\n\nHistorial:\n{{conversationHistory}}\n\nINSTRUCCIÓN: Genera una respuesta natural.`;
  }

  getPrompt(state: PedagogicalState, params: PromptParams): string {
    const template = this.templates[state];
    if (!template) {
      throw new Error(`No template found for state: ${state}`);
    }

    return this.render(template, params);
  }

  private render(template: string, params: PromptParams): string {
    const values = this.mapParamsToValues(params);
    return this.renderer.render(template, values);
  }

  private mapParamsToValues(params: PromptParams): Record<string, string> {
    const values: Record<string, string> = {
      persona: params.persona || this.getDefaultPersona(params.currentState),
      segmentText: params.currentSegment?.chunkText || '',
      currentSegmentIndex: String((params.currentSegment?.order ?? 0) + 1),
      totalSegments: String(params.totalSegments ?? 1),
      currentQuestion: params.currentQuestion?.text || '',
      conversationHistory: JSON.stringify(
        params.conversationHistory.map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
      ),
      historySummary: params.historySummary || '',
      ragContext: JSON.stringify(params.ragContext || []),
    };

    if (params.currentQuestion?.options) {
      values.currentQuestionOptions = params.currentQuestion.options.join(', ');
    }

    return values;
  }

  private getDefaultPersona(state: PedagogicalState): string {
    switch (state) {
      case 'ACTIVE_CLASS':
        return 'Tutor entusiasta y alentador';
      case 'RESOLVING_DOUBT':
        return 'Tutor paciente y clarificador';
      case 'CLARIFYING':
        return 'Tutor clarificador';
      case 'QUESTION':
        return 'Evaluador formal';
      case 'EVALUATION':
        return 'Evaluador analítico';
      case 'ACTIVITY_WAIT':
        return 'Tutor que espera respuesta';
      case 'ACTIVITY_INACTIVITY_WARNING':
        return 'Tutor motivador';
      case 'ACTIVITY_SKIP_OFFER':
        return 'Tutor comprensivo';
      case 'EXPLANATION':
        return 'Tutor explicativo';
      case 'COMPLETED':
        return 'Tutor felicitador';
      default:
        return 'Tutor amigable';
    }
  }
}

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PromptRepository, PromptParams } from '@/features/recipe/domain/ports/prompt.repository.port.js';
import type { PedagogicalState } from '@/features/evaluation/domain/entities/pedagogical-state-machine.js';

type StateTemplateMap = Record<PedagogicalState, string>;

export class FileSystemPromptRepository implements PromptRepository {
  private templates: StateTemplateMap;
  private basePath: string;

  constructor(promptsDir?: string) {
    const defaultDir = join(fileURLToPath(new URL('.', import.meta.url)), '../../../prompts');
    this.basePath = promptsDir || defaultDir;
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
        // Fallback: generar prompt básico
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
    let rendered = template;

    // Replace simple mustache-style placeholders
    rendered = rendered.replace(
      /\{\{persona\}\}/g,
      params.persona || this.getDefaultPersona(params.currentState),
    );
    rendered = rendered.replace(/\{\{segment\}\}/g, params.currentSegment?.chunkText || '');
    rendered = rendered.replace(/\{\{segmentText\}\}/g, params.currentSegment?.chunkText || '');
    rendered = rendered.replace(
      /\{\{currentSegmentIndex\}\}/g,
      String((params.currentSegment?.order ?? 0) + 1),
    );
    rendered = rendered.replace(/\{\{totalSegments\}\}/g, String(params.totalSegments ?? 1));

    // RAG context
    if (params.ragContext && Array.isArray(params.ragContext)) {
      let ragText = '';
      params.ragContext.forEach((item: any, idx: number) => {
        const chunkText = item.chunk?.chunkText || item.text || '';
        ragText += `${idx + 1}. ${chunkText}\n`;
      });
      rendered = rendered.replace(
        /\{% if ragContext %}.*?\{% endif %\}/gs,
        ragText.trim() ? `\nContexto relevante recuperado:\n${ragText}` : '',
      );
    } else {
      rendered = rendered.replace(/\{% if ragContext %}.*?\{% endif %\}/gs, '');
    }

    // Current question
    if (params.currentQuestion) {
      const qText = `\nPregunta actual: ${params.currentQuestion.text}\n`;
      const options = params.currentQuestion.options
        ? `Opciones: ${params.currentQuestion.options.join(', ')}\n`
        : '';
      rendered = rendered.replace(/\{% if currentQuestion %}.*?\{% endif %\}/gs, qText + options);
    } else {
      rendered = rendered.replace(/\{% if currentQuestion %}.*?\{% endif %\}/gs, '');
    }

    // Conversation history
    const historyLines = params.conversationHistory
      .map((turn) => {
        const role = turn.role === 'user' ? 'Estudiante' : 'Tutor';
        return `${role}: ${turn.content}`;
      })
      .join('\n');
    rendered = rendered.replace(
      /\{% for turn in conversationHistory %}.*?\{% endfor %\}/gs,
      historyLines,
    );

    // History summary
    if (params.historySummary) {
      const summaryBlock = `\n[RESUMEN DE CONVERSACIÓN ANTERIOR]\n${params.historySummary}\n[/RESUMEN]`;
      rendered = rendered.replace(/\{% if historySummary %}.*?\{% endif %\}/gs, summaryBlock);
    } else {
      rendered = rendered.replace(/\{% if historySummary %}.*?\{% endif %\}/gs, '');
    }

    // Remove any leftover tags
    rendered = rendered.replace(/\{%[^%]*%\}/g, '');

    return rendered;
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

import type { PedagogicalState } from '../entities/pedagogical-state.js';

export interface PromptSegment {
  id?: string;
  [key: string]: unknown;
}

export interface PromptInjector {
  injectSystemPrompt(state: PedagogicalState, segment: PromptSegment, persona: string): string;
}

export class DefaultPromptInjector implements PromptInjector {
  injectSystemPrompt(state: PedagogicalState, segment: PromptSegment, persona: string): string {
    // Simplified: just return a base prompt; actual prompt construction is done elsewhere
    return `[SYSTEM] State: ${state}, Persona: ${persona}, Chunk: ${segment?.id ?? 'N/A'}`;
  }
}

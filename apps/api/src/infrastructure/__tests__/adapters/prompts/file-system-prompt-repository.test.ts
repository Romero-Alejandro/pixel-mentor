import { join } from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { FileSystemPromptRepository } from '@/infrastructure/adapters/prompts/file-system-prompt-repository.js';
import type { PedagogicalState } from '@/domain/entities/pedagogical-state.js';
import type { PromptParams } from '@/domain/ports/prompt-repository.js';

describe('FileSystemPromptRepository', () => {
  let tempDir!: string;
  let repo!: FileSystemPromptRepository;

  beforeAll(async () => {
    const random = Math.random().toString(36).substring(2);
    tempDir = (await mkdir(join(tmpdir(), `prompts-test-${random}`), {
      recursive: true,
    })) as string;

    const states: PedagogicalState[] = [
      'ACTIVE_CLASS',
      'RESOLVING_DOUBT',
      'CLARIFYING',
      'QUESTION',
      'EVALUATION',
      'COMPLETED',
      'EXPLANATION',
    ];

    for (const state of states) {
      const content = `[STATE] ${state}\nSegment: {{segment}}\nPersona: {{persona}}\n{% if ragContext %}RAG: {% for item in ragContext %}- {{ item }}{% endfor %}{% endif %}`;
      await writeFile(join(tempDir, `${state.toLowerCase()}.txt`), content, 'utf-8');
    }
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    repo = new FileSystemPromptRepository(tempDir);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });

  it('should return prompt for ACTIVE_CLASS with replacements', () => {
    const params: PromptParams = {
      currentState: 'ACTIVE_CLASS',
      lesson: { title: 'Math' },
      conversationHistory: [],
      currentSegment: { order: 0, chunkText: 'Concept 1' } as any,
      totalSegments: 5,
      persona: 'Explorer',
      ragContext: [{ chunk: { chunkText: 'RAG snippet' } }],
    };

    const prompt = repo.getPrompt('ACTIVE_CLASS', params);

    expect(prompt).toContain('ACTIVE_CLASS');
    expect(prompt).toContain('Concept 1');
    expect(prompt).toContain('Explorer');
    expect(prompt).toContain('Contexto relevante recuperado:');
    expect(prompt).toContain('RAG snippet');
  });

  it('should handle missing ragContext', () => {
    const params: PromptParams = {
      currentState: 'RESOLVING_DOUBT',
      lesson: { title: 'Test' },
      conversationHistory: [],
      currentSegment: { order: 2, chunkText: 'Segment text' } as any,
      totalSegments: 3,
    };

    const prompt = repo.getPrompt('RESOLVING_DOUBT', params);

    expect(prompt).toContain('RESOLVING_DOUBT');
    expect(prompt).toContain('Segment: Segment text');
    // No RAG block should appear
    expect(prompt).not.toContain('Contexto relevante recuperado:');
  });

  it('should handle CLARIFYING state', () => {
    const params: PromptParams = {
      currentState: 'CLARIFYING',
      lesson: { title: 'Test' },
      conversationHistory: [{ role: 'user', content: '?' }],
    };

    const prompt = repo.getPrompt('CLARIFYING', params);

    expect(prompt).toContain('CLARIFYING');
  });

  it('should throw error for unknown state', () => {
    const params: PromptParams = {
      currentState: 'UNKNOWN' as any,
      lesson: {},
      conversationHistory: [],
    };

    expect(() => repo.getPrompt('UNKNOWN' as any, params)).toThrow(
      'No template found for state: UNKNOWN',
    );
  });
});

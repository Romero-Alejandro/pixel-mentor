import { Readable } from 'node:stream';

import * as googleTTS from '@sefinek/google-tts-api';
import type pino from 'pino';

import { GoogleFreeTTSAdapter } from './google-free.adapter';
import { MockTTSAdapter } from './mock-tts-adapter';

import {
  isValidTTSHost,
  validateTTSOptions,
  type ValidatedTTSOptions,
} from '@/features/tts/domain/validators/tts-options.validator.js';
import type { TTSService } from '@/features/tts/domain/ports/tts-service.port';

export const TTS_EVENT_TYPES = {
  AUDIO: 'audio',
  END: 'end',
  ERROR: 'error',
} as const;

interface TTSMessage<T extends string, D = unknown> {
  type: T;
  data: D;
}

interface TTSAudioMessageData {
  audioBase64: string;
  /** Zero-based sequence of this chunk within the utterance. */
  sequence?: number;
  /** Source text slice synthesized in this chunk (karaoke word mapping). */
  text?: string;
}

interface TTSEndMessageData {
  reason: string;
}

interface TTSErrorMessageData {
  message: string;
  code: string;
}

type TTSAudioMessage = TTSMessage<typeof TTS_EVENT_TYPES.AUDIO, TTSAudioMessageData>;
type TTSEndMessage = TTSMessage<typeof TTS_EVENT_TYPES.END, TTSEndMessageData>;
type TTSErrorMessage = TTSMessage<typeof TTS_EVENT_TYPES.ERROR, TTSErrorMessageData>;

/**
 * User-facing TTS options — intentionally excludes 'host' to prevent SSRF.
 * The host is set internally from a strict whitelist.
 */
export interface TTSStreamOptions {
  lang?: string;
  slow?: boolean;
  timeout?: number;
  splitPunct?: string;
}

/**
 * Internal options passed to googleTTS — includes host, which is never user-controllable.
 */
interface InternalTTSSOptions extends ValidatedTTSOptions {
  host: string;
}

export interface TTSProviderOptions {
  provider: 'google-free' | 'mock';
  logger?: pino.Logger;
  googleFreeConfig?: {
    logger?: pino.Logger;
  };
}

export class TTSProviderFactory {
  static create(options: TTSProviderOptions): TTSService {
    switch (options.provider) {
      case 'google-free':
        return new GoogleFreeTTSAdapter(options.googleFreeConfig || {});
      case 'mock':
        return new MockTTSAdapter();
      default:
        throw new Error(`TTS Provider not supported: ${options.provider}`);
    }
  }
}

// Default internal host — only changed internally, never from user input
const DEFAULT_TTS_HOST = 'https://translate.google.com';

/** Max characters per synthesis request (free API limit). */
const MAX_SYNTHESIS_CHARS = 200;

/**
 * Deterministically splits text into synthesizable parts, preferring
 * sentence boundaries so karaoke re-anchors at natural pauses (where
 * timing error concentrates). Overlong sentences fall back to word
 * boundaries. Parts are contiguous: joining them restores the word sequence,
 * which is what makes frontend word-span mapping exact.
 */
export function splitTextForSynthesis(text: string, maxLength = MAX_SYNTHESIS_CHARS): string[] {
  const sentences = splitIntoSentences(text);
  const parts: string[] = [];
  let current = '';

  const pushCurrent = (): void => {
    if (current.length > 0) {
      parts.push(current);
      current = '';
    }
  };

  // Pack whole sentences per part so every boundary (except the last) falls
  // at a natural pause — karaoke re-anchors there instead of mid-sentence.
  for (const sentence of sentences) {
    if (sentence.length > maxLength) {
      pushCurrent();
      parts.push(...splitByWords(sentence, maxLength));
      continue;
    }
    const candidate = current.length === 0 ? sentence : `${current} ${sentence}`;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      pushCurrent();
      current = sentence;
    }
  }
  pushCurrent();
  return parts;
}

/** Splits text at sentence terminators, keeping the delimiter. Never empty. */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…;:])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Word-boundary hard split used for overlong sentences. */
function splitByWords(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let current = text.trim();

  while (current.length > 0) {
    if (current.length <= maxLength) {
      chunks.push(current);
      break;
    }

    let splitIndex = current.lastIndexOf(' ', maxLength);
    if (splitIndex === -1) splitIndex = maxLength;

    chunks.push(current.substring(0, splitIndex).trim());
    current = current.substring(splitIndex).trim();
  }
  return chunks;
}

export class TTSStreamService extends Readable {
  public readonly options: InternalTTSSOptions;

  private readonly text: string;
  private isInitialized = false;
  private isError = false;
  private audioChunks: Array<{ base64: string; text: string }> = [];
  private currentChunkIndex = 0;

  constructor(text: string, options: TTSStreamOptions = {}) {
    super({ objectMode: true });
    this.text = text;

    // Validate user-provided options through Zod schema (SSRF prevention)
    const validated = validateTTSOptions({
      lang: options.lang,
      slow: options.slow,
      timeout: options.timeout,
      splitPunct: options.splitPunct,
    });

    // Set host internally — never from user input
    const host = DEFAULT_TTS_HOST;

    // Defense-in-depth: validate the internal host against whitelist
    if (!isValidTTSHost(host)) {
      throw new Error('Invalid TTS host configuration');
    }

    this.options = {
      ...validated,
      host,
    };
  }

  async _read(): Promise<void> {
    if (this.isError) {
      this.push(null);
      return;
    }

    if (!this.isInitialized) {
      this.isInitialized = true;

      if (!this.text.trim()) {
        this.push(this.formatMessage<TTSEndMessage>(TTS_EVENT_TYPES.END, { reason: 'empty_text' }));
        this.push(null);
        return;
      }

      try {
        // Split deterministically and synthesize per part so every audio
        // event can carry its exact source text for karaoke mapping.
        const parts = splitTextForSynthesis(this.text);
        const audios = await Promise.all(
          parts.map((part) =>
            googleTTS.getAudioBase64(part, {
              lang: this.options.lang,
              slow: this.options.slow,
              host: this.options.host,
              timeout: this.options.timeout,
            }),
          ),
        );
        this.audioChunks = audios.map((base64, index) => ({ base64, text: parts[index] }));
      } catch (error: unknown) {
        this.isError = true;
        const errorMessage = error instanceof Error ? error.message : 'Unknown generation error';

        this.push(
          this.formatMessage<TTSErrorMessage>(TTS_EVENT_TYPES.ERROR, {
            message: errorMessage,
            code: 'TTS_GENERATION_ERROR',
          }),
        );
        this.emit('error', error instanceof Error ? error : new Error(errorMessage));
        this.push(null);
        return;
      }
    }

    if (this.currentChunkIndex < this.audioChunks.length) {
      const chunk = this.audioChunks[this.currentChunkIndex];
      const sequence = this.currentChunkIndex;
      this.currentChunkIndex++;

      this.push(
        this.formatMessage<TTSAudioMessage>(TTS_EVENT_TYPES.AUDIO, {
          audioBase64: chunk.base64,
          sequence,
          text: chunk.text,
        }),
      );
    } else {
      this.push(this.formatMessage<TTSEndMessage>(TTS_EVENT_TYPES.END, { reason: 'completed' }));
      this.push(null);
    }
  }

  private formatMessage<T extends TTSMessage<string, unknown>>(
    type: T['type'],
    data: T['data'],
  ): string {
    try {
      const payload = data ?? { message: 'Invalid payload', code: 'UNKNOWN_DATA' };
      return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;
    } catch {
      const fallbackPayload = { message: 'Serialization error', code: 'JSON_STRINGIFY_ERROR' };
      return `event: ${TTS_EVENT_TYPES.ERROR}\ndata: ${JSON.stringify(fallbackPayload)}\n\n`;
    }
  }
}

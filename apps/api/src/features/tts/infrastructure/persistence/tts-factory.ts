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

export class TTSStreamService extends Readable {
  public readonly options: InternalTTSSOptions;

  private readonly text: string;
  private isInitialized = false;
  private isError = false;
  private audioChunks: string[] = [];
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
        const rawChunks = await googleTTS.getAllAudioBase64(this.text, this.options);
        this.audioChunks = rawChunks.map((chunk) => chunk.base64);
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
      const chunkBase64 = this.audioChunks[this.currentChunkIndex];
      this.currentChunkIndex++;

      this.push(
        this.formatMessage<TTSAudioMessage>(TTS_EVENT_TYPES.AUDIO, {
          audioBase64: chunkBase64,
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

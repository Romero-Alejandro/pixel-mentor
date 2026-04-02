import { Readable } from 'node:stream';

import * as googleTTS from '@sefinek/google-tts-api';
import type pino from 'pino';

import { GoogleFreeTTSAdapter } from './google-free.adapter';
import { MockTTSAdapter } from './mock-tts-adapter';

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

export interface TTSStreamOptions {
  lang?: string;
  slow?: boolean;
  host?: string;
  timeout?: number;
  splitPunct?: string;
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

export class TTSStreamService extends Readable {
  public readonly options: TTSStreamOptions;

  private readonly text: string;
  private isInitialized = false;
  private isError = false;
  private audioChunks: string[] = [];
  private currentChunkIndex = 0;

  constructor(text: string, options: TTSStreamOptions = {}) {
    super({ objectMode: true });
    this.text = text;
    this.options = {
      lang: 'en',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 60000,
      splitPunct: '.,;!?',
      ...options,
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

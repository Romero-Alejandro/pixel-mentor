import { Readable } from 'node:stream';
import * as googleTTS from '@sefinek/google-tts-api';

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

export class TTSStreamService extends Readable {
  public readonly options: TTSStreamOptions;
  private readonly text: string;

  private textChunks: string[] = [];
  private isInitialized = false;
  private currentTextIndex = 0;
  private isProcessing = false;

  constructor(text: string, options: TTSStreamOptions = {}) {
    super({ objectMode: true });
    this.text = text;
    this.options = {
      lang: 'es',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 30000,
      splitPunct: '.,;!?',
      ...options,
    };
  }

  async _read(): Promise<void> {
    if (this.isProcessing) return;

    if (!this.isInitialized) {
      this.initialize();
      if (this.textChunks.length === 0) {
        this.push(this.formatMessage(TTS_EVENT_TYPES.END, { reason: 'empty_text' }));
        this.push(null);
        return;
      }
    }

    if (this.currentTextIndex >= this.textChunks.length) {
      this.push(this.formatMessage(TTS_EVENT_TYPES.END, { reason: 'completed' }));
      this.push(null);
      return;
    }

    await this.processNextChunk();
  }

  private initialize(): void {
    this.isInitialized = true;
    if (!this.text.trim()) return;

    this.textChunks = this.splitTextIntoChunks(this.text, 200);
  }

  private splitTextIntoChunks(text: string, maxLength: number): string[] {
    const chunks: string[] = [];
    let currentText = text.trim();

    while (currentText.length > 0) {
      if (currentText.length <= maxLength) {
        chunks.push(currentText);
        break;
      }

      let splitIndex = -1;
      const punctuations = (this.options.splitPunct || '.,;!?').split('');

      for (const p of punctuations) {
        const lastPunct = currentText.lastIndexOf(p, maxLength);
        if (lastPunct > splitIndex) {
          splitIndex = lastPunct;
        }
      }

      if (splitIndex === -1) {
        splitIndex = currentText.lastIndexOf(' ', maxLength);
      }

      if (splitIndex === -1) {
        splitIndex = maxLength;
      } else {
        splitIndex += 1;
      }

      chunks.push(currentText.substring(0, splitIndex).trim());
      currentText = currentText.substring(splitIndex).trim();
    }

    return chunks.filter((c) => c.length > 0);
  }

  private async processNextChunk(): Promise<void> {
    this.isProcessing = true;
    const currentText = this.textChunks[this.currentTextIndex];

    try {
      // SANITIZACIÓN ESTRICTA DEL IDIOMA
      const rawLang = this.options.lang || 'es';
      let safeLang = rawLang;

      if (rawLang.includes('-')) {
        const parts = rawLang.split('-');
        // Convertir 'es-ES', 'es-AR' -> 'es' (excepto 'es-419' que sí es válido)
        if (parts[0] === 'es' && parts[1] !== '419') {
          safeLang = 'es';
          // Convertir 'en-US' -> 'en-us' (Google acepta minúsculas)
        } else if (parts[0] === 'en') {
          safeLang = rawLang.toLowerCase();
        } else {
          safeLang = parts[0];
        }
      }

      const base64 = await googleTTS.getAudioBase64(currentText, {
        lang: safeLang,
        slow: this.options.slow,
        host: this.options.host,
        timeout: this.options.timeout,
      });

      this.currentTextIndex++;
      this.isProcessing = false;

      this.push(
        this.formatMessage(TTS_EVENT_TYPES.AUDIO, {
          audioBase64: base64,
        }),
      );
    } catch (error: unknown) {
      this.isProcessing = false;
      const message = error instanceof Error ? error.message : 'Chunk failed';
      this.push(this.formatMessage(TTS_EVENT_TYPES.ERROR, { message, code: 'CHUNK_ERROR' }));
      this.push(null);
    }
  }

  private formatMessage(type: string, data: unknown): string {
    return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  }
}

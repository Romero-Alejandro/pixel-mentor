// apps/api/src/services/ttsStream.ts
import { Readable } from 'node:stream';

import * as googleTTS from '@sefinek/google-tts-api';

// SSE message types for TTS streaming
interface TTSMessage<T extends string, D = any> {
  type: T;
  data: D;
}

export const TTS_EVENT_TYPES = {
  AUDIO: 'audio',
  END: 'end',
  ERROR: 'error',
} as const;

interface TTSAudioMessageData {
  audioBase64: string;
}

interface TTSEndMessageData {
  reason?: string;
}

interface TTSErrorMessageData {
  message: string;
  code?: string;
}

type TTSAudioMessage = TTSMessage<typeof TTS_EVENT_TYPES.AUDIO, TTSAudioMessageData>;
type TTSEndMessage = TTSMessage<typeof TTS_EVENT_TYPES.END, TTSEndMessageData>;
type TTSErrorMessage = TTSMessage<typeof TTS_EVENT_TYPES.ERROR, TTSErrorMessageData>;

interface TTSStreamOptions {
  lang?: string;
  slow?: boolean;
  host?: string;
  timeout?: number;
  splitPunct?: string; // Add splitPunct for getAllAudioBase64
}

export class TTSStreamService extends Readable {
  private text: string;
  options: TTSStreamOptions;
  private isGenerating: boolean = false;

  constructor(text: string, options: TTSStreamOptions = {}) {
    super({ objectMode: true });
    this.text = text;
    this.options = {
      lang: 'en',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 60000, // 60 seconds for long text
      splitPunct: '.,;!?', // Default punctuation to split long text
      ...options,
    };
  }

  async _read() {
    if (this.isGenerating || this.text.length === 0) {
      if (!this.isGenerating && this.text.length === 0) {
        this.push(this.formatMessage<TTSEndMessage>(TTS_EVENT_TYPES.END, { reason: 'completed' }));
        this.push(null); // End the stream
      }
      return;
    }

    this.isGenerating = true;
    try {
      const audioChunks = await googleTTS.getAllAudioBase64(this.text, this.options);

      for (const chunk of audioChunks) {
        this.push(
          this.formatMessage<TTSAudioMessage>(TTS_EVENT_TYPES.AUDIO, { audioBase64: chunk.base64 }),
        );
      }

      this.isGenerating = false;
      this.text = ''; // Clear text after processing
      this.push(this.formatMessage<TTSEndMessage>(TTS_EVENT_TYPES.END, { reason: 'completed' }));
      this.push(null); // End the stream
    } catch (error: any) {
      console.error('Failed to generate TTS audio:', error);
      this.push(
        this.formatMessage<TTSErrorMessage>(TTS_EVENT_TYPES.ERROR, {
          message: error.message,
          code: 'TTS_GENERATION_ERROR',
        }),
      );
      this.emit('error', error);
      this.push(null); // End the stream on error
      this.isGenerating = false;
    }
  }

  private formatMessage<T extends TTSMessage<any, any>>(type: string, data: any): string {
    let payload: any = data;

    // Handle undefined/null data to ensure valid JSON
    if (payload === undefined || payload === null) {
      payload = { message: 'Unknown error', code: 'UNKNOWN' };
    }

    // Ensure the payload can be stringified to valid JSON
    try {
      const stringified = JSON.stringify(payload);
      if (stringified === undefined) {
        payload = { message: 'Unknown error', code: 'UNKNOWN' };
      }
    } catch {
      payload = { message: 'Unknown error', code: 'UNKNOWN' };
    }

    const message: T = { type, data: payload } as T;
    return `event: ${type}\ndata: ${JSON.stringify(message.data)}\n\n`;
  }
}

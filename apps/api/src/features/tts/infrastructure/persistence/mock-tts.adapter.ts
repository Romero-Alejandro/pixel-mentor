import { Readable } from 'node:stream';

import type { ITTSService, TTSResponse } from '@/features/tts/domain/ports/tts-service.port';

export class MockTTSAdapter implements ITTSService {
  createStream(): Readable {
    return new Readable({
      read() {
        this.push(null);
      },
    });
  }

  async speak(): Promise<TTSResponse> {
    return {
      audioContent: Buffer.alloc(0),
      audioContentBase64: '',
      voice: {
        name: 'mock',
        displayName: 'Mock Voice',
        languageCode: 'es',
        ssmlGender: 'NEUTRAL',
        supportedCharacters: [],
      },
    };
  }

  async listVoices(): Promise<any[]> {
    return [];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

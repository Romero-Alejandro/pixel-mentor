import { Readable } from 'node:stream';

import type { TTSService } from '@/features/tts/domain/ports/tts-service.port.js';

export class MockTTSAdapter implements TTSService {
  createStream(): Readable {
    return new Readable({
      read() {
        this.push(null);
      },
    });
  }

  async speak(): Promise<any> {
    return {};
  }
  async listVoices(): Promise<any[]> {
    return [];
  }
  async isAvailable(): Promise<boolean> {
    return true;
  }
}

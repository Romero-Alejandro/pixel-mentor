import type pino from 'pino';
import type {
  TTSService,
  Voice,
  VoiceCharacter,
  TTSOptions,
  TTSResponse,
} from '@/domain/ports/tts-service.js';
import { GoogleFreeTTSAdapter, type GoogleFreeTTSConfig } from './google-free.adapter.js';

/**
 * TTS Provider Types
 */
export type TTSProvider = 'google-free' | 'mock';

/**
 * TTS Factory Options
 */
export interface TTSFactoryOptions {
  provider: TTSProvider;
  googleFreeConfig?: GoogleFreeTTSConfig;
  logger?: pino.Logger;
}

/**
 * Mock TTS Adapter for development/testing
 */
export class MockTTSAdapter implements TTSService {
  private logger?: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger;
  }

  async speak(text: string, options?: TTSOptions): Promise<TTSResponse> {
    this.logger?.info({ text: text.substring(0, 30), options }, 'Mock TTS: would speak');

    // Return empty audio buffer for testing
    return {
      audioContent: Buffer.alloc(0),
      audioContentBase64: '',
      voice: {
        name: 'mock-voice',
        displayName: 'Mock Voice',
        languageCode: 'es-ES',
        ssmlGender: 'FEMALE',
        supportedCharacters: ['person'],
      },
    };
  }

  async listVoices(): Promise<Voice[]> {
    return [
      {
        name: 'mock-voice',
        displayName: 'Mock Voice',
        languageCode: 'es-ES',
        ssmlGender: 'FEMALE',
        supportedCharacters: ['person'],
      },
    ];
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}

/**
 * TTS Provider Factory
 *
 * Creates TTS service instances based on configuration.
 * Supports:
 * - google-free: Free Google TTS with FFmpeg post-processing
 * - mock: For development/testing
 */
export class TTSProviderFactory {
  private static instance: TTSService | null = null;
  private static provider: TTSProvider = 'google-free';

  /**
   * Create or get cached TTS service instance
   */
  static create(options: TTSFactoryOptions): TTSService {
    const { provider, googleFreeConfig, logger } = options;

    // Return cached instance if provider hasn't changed
    if (this.instance && this.provider === provider) {
      return this.instance;
    }

    this.provider = provider;

    switch (provider) {
      case 'google-free':
        // Free Google TTS - no credentials required
        this.instance = new GoogleFreeTTSAdapter(googleFreeConfig || { logger });
        break;

      case 'mock':
        this.instance = new MockTTSAdapter(logger);
        break;

      default:
        throw new Error(`Unsupported TTS provider: ${provider}`);
    }

    logger?.info({ provider }, 'TTS service initialized');
    return this.instance;
  }

  /**
   * Get current instance (must call create first)
   */
  static getInstance(): TTSService {
    if (!this.instance) {
      throw new Error('TTS service not initialized. Call create() first.');
    }
    return this.instance;
  }

  /**
   * Reset instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
    this.provider = 'google-free';
  }
}

// Re-export types for convenience
export type { VoiceCharacter, TTSOptions, TTSResponse };

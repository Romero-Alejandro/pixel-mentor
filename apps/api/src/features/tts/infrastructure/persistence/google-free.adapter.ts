import type { Readable } from 'node:stream';

import * as googleTTS from '@sefinek/google-tts-api';
import type pino from 'pino';

import { AudioProcessor } from './audio-processor.js';

import { TTSStreamService } from '@/features/tts/infrastructure/persistence/tts-factory.js';
import type {
  TTSService,
  TTSOptions,
  TTSResponse,
  Voice,
  VoiceCharacter,
} from '@/features/tts/domain/ports/tts-service.port.js';

export interface GoogleFreeTTSConfig {
  logger?: pino.Logger;
}

export class GoogleFreeTTSAdapter implements TTSService {
  private readonly logger?: pino.Logger;

  constructor(config: GoogleFreeTTSConfig) {
    this.logger = config.logger;
  }

  /**
   * Genera un stream de audio (SSE) mapeando correctamente el idioma
   */
  createStream(text: string, options: TTSOptions = {}): Readable {
    const mappedLang = this.getLanguageCode(options.languageCode);

    this.logger?.debug(
      { original: options.languageCode, mapped: mappedLang },
      'Creating TTS Stream',
    );

    return new TTSStreamService(text, {
      ...options,
      lang: mappedLang, // Aseguramos que Google reciba 'es' y no 'es-ES'
    });
  }

  /**
   * Genera el audio completo en una sola respuesta
   */
  async speak(text: string, options: TTSOptions = {}): Promise<TTSResponse> {
    const { character = 'person', speakingRate = 1.0, pitch = 0 } = options;
    const lang = this.getLanguageCode(options.languageCode);
    const slow = speakingRate < 0.8;

    try {
      const textChunks = this.splitTextIntoChunks(text, 200);
      const audioChunks: Buffer[] = [];

      for (const chunk of textChunks) {
        const base64 = await googleTTS.getAudioBase64(chunk, { lang, slow });
        audioChunks.push(Buffer.from(base64, 'base64'));
      }

      // Usamos el tipo Buffer global para evitar errores de SharedArrayBuffer
      let audioBuffer: Buffer = Buffer.concat(audioChunks);

      if (audioBuffer.length === 0) {
        throw new Error('No audio content generated');
      }

      const needsProcessing = character !== 'person' || speakingRate !== 1.0 || pitch !== 0;

      if (needsProcessing) {
        const processed = await AudioProcessor.applyEffects(audioBuffer, {
          speed: speakingRate,
          pitch,
          character: character !== 'person' ? character : undefined,
        });
        // Solución al error de tipos: Buffer.from asegura compatibilidad con Buffer<ArrayBuffer>
        audioBuffer = Buffer.from(processed);
      }

      const characterDesc = this.getCharacterDescription(character, speakingRate, pitch);

      return {
        audioContent: audioBuffer,
        audioContentBase64: audioBuffer.toString('base64'),
        voice: {
          name: `Google Free (${lang}) - ${characterDesc}`,
          displayName: characterDesc,
          languageCode: lang,
          ssmlGender: 'FEMALE',
          supportedCharacters: ['robot', 'animal', 'person', 'cartoon'],
        },
      };
    } catch (error) {
      this.logger?.error({ error }, 'TTS synthesis error');
      throw new Error(`TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listVoices(): Promise<Voice[]> {
    return [
      {
        name: 'es-google-free',
        displayName: 'Español Estándar',
        languageCode: 'es',
        ssmlGender: 'FEMALE',
        supportedCharacters: ['person', 'robot', 'animal', 'cartoon'],
      },
      {
        name: 'en-google-free',
        displayName: 'English Standard',
        languageCode: 'en',
        ssmlGender: 'FEMALE',
        supportedCharacters: ['person', 'robot', 'animal', 'cartoon'],
      },
    ];
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await googleTTS.getAudioBase64('ping', { lang: 'es', slow: false });
      return res.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Divide el texto respetando el límite de 200 caracteres de la API gratuita
   */
  private splitTextIntoChunks(text: string, maxLength: number): string[] {
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

  /**
   * Mapea códigos de idioma largos a los formatos cortos aceptados por Google Translate
   */
  private getLanguageCode(code?: string): string {
    const langMap: Record<string, string> = {
      'es-ES': 'es',
      'es-MX': 'es-419',
      'es-AR': 'es',
      'es-US': 'es',
      'en-US': 'en',
      'en-GB': 'en-gb',
    };

    // Si no se encuentra en el mapa, intentamos tomar los primeros 2 caracteres (ISO 639-1)
    if (code && !langMap[code]) {
      const shortCode = code.split('-')[0];
      return shortCode.length === 2 ? shortCode : 'es';
    }

    return langMap[code || ''] || 'es';
  }

  private getCharacterDescription(character: VoiceCharacter, speed: number, pitch: number): string {
    const baseNames: Record<VoiceCharacter, string> = {
      person: 'Voz Estándar',
      robot: 'Robot',
      animal: 'Animal',
      cartoon: 'Cómico',
    };

    const modifiers: string[] = [];
    if (speed < 0.8) modifiers.push('Lenta');
    else if (speed > 1.3) modifiers.push('Rápida');

    if (pitch > 5) modifiers.push('Aguda');
    else if (pitch < -5) modifiers.push('Grave');

    const base = baseNames[character] || 'Voz Estándar';
    return modifiers.length > 0 ? `${base} (${modifiers.join(', ')})` : base;
  }
}

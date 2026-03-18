import { spawn } from 'node:child_process';

import * as googleTTS from '@sefinek/google-tts-api';
import type pino from 'pino';

import type {
  TTSService,
  TTSOptions,
  TTSResponse,
  Voice,
  VoiceCharacter,
} from '@/domain/ports/tts-service.js';

export interface GoogleFreeTTSConfig {
  logger?: pino.Logger;
}

/**
 * FFmpeg-based audio post-processing for character effects, pitch, and speed control
 */
async function processAudioWithFFmpeg(
  audioBuffer: Buffer,
  options: { speed?: number; pitch?: number; character?: string },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const args: string[] = ['-i', 'pipe:0', '-y'];
    const filters: string[] = [];

    // Apply character-specific effects
    if (options.character) {
      switch (options.character) {
        case 'robot':
          // Robot: echo effect for mechanical sound
          filters.push('aecho=0.8:0.9:30:0.3');
          break;
        case 'animal':
          // Animal: vibrato for playful sound
          filters.push('vibrato=f=6:d=0.3');
          break;
        case 'cartoon':
          // Cartoon: flanger for whimsical sound
          filters.push('flanger=delay=0:depth=0.5:speed=1');
          break;
      }
    }

    // Speed: using atempo (0.5 to 2.0 range)
    if (options.speed && options.speed !== 1.0) {
      let speed = options.speed;
      while (speed < 0.5 || speed > 2.0) {
        if (speed < 0.5) {
          filters.push('atempo=0.5');
          speed *= 2;
        } else if (speed > 2.0) {
          filters.push('atempo=2.0');
          speed /= 2;
        }
      }
      if (speed !== 1.0) {
        filters.push(`atempo=${speed}`);
      }
    }

    // Pitch: using rubberband pitch shift (in semitones)
    if (options.pitch && options.pitch !== 0) {
      const pitchRate = Math.pow(2, options.pitch / 12);
      filters.push(`rubberband=pitch=${pitchRate}`);
    }

    if (filters.length > 0) {
      args.push('-af', filters.join(','));
    }

    args.push('-acodec', 'libmp3lame', '-ab', '48k', '-ar', '24000', '-f', 'mp3', 'pipe:1');

    const ffmpeg = spawn('ffmpeg', args);
    const outputChunks: Buffer[] = [];
    const errorChunks: Buffer[] = [];

    ffmpeg.stdout.on('data', (chunk: Buffer) => {
      outputChunks.push(chunk);
    });

    ffmpeg.stderr.on('data', (chunk: Buffer) => {
      errorChunks.push(chunk);
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(outputChunks));
      } else {
        reject(new Error(`FFmpeg failed: ${Buffer.concat(errorChunks).toString()}`));
      }
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });

    ffmpeg.stdin.write(audioBuffer);
    ffmpeg.stdin.end();
  });
}

export class GoogleFreeTTSAdapter implements TTSService {
  private logger?: pino.Logger;

  constructor(config: GoogleFreeTTSConfig) {
    this.logger = config.logger;
  }

  async speak(text: string, options: TTSOptions = {}): Promise<TTSResponse> {
    const { character = 'person', speakingRate = 1.0, pitch = 0 } = options;

    this.logger?.debug(
      { text: text.substring(0, 50), character, speakingRate, pitch },
      'Google Free TTS request',
    );

    try {
      const lang = this.getLanguageCode(options.languageCode);
      const useSlowParam = speakingRate < 0.5;
      const slow = speakingRate < 0.8;

      const audioBase64 = await googleTTS.getAudioBase64(text, { lang, slow });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let audioBuffer: any = Buffer.from(audioBase64, 'base64');

      if (audioBuffer.length === 0) {
        throw new Error('No audio content returned from Google TTS');
      }

      // Apply character effects + speed/pitch processing
      const needsProcessing = character !== 'person' || speakingRate !== 1.0 || pitch !== 0;

      if (needsProcessing) {
        this.logger?.debug({ character, speakingRate, pitch }, 'Applying FFmpeg processing');

        let ffSpeed = speakingRate;
        if (useSlowParam && speakingRate < 0.5) {
          ffSpeed = 0.5;
        }

        audioBuffer = (await processAudioWithFFmpeg(audioBuffer, {
          speed: ffSpeed !== 1.0 ? ffSpeed : undefined,
          pitch: pitch !== 0 ? pitch : undefined,
          character: character !== 'person' ? character : undefined,
        })) as unknown as Buffer;

        this.logger?.debug({ processedSize: audioBuffer.length }, 'FFmpeg processing complete');
      }

      const processedBase64 = audioBuffer.toString('base64');

      this.logger?.info(
        { size: audioBuffer.length, lang, character, speakingRate, pitch },
        'Google Free TTS success',
      );

      const characterDesc = this.getCharacterDescription(character, speakingRate, pitch);

      return {
        audioContent: audioBuffer,
        audioContentBase64: processedBase64,
        voice: {
          name: `Google Free (${lang}) - ${characterDesc}`,
          displayName: characterDesc,
          languageCode: lang,
          ssmlGender: 'FEMALE',
          supportedCharacters: ['robot', 'animal', 'person', 'cartoon'],
        },
      };
    } catch (error) {
      this.logger?.error({ error }, 'Google Free TTS error');
      throw new Error(
        `TTS synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async listVoices(_languageCode?: string): Promise<Voice[]> {
    return this.getDefaultVoices();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const audio = await googleTTS.getAudioBase64('test', { lang: 'es', slow: false });
      return audio.length > 0;
    } catch {
      return false;
    }
  }

  private getLanguageCode(code?: string): string {
    const langMap: Record<string, string> = {
      'es-ES': 'es',
      'es-MX': 'es-419',
      'es-US': 'es',
      'es-AR': 'es',
      'en-US': 'en',
      'en-GB': 'en-gb',
    };
    return langMap[code || 'es-ES'] || 'es';
  }

  private getCharacterDescription(character: VoiceCharacter, speed: number, pitch: number): string {
    const baseNames: Record<VoiceCharacter, string> = {
      person: 'Voz Estándar',
      robot: 'Robot',
      animal: 'Animal',
      cartoon: 'Cómico',
    };

    let desc = baseNames[character] || 'Voz Estándar';
    const modifiers: string[] = [];

    if (speed < 0.8) {
      modifiers.push('Lenta');
    } else if (speed > 1.3) {
      modifiers.push('Rápida');
    }

    if (pitch > 5) {
      modifiers.push('Aguda');
    } else if (pitch < -5) {
      modifiers.push('Grave');
    }

    if (modifiers.length > 0) {
      desc += ` (${modifiers.join(', ')})`;
    }

    return desc;
  }

  private getDefaultVoices(): Voice[] {
    return [
      {
        name: 'Google Free Spanish - Voz Estándar',
        displayName: 'Voz Estándar (Español)',
        languageCode: 'es',
        ssmlGender: 'FEMALE',
        supportedCharacters: ['person', 'robot', 'animal', 'cartoon'] as VoiceCharacter[],
      },
      {
        name: 'Google Free English',
        displayName: 'English (Inglés)',
        languageCode: 'en',
        ssmlGender: 'FEMALE',
        supportedCharacters: ['person', 'robot', 'animal', 'cartoon'] as VoiceCharacter[],
      },
    ];
  }
}

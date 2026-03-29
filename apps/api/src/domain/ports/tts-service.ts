import type { Readable } from 'node:stream';

export type VoiceCharacter = 'robot' | 'animal' | 'person' | 'cartoon';

export interface Voice {
  name: string;
  displayName: string;
  languageCode: string;
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  supportedCharacters: VoiceCharacter[];
}

export interface TTSOptions {
  languageCode?: string;
  speakingRate?: number;
  pitch?: number;
  character?: VoiceCharacter;
}

export interface TTSResponse {
  audioContent: Buffer;
  audioContentBase64: string;
  voice: Voice;
}

export interface TTSService {
  speak(text: string, options?: TTSOptions): Promise<TTSResponse>;
  createStream(text: string, options?: TTSOptions): Readable;
  listVoices(languageCode?: string): Promise<Voice[]>;
  isAvailable(): Promise<boolean>;
}

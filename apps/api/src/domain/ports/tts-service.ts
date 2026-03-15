/**
 * TTS Service Port - Interface for Text-to-Speech providers
 *
 * This port defines the contract for any TTS implementation.
 * Currently supports Google Cloud TTS, with extensibility for other providers.
 */

// Voice character types for persona simulation
export type VoiceCharacter =
  | 'robot' // Monotone, slower, lower pitch
  | 'animal' // Higher pitch, faster
  | 'person' // Natural voice (default)
  | 'cartoon'; // Exaggerated, expressive

export interface TTSOptions {
  /** Voice character/persona to simulate */
  character?: VoiceCharacter;
  /** Language code (default: es-ES for Spanish) */
  languageCode?: string;
  /** Speech rate (0.25 - 4.0, default: 1.0) */
  speakingRate?: number;
  /** Pitch adjustment (-20.0 to 20.0, default: 0) */
  pitch?: number;
  /** Volume gain (-96.0 to 16.0, default: 0) */
  audioGain?: number;
}

export interface Voice {
  /** Unique voice identifier */
  name: string;
  /** Display name */
  displayName: string;
  /** Language code */
  languageCode: string;
  /** SSML gender */
  ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL';
  /** Available character types */
  supportedCharacters: VoiceCharacter[];
}

export interface TTSResponse {
  /** Audio buffer in MP3 format */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  audioContent: any;
  /** Audio content as base64 (for frontend) */
  audioContentBase64: string;
  /** Voice used */
  voice: Voice;
}

/**
 * TTS Service Interface
 *
 * Implement this interface to create new TTS providers.
 * All implementations must be async and return audio data.
 */
export interface TTSService {
  /**
   * Synthesize text to speech
   * @param text - Text to synthesize
   * @param options - Synthesis options including voice character
   * @returns Audio buffer and metadata
   */
  speak(text: string, options?: TTSOptions): Promise<TTSResponse>;

  /**
   * List available voices for a language
   * @param languageCode - Language code (e.g., 'es-ES')
   * @returns Available voices
   */
  listVoices(languageCode?: string): Promise<Voice[]>;

  /**
   * Check if the TTS service is available
   */
  isAvailable(): Promise<boolean>;
}

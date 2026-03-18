// packages/shared/src/types/tts.ts

export const TTS_EVENT_TYPES = {
  AUDIO: 'audio',
  END: 'end',
  ERROR: 'error',
} as const;

export type TTSEventType = (typeof TTS_EVENT_TYPES)[keyof typeof TTS_EVENT_TYPES];

export interface TTSMessage<T extends TTSEventType = TTSEventType, D = any> {
  type: T;
  data: D;
}

export interface TTSAudioMessageData {
  audioBase64: string;
  // Add other relevant metadata if needed, e.g., 'sequence', 'sampleRate', 'mimeType'
}

export type TTSAudioMessage = TTSMessage<typeof TTS_EVENT_TYPES.AUDIO, TTSAudioMessageData>;

export interface TTSEndMessageData {
  reason?: string;
}

export type TTSEndMessage = TTSMessage<typeof TTS_EVENT_TYPES.END, TTSEndMessageData>;

export interface TTSErrorMessageData {
  message: string;
  code?: string;
}

export type TTSErrorMessage = TTSMessage<typeof TTS_EVENT_TYPES.ERROR, TTSErrorMessageData>;

import { useState, useRef, useCallback, useEffect } from 'react';
import type { TTSAudioMessageData, TTSErrorMessageData } from '@pixel-mentor/shared';

import { apiClient, getToken } from '@/services/api-client';
import { logger } from '@/utils/logger';

// Voice settings for backend TTS
export interface VoiceSettings {
  character?: 'person' | 'robot' | 'animal' | 'cartoon';
  speakingRate?: number;
  pitch?: number;
  languageCode?: string;
}

// Legacy type for browser TTS
export interface LegacyVoiceSettings {
  rate: number;
  pitch: number;
  volume: number;
}

// Confirmation phrases
const CONFIRMATION_PHRASES = [
  'Me estás preguntando si {text}, ¿es correcto?',
  'Entonces quieres saber sobre {text}, ¿verdad?',
  'Dijiste {text}, ¿estoy en lo correcto?',
  'Entendí que preguntas sobre {text}, ¿sí?',
];

export interface UseVoiceReturn {
  isSpeaking: boolean;
  speak: (text: string, voiceSettings?: VoiceSettings) => Promise<boolean>;
  stopSpeaking: () => void;
  isListening: boolean;
  transcript: string;
  confidence: number;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  error: string | null;
  availableVoices: SpeechSynthesisVoice[];
  isSupported: boolean;
  isSpeechSupported: boolean;
  isRecognitionSupported: boolean;
  getCurrentAudioElement: () => HTMLAudioElement | null;
  /** Chunk-aware sync snapshot for karaoke hooks (null when not streaming). */
  getAudioSyncInfo: () => AudioSyncInfo | null;
  /** Which TTS engine is sounding, null when silent (Phase 0 observability). */
  getActiveEngine: () => ActiveTTSEngine | null;
  /** Signals that the audio element is available for sync. */
  audioElementReady: boolean;
}

/** Which TTS engine is currently sounding (Phase 0 observability). */
export type ActiveTTSEngine = 'stream' | 'http' | 'browser';

// ---- Streaming karaoke sync contract ----

/** Per-chunk metadata for karaoke word mapping (playback order). */
export interface AudioSyncChunk {
  /** MP3 payload size in bytes (proportional to spoken duration). */
  bytes: number;
  /** Measured element duration in seconds, null until loadedmetadata. */
  duration: number | null;
  /** Exact source text slice of this chunk (when the server annotates it). */
  text?: string;
  /** Zero-based sequence within the utterance (when annotated). */
  sequence?: number;
}

/** Snapshot describing which streamed chunk is currently sounding. */
export interface AudioSyncInfo {
  /** Currently sounding chunk element. */
  element: HTMLAudioElement;
  /** Index of the current chunk in `chunks`. */
  chunkIndex: number;
  /** True when the stream ended AND this is the final chunk. */
  isLastChunk: boolean;
  /** Per-chunk metadata in playback order. */
  chunks: AudioSyncChunk[];
}

// Debug logging
const debugLog = (...args: unknown[]) => {
  logger.log('[Voice]', ...args);
};

const debugError = (...args: unknown[]) => {
  logger.error('[Voice ERROR]', ...args);
};

export function useVoice(): UseVoiceReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  /** Signals that the audio element is available for sync hooks. Triggers re-render. */
  const [audioElementReady, setAudioElementReady] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Streaming TTS refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const audioQueueRef = useRef<Array<{ element: HTMLAudioElement; url: string; index: number }>>(
    [],
  );
  const currentAudioRef = useRef<{
    element: HTMLAudioElement;
    url: string;
    index: number;
  } | null>(null);
  const httpAudioRef = useRef<HTMLAudioElement | null>(null);
  const httpAudioUrlRef = useRef<string | null>(null);
  const streamEndedRef = useRef(false);
  const audioReadyFiredRef = useRef(false);
  // Per-chunk karaoke metadata (playback order) + index of sounding chunk.
  const chunkMetaRef = useRef<AudioSyncChunk[]>([]);
  const chunkIndexRef = useRef(0);
  // Which TTS engine is sounding (null when silent).
  const activeEngineRef = useRef<ActiveTTSEngine | null>(null);
  // Resolver for the in-flight speakHTTP promise (HTTP audio or browser-TTS
  // fallback). stopSpeaking() settles it explicitly so callers never hang when
  // pause()/cancel() suppress onended/onerror (the 30s interaction-lock trap).
  const pendingSpeakResolveRef = useRef<((value: boolean) => void) | null>(null);

  // Check browser support
  const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isRecognitionSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const isSupported = isSpeechSupported && isRecognitionSupported;

  // Load available voices - with multiple retry strategies
  useEffect(() => {
    if (!isSpeechSupported) return;

    const loadVoices = () => {
      try {
        const voices = window.speechSynthesis.getVoices();
        debugLog('Voices loaded:', voices.length);
        setAvailableVoices(voices);

        // If no voices yet, schedule another load attempt
        if (voices.length === 0) {
          debugLog('No voices found, will retry...');
        }
      } catch (e) {
        debugError('Error loading voices:', e);
      }
    };

    // Method 1: Load immediately
    loadVoices();

    // Method 2: Wait for onvoiceschanged event (most browsers)
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Method 3: Poll for voices (some browsers load async)
    // Limit to max 3 seconds total (6 attempts max) to avoid infinite polling
    let attempts = 0;
    const maxAttempts = 6; // 6 * 500ms = 3000ms
    const pollInterval = setInterval(() => {
      attempts++;
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        debugLog('Voices loaded via poll:', voices.length);
        setAvailableVoices(voices);
        clearInterval(pollInterval);
      } else if (attempts >= maxAttempts) {
        debugLog(
          'Voice polling completed after',
          attempts,
          'attempts — no voices found. Browser TTS fallback will be disabled.',
        );
        clearInterval(pollInterval);
      }
    }, 500);

    // Cleanup
    return () => {
      clearInterval(pollInterval);
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSpeechSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Settle any in-flight speakHTTP promise so its awaiter never hangs.
      if (pendingSpeakResolveRef.current) {
        pendingSpeakResolveRef.current(false);
        pendingSpeakResolveRef.current = null;
      }
      // Cancel any ongoing TTS operations
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Clear streaming audio
      for (const item of audioQueueRef.current) {
        try {
          URL.revokeObjectURL(item.url);
        } catch {}
      }
      audioQueueRef.current = [];
      if (currentAudioRef.current) {
        try {
          currentAudioRef.current.element.pause();
          URL.revokeObjectURL(currentAudioRef.current.url);
        } catch {}
        currentAudioRef.current = null;
      }
      // Clear HTTP audio
      if (httpAudioRef.current) {
        try {
          httpAudioRef.current.pause();
        } catch {}
      }
      if (httpAudioUrlRef.current) {
        try {
          URL.revokeObjectURL(httpAudioUrlRef.current);
        } catch {}
      }
      // Browser TTS
      if (isSpeechSupported) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
      // Recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [isSpeechSupported]);

  const stopSpeaking = useCallback(() => {
    // Settle the in-flight speakHTTP promise explicitly: pause()/cancel()
    // below suppress onended/onerror, which would otherwise leave the speak()
    // awaiter (and the interaction lock) hanging until the 30s timeout.
    if (pendingSpeakResolveRef.current) {
      pendingSpeakResolveRef.current(false);
      pendingSpeakResolveRef.current = null;
    }

    // Abort current operation if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop streaming resources
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // Clear streaming audio queue
    for (const item of audioQueueRef.current) {
      try {
        URL.revokeObjectURL(item.url);
      } catch {
        // ignore
      }
    }
    audioQueueRef.current = [];

    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.element.pause();
        URL.revokeObjectURL(currentAudioRef.current.url);
      } catch {
        // ignore
      }
      currentAudioRef.current = null;
    }

    // Stop HTTP TTS audio
    if (httpAudioRef.current) {
      try {
        httpAudioRef.current.pause();
      } catch {
        // ignore
      }
      httpAudioRef.current = null;
    }
    if (httpAudioUrlRef.current) {
      try {
        URL.revokeObjectURL(httpAudioUrlRef.current);
      } catch {
        // ignore
      }
      httpAudioUrlRef.current = null;
    }

    // Stop browser TTS
    if (isSpeechSupported) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {
        debugError('Error stopping speech synthesis:', e);
      }
    }

    setIsSpeaking(false);
    setError(null);
    setAudioElementReady(false);
    // Reset the audio ready flag to allow re-firing on restart
    audioReadyFiredRef.current = false;
    // Reset karaoke chunk tracking
    chunkMetaRef.current = [];
    chunkIndexRef.current = 0;
    activeEngineRef.current = null;
  }, [isSpeechSupported, setIsSpeaking, setError]);

  const speakHTTP = useCallback(
    async (text: string, voiceSettings?: VoiceSettings): Promise<boolean> => {
      setError(null);
      setIsSpeaking(true);
      activeEngineRef.current = 'http';

      // Validate input
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        debugLog('Empty text, skipping speakHTTP');
        setIsSpeaking(false);
        return false;
      }

      const settings = {
        character: voiceSettings?.character || 'person',
        languageCode: voiceSettings?.languageCode || 'es-ES',
        speakingRate: voiceSettings?.speakingRate ?? 1.0,
        pitch: voiceSettings?.pitch ?? 0,
      };

      try {
        debugLog('speakHTTP: Trying backend HTTP TTS...', settings);
        const response = await apiClient.post('/api/tts/speak', {
          text: text.trim(),
          character: settings.character,
          languageCode: settings.languageCode,
          speakingRate: settings.speakingRate,
          pitch: settings.pitch,
        });

        const data = response.data;
        if (!data.audioContent) {
          throw new Error('No audio content in response');
        }

        // Decode base64 audio and play
        const audioBytes = Uint8Array.from(atob(data.audioContent), (c) => c.charCodeAt(0));
        const audioBlob = new Blob([audioBytes], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        httpAudioUrlRef.current = audioUrl;
        const audio = new Audio(audioUrl);
        httpAudioRef.current = audio;

        await audio.play();
        debugLog('HTTP TTS started successfully!');
        notifyAudioReady();

        // Wait for audio to actually finish playing.
        // The resolver is registered so stopSpeaking()/unmount can settle it
        // explicitly when pause() suppresses onended/onerror.
        return new Promise<boolean>((resolve) => {
          pendingSpeakResolveRef.current = resolve;
          const settle = (value: boolean): void => {
            pendingSpeakResolveRef.current = null;
            resolve(value);
          };
          audio.onended = () => {
            debugLog('HTTP TTS ended');
            setIsSpeaking(false);
            httpAudioRef.current = null;
            if (httpAudioUrlRef.current) {
              URL.revokeObjectURL(httpAudioUrlRef.current);
              httpAudioUrlRef.current = null;
            }
            settle(true);
          };
          audio.onerror = () => {
            debugError('Audio playback error');
            setError('Error al reproducir audio');
            setIsSpeaking(false);
            if (httpAudioRef.current) {
              httpAudioRef.current = null;
            }
            if (httpAudioUrlRef.current) {
              URL.revokeObjectURL(httpAudioUrlRef.current);
              httpAudioUrlRef.current = null;
            }
            settle(false);
          };
        });
      } catch (backendErr) {
        debugError('HTTP TTS failed:', backendErr);

        // Fallback to browser TTS
        debugLog('Falling back to browser TTS...');

        try {
          const utterance = new SpeechSynthesisUtterance(text.trim());
          activeEngineRef.current = 'browser';

          // Apply voice settings if possible
          utterance.rate = voiceSettings?.speakingRate ?? 1.0;
          utterance.pitch = voiceSettings?.pitch ?? 0;
          if (voiceSettings?.languageCode) {
            utterance.lang = voiceSettings.languageCode;
          }

          // Wait for browser TTS to actually finish.
          // Registered for explicit settlement (see HTTP path above):
          // speechSynthesis.cancel() usually fires onerror, but not on every
          // engine — the ref guarantees the awaiter never hangs.
          return new Promise<boolean>((resolve) => {
            pendingSpeakResolveRef.current = resolve;
            const settle = (value: boolean): void => {
              pendingSpeakResolveRef.current = null;
              resolve(value);
            };
            utterance.onend = () => {
              debugLog('Browser TTS ended');
              setIsSpeaking(false);
              settle(true);
            };
            utterance.onerror = (event) => {
              debugError('Browser TTS error:', event.error);
              setIsSpeaking(false);
              if (event.error !== 'interrupted' && event.error !== 'canceled') {
                setError(`Error de voz: ${event.error}`);
              }
              settle(false);
            };
            window.speechSynthesis.speak(utterance);
          });
        } catch (browserErr) {
          debugError('Browser TTS also failed:', browserErr);
          setError('No se pudo reproducir la voz');
          setIsSpeaking(false);
          return false;
        }
      }
    },
    [apiClient, setError, setIsSpeaking],
  );

  const speakStream = useCallback(
    async (text: string, voiceSettings?: VoiceSettings, signal?: AbortSignal): Promise<boolean> => {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        debugLog('Empty text, skipping speakStream');
        return false;
      }

      // Fresh karaoke chunk tracking for this utterance
      chunkMetaRef.current = [];
      chunkIndexRef.current = 0;
      activeEngineRef.current = 'stream';

      const settings = {
        languageCode: voiceSettings?.languageCode || 'es-ES',
        speakingRate: voiceSettings?.speakingRate ?? 1.0,
      };

      // Helper to convert base64 to Blob
      const base64ToBlob = (base64: string, mimeType: string): Blob => {
        const sliceSize = 1024;
        const byteCharacters = atob(base64);
        const byteArrays: Uint8Array[] = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
          const slice = byteCharacters.slice(offset, offset + sliceSize);
          const byteNumbers = new Array(slice.length);
          for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          byteArrays.push(byteArray);
        }

        return new Blob(byteArrays as BlobPart[], { type: mimeType });
      };

      const baseUrl = apiClient.defaults.baseURL ?? 'http://localhost:3001';
      const url = new URL(`${baseUrl}/api/tts/stream`);
      url.searchParams.set('text', text.trim());
      url.searchParams.set('lang', settings.languageCode);
      if (settings.speakingRate < 1) {
        url.searchParams.set('slow', 'true');
      }
      const token = getToken();
      if (token) {
        url.searchParams.set('token', token);
      }

      debugLog('Starting TTS stream', {
        textLength: text.length,
        languageCode: settings.languageCode,
        speakingRate: settings.speakingRate,
        url: url.toString(),
      });

      const maxRetries = 3;
      let retryCount = 0;
      let totalChunksReceived = 0;

      // Cleanup streaming resources
      const cleanupStreamingResources = () => {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        // Clear audio queue
        for (const item of audioQueueRef.current) {
          try {
            URL.revokeObjectURL(item.url);
          } catch {}
        }
        audioQueueRef.current = [];
        if (currentAudioRef.current) {
          try {
            currentAudioRef.current.element.pause();
            URL.revokeObjectURL(currentAudioRef.current.url);
          } catch {}
          // NOTE: Do NOT set currentAudioRef.current to null here.
          // This cleanup happens too early and causes race conditions with useTextSync.
          // The reference will be cleared in stopSpeaking() when appropriate.
        }
      };

      // Create a streaming connection
      const createStreamConnection = (): Promise<void> => {
        return new Promise((resolve, reject) => {
          const eventSource = new EventSource(url.toString());
          eventSourceRef.current = eventSource;
          streamEndedRef.current = false;

          // Abort handling
          const abortListener = () => {
            eventSource.close();
            cleanupStreamingResources();
            reject(new DOMException('Aborted', 'AbortError'));
          };
          if (signal) {
            signal.addEventListener('abort', abortListener, { once: true });
          }

          eventSource.onopen = () => {
            debugLog('EventSource connected');
            retryCount = 0; // reset retry count on successful connection
          };

          eventSource.addEventListener('audio', (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data) as TTSAudioMessageData;
              totalChunksReceived++;
              debugLog('Received audio chunk', {
                chunkIndex: totalChunksReceived,
                base64Length: data.audioBase64.length,
              });
              const audioBlob = base64ToBlob(data.audioBase64, 'audio/mpeg');
              const audioUrl = URL.createObjectURL(audioBlob);
              const audio = new Audio(audioUrl);
              // Track chunk metadata for karaoke sync (playback order)
              const chunkIndex = chunkMetaRef.current.length;
              chunkMetaRef.current.push({
                bytes: data.audioBase64.length,
                duration: null,
                text: data.text,
                sequence: data.sequence ?? chunkIndex,
              });
              audio.addEventListener('loadedmetadata', () => {
                const d = audio.duration;
                if (typeof d === 'number' && Number.isFinite(d) && d > 0) {
                  const meta = chunkMetaRef.current[chunkIndex];
                  if (meta) meta.duration = d;
                }
              });
              const queueItem = { element: audio, url: audioUrl, index: chunkIndex };

              audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                // If another chunk is queued, set it as current and play it
                if (audioQueueRef.current.length > 0) {
                  const next = audioQueueRef.current.shift()!;
                  currentAudioRef.current = next;
                  chunkIndexRef.current = next.index;
                  next.element.play().catch((e) => logger.error('Play error', e));
                } else if (streamEndedRef.current) {
                  // Final chunk finished - clear ref and resolve
                  currentAudioRef.current = null;
                  cleanupStreamingResources();
                  resolve();
                }
                // Otherwise: chunk ended but queue not empty yet (shouldn't happen normally)
                // Keep currentAudioRef pointing to this finished chunk until queue delivers next
              };

              audio.onerror = (e) => {
                URL.revokeObjectURL(audioUrl);
                logger.error('Chunk playback error', e);
                if (currentAudioRef.current && currentAudioRef.current.url === audioUrl) {
                  currentAudioRef.current = null;
                }
                if (audioQueueRef.current.length > 0) {
                  const next = audioQueueRef.current.shift()!;
                  currentAudioRef.current = next;
                  chunkIndexRef.current = next.index;
                  next.element.play().catch((e) => logger.error('Play error', e));
                } else if (streamEndedRef.current) {
                  cleanupStreamingResources();
                  resolve();
                }
              };

              if (!currentAudioRef.current) {
                currentAudioRef.current = queueItem;
                chunkIndexRef.current = queueItem.index;
                audio.play().catch((e) => logger.error('Failed to play chunk', e));
                notifyAudioReady();
              } else {
                audioQueueRef.current.push(queueItem);
              }
            } catch (err) {
              logger.error('Failed to process audio message', err);
            }
          });

          eventSource.addEventListener('end', (event: MessageEvent) => {
            try {
              JSON.parse(event.data); // validate
              streamEndedRef.current = true;
              eventSource.close();
              debugLog('Stream ended', {
                totalChunksReceived,
                queueRemaining: audioQueueRef.current.length,
              });
              // If no audio playing and queue empty, resolve
              if (!currentAudioRef.current && audioQueueRef.current.length === 0) {
                cleanupStreamingResources();
                resolve();
              }
              // else will resolve in onended handlers
            } catch (err) {
              logger.error('Failed to parse end message', err);
              eventSource.close();
              cleanupStreamingResources();
              reject(err);
            }
          });

          eventSource.addEventListener('error', (event: MessageEvent) => {
            // Ignore empty or non-JSON data events — these are usually connection closures, not application errors
            if (
              !event.data ||
              typeof event.data !== 'string' ||
              !event.data.trim().startsWith('{')
            ) {
              return;
            }
            try {
              const data = JSON.parse(event.data) as TTSErrorMessageData;
              logger.error('Stream error from server', data);
              debugLog('Stream error', {
                message: data.message,
                code: data.code,
                retryCount,
                textLength: text.length,
                totalChunksReceived,
              });
              streamEndedRef.current = true;
              eventSource.close();
              cleanupStreamingResources();
              reject(new Error(data.message || 'Stream error'));
            } catch (err) {
              logger.error('Error parsing SSE error', err);
              streamEndedRef.current = true;
              eventSource.close();
              cleanupStreamingResources();
              reject(new Error('Stream error'));
            }
          });

          eventSource.onerror = (err) => {
            if (!streamEndedRef.current) {
              logger.error('EventSource connection error', err);
              eventSource.close();
              cleanupStreamingResources();
              reject(new Error('Connection error'));
            }
          };
        });
      };

      // Retry loop
      while (retryCount < maxRetries) {
        try {
          await createStreamConnection();
          return true;
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            throw err; // propagate abort immediately
          }
          retryCount++;
          if (retryCount >= maxRetries) {
            throw err;
          }
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10000) + Math.random() * 500;
          debugLog(
            `Streaming connection failed, retrying in ${delay}ms (${retryCount}/${maxRetries})`,
          );
          // Abortable sleep: stopSpeaking()/unmount must not wait out the
          // backoff, and no EventSource/Audio may be recreated afterwards.
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              signal?.removeEventListener('abort', onAbort);
              resolve();
            }, delay);
            const onAbort = (): void => {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            };
            if (signal?.aborted) {
              clearTimeout(timer);
              reject(new DOMException('Aborted', 'AbortError'));
            } else {
              signal?.addEventListener('abort', onAbort, { once: true });
            }
          });
        }
      }
      throw new Error('Max retries exceeded');
    },
    [apiClient, getToken],
  );

  const speak = useCallback(
    async (text: string, voiceSettings?: VoiceSettings): Promise<boolean> => {
      // Cancel any ongoing speech first
      stopSpeaking();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsSpeaking(true);
      setError(null);

      try {
        // Try streaming first
        const success = await speakStream(text, voiceSettings, abortController.signal);
        return success;
      } catch (err: unknown) {
        // If aborted, just return false without fallback
        if (err instanceof Error && err.name === 'AbortError') {
          debugLog('Speech aborted by user');
          return false;
        }
        debugError('Streaming failed, falling back to HTTP TTS', err);
        // Cleanup streaming resources (in case any left)
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        // Fallback to HTTP TTS
        return await speakHTTP(text, voiceSettings);
      } finally {
        // Clear abort controller ref if it hasn't been cleared already.
        // Only the owning run may lower the flag or clear the ref: a newer
        // speak() replaces the ref first, so a stale finally must neither
        // mute fresh speech nor resurrect a dead controller. This also drops
        // isSpeaking back to false at natural stream end, so the next
        // utterance produces a fresh false→true transition for sync hooks.
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
          setIsSpeaking(false);
        }
      }
    },
    [stopSpeaking, speakStream, speakHTTP],
  );

  const startListening = useCallback(() => {
    if (!isRecognitionSupported) {
      setError('Navegador no compatible con reconocimiento de voz');
      return;
    }

    // Stop any current speech
    stopSpeaking();

    const SpeechRecognitionAPI =
      (window as SpeechRecognitionWindow).SpeechRecognition ??
      (window as SpeechRecognitionWindow).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setError('Navegador no compatible con reconocimiento de voz');
      return;
    }

    // Stop existing recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }
    }

    try {
      const recognition = new SpeechRecognitionAPI();

      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.maxAlternatives = 3;
      recognition.continuous = false;

      recognition.onstart = () => {
        debugLog('Recognition started');
        setIsListening(true);
        setError(null);
        setTranscript('');
        setConfidence(0);
      };

      recognition.onend = () => {
        debugLog('Recognition ended');
        setIsListening(false);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        debugError('Recognition error:', event.error);

        if (event.error === 'not-allowed') {
          setError('Permiso de micrófono denegado');
        } else if (event.error === 'no-speech') {
          // Normal - no speech detected
          setError(null);
        } else if (event.error === 'network') {
          // Browser speech recognition requires internet (Google servers)
          setError('Se requiere internet para reconocimiento de voz');
        } else if (event.error !== 'aborted') {
          setError(`Error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const results = Array.from(event.results) as SpeechRecognitionResult[];
        const lastResult = results[results.length - 1];

        if (lastResult.isFinal) {
          const alternative = lastResult[0];
          setTranscript(alternative.transcript);
          setConfidence(alternative.confidence);
          debugLog('Final transcript:', alternative.transcript);
        } else {
          setTranscript(lastResult[0].transcript);
          debugLog(' Interim transcript:', lastResult[0].transcript);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      debugLog('Recognition started');
    } catch (err) {
      debugError('Failed to start recognition:', err);
      setError('Error al iniciar reconocimiento');
    }
  }, [isRecognitionSupported, stopSpeaking]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }
    setIsListening(false);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setConfidence(0);
  }, []);

  const getCurrentAudioElement = useCallback((): HTMLAudioElement | null => {
    const element = currentAudioRef.current?.element || httpAudioRef.current || null;
    return element;
  }, []);

  // Chunk-aware snapshot for karaoke sync hooks. Returns null when not
  // playing streamed chunks (HTTP/browser TTS use the legacy single-element path).
  const getAudioSyncInfo = useCallback((): AudioSyncInfo | null => {
    const current = currentAudioRef.current;
    if (!current || chunkMetaRef.current.length === 0) return null;
    const chunks = chunkMetaRef.current.map((c) => ({ ...c }));
    return {
      element: current.element,
      chunkIndex: chunkIndexRef.current,
      isLastChunk: streamEndedRef.current && chunkIndexRef.current >= chunks.length - 1,
      chunks,
    };
  }, []);

  // Which TTS engine is sounding (null when silent/stopped).
  const getActiveEngine = useCallback((): ActiveTTSEngine | null => {
    return activeEngineRef.current;
  }, []);

  // Notify consumers when the audio element becomes available
  const notifyAudioReady = useCallback(() => {
    if (!audioReadyFiredRef.current) {
      audioReadyFiredRef.current = true;
      setAudioElementReady(true);
    }
  }, []);

  return {
    isSpeaking,
    speak,
    stopSpeaking,
    isListening,
    transcript,
    confidence,
    startListening,
    stopListening,
    clearTranscript,
    error,
    availableVoices,
    isSupported,
    isSpeechSupported,
    isRecognitionSupported,
    getCurrentAudioElement,
    getAudioSyncInfo,
    getActiveEngine,
    audioElementReady,
  };
}

// Helper
export function getRandomConfirmationPhrase(understoodText: string): string {
  if (!understoodText?.trim()) {
    return '¿Puedes repetirlo?';
  }
  const phrase = CONFIRMATION_PHRASES[Math.floor(Math.random() * CONFIRMATION_PHRASES.length)];
  return phrase.replace('{text}', understoodText);
}

export const VOICE_OPTIONS = [
  { id: 'default', name: 'Voz predeterminada', description: 'Voz del navegador' },
] as const;

export type VoicePresetId = (typeof VOICE_OPTIONS)[number]['id'];

export const useVoiceRecording = useVoice;
export const useVoicePlayback = useVoice;

import { useState, useCallback, useRef, useEffect } from 'react';

import { streamInteractWithRecipe } from '@/services/api';

export interface UseChatStreamReturn {
  chunks: string[];
  fullText: string;
  isStreaming: boolean;
  error: string | null;
  startStream: (sessionId: string, studentInput: string) => void;
  stopStream: () => void;
}

// Debug logging
const debugLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    console.log('[useChatStream]', ...args);
  }
};

const debugError = (...args: unknown[]) => {
  console.error('[useChatStream ERROR]', ...args);
};

export function useChatStream(): UseChatStreamReturn {
  const [chunks, setChunks] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback((sessionId: string, studentInput: string): void => {
    try {
      const controller = streamInteractWithRecipe(sessionId, studentInput, {
        onMessage: (event) => {
          try {
            const { text } = JSON.parse(event.data) as { text: string };
            debugLog('Received chunk:', text);
            setChunks((prev) => [...prev, text]);
          } catch (err) {
            debugError('Failed to parse chunk data:', err);
          }
        },
        onError: (err) => {
          debugError('Stream error:', err);
          setError(err.message || 'Stream error');
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
        onClose: () => {
          debugLog('Stream closed');
          setIsStreaming(false);
          abortControllerRef.current = null;
        },
      });

      abortControllerRef.current = controller;
      setIsStreaming(true);
      setError(null);
      setChunks([]);
    } catch (err) {
      // Feature flag threw — streaming disabled
      const message = err instanceof Error ? err.message : 'Streaming unavailable';
      debugError('Feature flag check failed:', message);
      setError(message);
      setIsStreaming(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  // Compute full text from chunks
  const fullText = chunks.join('');

  return {
    chunks,
    fullText,
    isStreaming,
    error,
    startStream,
    stopStream,
  };
}

import { useState, useCallback, useRef, useEffect } from 'react';
import { streamInteractWithRecipe } from '@/services/api';
import { logger } from '@/utils/logger';

export interface UseChatStreamReturn {
  chunks: string[];
  fullText: string;
  isStreaming: boolean;
  error: string | null;
  startStream: (sessionId: string, studentInput: string) => void;
  stopStream: () => void;
}

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

  const startStream = useCallback(
    (sessionId: string, studentInput: string): void => {
      stopStream();

      try {
        setError(null);
        setChunks([]);
        setIsStreaming(true);

        const controller = streamInteractWithRecipe(sessionId, studentInput, {
          onMessage: (event) => {
            try {
              const { text } = JSON.parse(event.data) as { text: string };
              setChunks((prev) => [...prev, text]);
            } catch (err) {
              logger.error('[useChatStream] Chunk parse error:', err);
            }
          },
          onError: (err) => {
            setError(err.message || 'Stream error');
            setIsStreaming(false);
            abortControllerRef.current = null;
          },
          onClose: () => {
            setIsStreaming(false);
            abortControllerRef.current = null;
          },
        });

        abortControllerRef.current = controller;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Streaming unavailable';
        setError(message);
        setIsStreaming(false);
      }
    },
    [stopStream],
  );

  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  const fullText = chunks.join('');

  return { chunks, fullText, isStreaming, error, startStream, stopStream };
}

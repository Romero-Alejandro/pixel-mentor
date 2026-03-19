import { useState, useCallback, useRef, useEffect } from 'react';

import { streamInteractWithRecipe } from '@/services/api';

export interface UseChatStreamReturn {
  chunks: string[];
  fullText: string;
  isStreaming: boolean;
  error: string | null;
  startStream: (sessionId: string, studentInput: string) => EventSource | null;
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

  const eventSourceRef = useRef<EventSource | null>(null);

  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback((sessionId: string, studentInput: string): EventSource | null => {
    // Check feature flag first
    try {
      const source = streamInteractWithRecipe(sessionId, studentInput);
      eventSourceRef.current = source;
      setIsStreaming(true);
      setError(null);
      setChunks([]);

      // Handle chunk events: parse JSON.data and append text to chunks
      source.addEventListener('chunk', (event: MessageEvent) => {
        try {
          const { text } = JSON.parse(event.data) as { text: string };
          debugLog('Received chunk:', text);
          setChunks((prev) => [...prev, text]);
        } catch (err) {
          debugError('Failed to parse chunk data:', err);
        }
      });

      // Handle end event: stream completed successfully
      source.addEventListener('end', () => {
        debugLog('Stream ended');
        setIsStreaming(false);
        source.close();
      });

      // Handle error event: stream error from server
      source.addEventListener('error', (event: MessageEvent) => {
        try {
          const { message } = JSON.parse(event.data) as { message: string };
          debugError('Stream error from server:', message);
          setError(message);
          setIsStreaming(false);
          source.close();
        } catch (err) {
          debugError('Failed to parse error data:', err);
          setError('Stream error');
          setIsStreaming(false);
          source.close();
        }
      });

      // Also handle EventSource connection errors (network-level)
      source.onerror = () => {
        if (eventSourceRef.current) {
          debugError('EventSource connection error');
          setError('Connection error');
          setIsStreaming(false);
          source.close();
        }
      };

      return source;
    } catch (err) {
      // Feature flag threw — streaming disabled
      const message = err instanceof Error ? err.message : 'Streaming unavailable';
      debugError('Feature flag check failed:', message);
      setError(message);
      setIsStreaming(false);
      return null;
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

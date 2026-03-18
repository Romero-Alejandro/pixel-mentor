import { useState, useEffect, useCallback, useRef } from 'react';

import { api, type Session, type PedagogicalState } from '../services/api';

import { useVoice, type VoiceSettings } from '@/hooks/useVoice';

export interface Message {
  role: 'tutor' | 'student';
  text: string;
}

export function useSessionLogic(sessionId: string | undefined, voiceSettings: VoiceSettings) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  const { isSpeaking, speak, stopSpeaking } = useVoice();
  const isMounted = useRef(true);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      setIsLoading(true);
      const data = await api.getSession(sessionId);
      if (isMounted.current) {
        setSession(data);
        setSessionCompleted(data.status === 'COMPLETED' || data.status === 'ESCALATED');
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Error al cargar la sesión.');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [sessionId]);

  useEffect(() => {
    isMounted.current = true;
    fetchSession();
    return () => {
      isMounted.current = false;
      stopSpeaking();
    };
  }, [fetchSession, stopSpeaking]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !sessionId || isProcessing) return;

    const userText = inputText.trim();
    setInputText('');
    setConversation((prev) => [...prev, { role: 'student', text: userText }]);
    stopSpeaking();
    setIsProcessing(true);
    setError(null);

    try {
      const response = await api.interactWithRecipe(sessionId, userText);
      if (!isMounted.current) return;

      setConversation((prev) => [...prev, { role: 'tutor', text: response.voiceText }]);

      if (response.sessionCompleted) {
        setSessionCompleted(true);
        const updated = await api.getSession(sessionId);
        if (isMounted.current) setSession(updated);
      }

      speak(response.voiceText, {
        character: voiceSettings.character,
        speakingRate: voiceSettings.speakingRate,
        pitch: voiceSettings.pitch,
        languageCode: voiceSettings.languageCode,
      }).catch(() => {});
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Error en la transmisión.');
      }
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  }, [inputText, sessionId, isProcessing, stopSpeaking, speak, voiceSettings]);

  const handleReset = useCallback(async () => {
    if (!sessionId || isProcessing) return;

    if (!window.confirm('¿Confirmar reinicio de sesión? Los datos se perderán.')) return;

    setIsProcessing(true);
    stopSpeaking();

    try {
      const data = await api.resetSession(sessionId);
      if (!isMounted.current) return;

      setSession(data);
      setConversation([]);
      setSessionCompleted(data.status === 'COMPLETED');
      setError(null);
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : 'Error al reiniciar.');
      }
    } finally {
      if (isMounted.current) setIsProcessing(false);
    }
  }, [sessionId, isProcessing, stopSpeaking]);

  const handlePreviewVoice = useCallback(
    async (settings: VoiceSettings) => {
      stopSpeaking();
      await speak('Hola, soy tu tutor. Vamos a aprender juntos.', settings);
    },
    [speak, stopSpeaking],
  );

  return {
    session,
    isLoading,
    error,
    inputText,
    setInputText,
    conversation,
    isProcessing,
    sessionCompleted,
    isSpeaking,
    stopSpeaking,
    handleSend,
    handleReset,
    handlePreviewVoice,
    currentState: (session?.stateCheckpoint?.currentState as PedagogicalState) || 'ACTIVE_CLASS',
  };
}

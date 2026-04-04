import { useState, useEffect, useRef } from 'react';

import { api, type Session, type PedagogicalState } from '@/services/api';
import { useVoice, type VoiceSettings } from '@/features/voice/hooks/useVoice';
import { useConfirm } from '@/hooks/useConfirmationDialogs';
import { logger } from '@/utils/logger';

export interface Message {
  id: string;
  role: 'tutor' | 'student';
  text: string;
}

export interface MissionReport {
  xpEarned: number;
  accuracy: number;
  conceptsMastered: string[];
  currentLevel: number;
  levelTitle: string;
  newBadges: Array<{ code: string; name: string; icon: string }>;
  totalXP: number;
  currentStreak: number;
}

export function useSessionLogic(sessionId: string | undefined, voiceSettings: VoiceSettings) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [missionReport, setMissionReport] = useState<MissionReport | null>(null);

  const { isSpeaking, speak, stopSpeaking } = useVoice();
  const confirm = useConfirm();
  const isMounted = useRef(true);

  async function fetchSession() {
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
      if (isMounted.current) setIsLoading(false);
    }
  }

  useEffect(() => {
    isMounted.current = true;
    fetchSession();
    return () => {
      isMounted.current = false;
      stopSpeaking();
    };
  }, [sessionId]);

  async function handleSend() {
    if (!inputText.trim() || !sessionId || isProcessing) return;

    const userText = inputText.trim();
    setInputText('');
    setConversation((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'student', text: userText },
    ]);
    stopSpeaking();
    setIsProcessing(true);
    setError(null);

    try {
      const response = await api.interactWithRecipe(sessionId, userText);
      if (!isMounted.current) return;

      setConversation((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'tutor', text: response.voiceText },
      ]);

      if (response.sessionCompleted) {
        setSessionCompleted(true);
        const updated = await api.getSession(sessionId);
        if (isMounted.current) setSession(updated);

        try {
          const report = await api.getMissionReport(sessionId);
          if (isMounted.current) setMissionReport(report);
        } catch (e) {
          logger.warn('Could not fetch mission report:', e);
        }
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
  }

  async function handleReset() {
    if (!sessionId || isProcessing) return;
    if (
      !(await confirm({
        title: 'Confirmar reinicio',
        message: '¿Confirmar reinicio de sesión? Los datos se perderán.',
        variant: 'danger',
      }))
    )
      return;

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
  }

  async function handlePreviewVoice(settings: VoiceSettings) {
    stopSpeaking();
    await speak('Hola, soy tu tutor. Vamos a aprender juntos.', settings);
  }

  return {
    session,
    isLoading,
    error,
    inputText,
    setInputText,
    conversation,
    isProcessing,
    sessionCompleted,
    missionReport,
    isSpeaking,
    stopSpeaking,
    handleSend,
    handleReset,
    handlePreviewVoice,
    currentState: (session?.stateCheckpoint?.currentState as PedagogicalState) || 'ACTIVE_CLASS',
  };
}

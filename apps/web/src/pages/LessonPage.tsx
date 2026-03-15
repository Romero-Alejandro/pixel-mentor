import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { PedagogicalState } from '@pixel-mentor/shared';
import { IconArrowLeft, IconMicrophone, IconPlayerStop, IconSend } from '@tabler/icons-react';

import { useAuthStore } from '../stores/authStore';
import { useLessonStore } from '../stores/lessonStore';

import { useVoice, type VoiceSettings } from '@/hooks/useVoice';
import {
  VoiceSettingsPanel,
  useVoiceSettings,
} from '@/components/voice-settings/VoiceSettingsPanel';
import { useStartRecipe, useRecipeInteraction } from '@/hooks/useLessonQueries';
import { useLessonTimers } from '@/hooks/useLessonTimers';
import { ActivitySkipOffer } from '@/components/lesson/ActivitySkipOffer';
import { Mascot } from '@/components/mascot/Mascot';
import { ContentPanel, type ContentType } from '@/components/content-panel/ContentPanel';
import { QuestionHandButton, type HandState } from '@/components/question-hand/QuestionHandButton';
import { VoiceInputWithConfirmation } from '@/components/voice-input/VoiceInputWithConfirmation';
import { ResumeToast } from '@/components/lesson/ResumeToast';
import { Button, Spinner } from '@/components/ui';

const STATE_LABELS: Record<PedagogicalState, string> = {
  AWAITING_START: 'Esperando inicio',
  ACTIVE_CLASS: 'Aprendiendo',
  RESOLVING_DOUBT: 'Pensando',
  CLARIFYING: 'Aclarando',
  EXPLANATION: 'Explicando',
  QUESTION: 'Preguntando',
  EVALUATION: 'Revisando',
  COMPLETED: 'Completado',
  ACTIVITY_WAIT: 'Actividad en espera',
  ACTIVITY_INACTIVITY_WARNING: '¿Necesitas ayuda?',
  ACTIVITY_SKIP_OFFER: '¿Qué prefieres?',
  ACTIVITY_REPEAT: 'Repitiendo concepto',
};

const getContentType = (state?: PedagogicalState): ContentType => {
  const mapping: Record<string, ContentType> = {
    ACTIVE_CLASS: 'explanation',
    EXPLANATION: 'explanation',
    RESOLVING_DOUBT: 'listening',
    CLARIFYING: 'listening',
    QUESTION: 'activity',
    EVALUATION: 'activity',
    COMPLETED: 'completed',
  };
  return mapping[state || ''] || 'explanation';
};

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user } = useAuthStore();
  const {
    currentState,
    setCurrentState,
    setSessionId,
    sessionId,
    setConfig,
    setStudentName,
    setWasResumed,
    wasResumed,
    config,
    studentName,
    reset: resetLessonStore,
  } = useLessonStore();

  // Voice hook
  const {
    speak,
    stopSpeaking,
    isListening,
    startListening,
    stopListening,
    transcript,
    isSpeechSupported,
    isRecognitionSupported,
  } = useVoice();

  const { settings: voiceSettings, updateSettings } = useVoiceSettings();

  // Connect useVoice to lesson store
  const [tutorIsSpeaking, setTutorIsSpeaking] = useState(false);
  const { setIsSpeaking: setStoreIsSpeaking } = useLessonStore();

  // Update store when tutor speaks
  useEffect(() => {
    setStoreIsSpeaking(tutorIsSpeaking);
  }, [tutorIsSpeaking, setStoreIsSpeaking]);

  // Preview voice with current settings
  const handlePreviewVoice = async (settings: VoiceSettings) => {
    setTutorIsSpeaking(true);
    await speak('Hola, soy tu tutor. Vamos a aprender juntos.', settings);
    setTutorIsSpeaking(false);
  };

  const { mutateAsync: startRecipe, isPending: isStarting } = useStartRecipe();
  const { mutateAsync: interactWithRecipe, isPending: isProcessing } = useRecipeInteraction();

  const [handState, setHandState] = useState<HandState>('idle');
  const [contentText, setContentText] = useState('');
  const [inputText, setInputText] = useState('');
  const [inputMode, setInputMode] = useState<'voice' | 'type'>('voice');
  const [activityOptions, setActivityOptions] = useState<any[]>([]);
  const [activityQuestion, setActivityQuestion] = useState('');
  const [activityCorrect, setActivityCorrect] = useState<boolean | null>(null);
  const [activityFeedback, setActivityFeedback] = useState('');
  const [needsStart, setNeedsStart] = useState(false);

  const conversationEndRef = useRef<HTMLDivElement>(null);
  const contentType = useMemo(() => getContentType(currentState), [currentState]);

  // Process response from API
  const processResponseWithAutoAdvance = useCallback(
    async (response: any) => {
      if (!response) return;

      if (response.sessionId) setSessionId(response.sessionId);
      if (response.pedagogicalState) setCurrentState(response.pedagogicalState);

      if (response.resumed !== undefined) {
        setWasResumed(response.resumed);
      }

      if (response.needsStart !== undefined) {
        setNeedsStart(response.needsStart);
      }

      const nextVoiceText = response.voiceText || response.extraExplanation || '';
      setContentText(nextVoiceText);

      if (response.meta) {
        setConfig(response.meta.config ?? null);
        setStudentName(response.meta.studentName ?? user?.name ?? 'Estudiante');
      }

      if (response.staticContent?.activity) {
        const { instruction, options } = response.staticContent.activity;
        setActivityQuestion(instruction);
        setActivityOptions(
          options?.map((opt: any, idx: number) => ({
            id: opt.id || `option-${idx}`,
            text: opt.text,
            isCorrect: opt.isCorrect,
          })) ?? [],
        );
      } else if (response.pedagogicalState !== 'ACTIVITY_REPEAT') {
        setActivityQuestion('');
        setActivityOptions([]);
      }

      if (response.isCorrect !== undefined) {
        setActivityCorrect(response.isCorrect);
        if (response.feedback) setActivityFeedback(response.feedback);
      } else {
        setActivityCorrect(null);
        setActivityFeedback('');
      }

      // Speak the response if there's text
      if (nextVoiceText && isSpeechSupported) {
        setTutorIsSpeaking(true);
        try {
          await speak(nextVoiceText, {
            character: voiceSettings.character,
            speakingRate: voiceSettings.speakingRate,
            pitch: voiceSettings.pitch,
            languageCode: voiceSettings.languageCode,
          });
        } catch (e) {
          console.error('Error speaking:', e);
        } finally {
          setTutorIsSpeaking(false);
        }
      }
    },
    [
      setCurrentState,
      setSessionId,
      setConfig,
      setStudentName,
      user?.name,
      speak,
      isSpeechSupported,
      voiceSettings,
      setTutorIsSpeaking,
    ],
  );

  // Handle interaction with API
  const handleInteraction = useCallback(
    async (input: string) => {
      if (!sessionId || !input.trim()) return;

      // Stop any current voice
      stopSpeaking();
      stopListening();

      try {
        const res = await interactWithRecipe({ sessionId, input: input.trim() });
        await processResponseWithAutoAdvance(res);
      } catch (err) {
        console.error('Error en la interacción:', err);
      }
    },
    [sessionId, interactWithRecipe, processResponseWithAutoAdvance, stopSpeaking, stopListening],
  );

  const { timeRemaining, startTimer, resetTimer, hasWarned } = useLessonTimers({
    onWarning: () => setCurrentState('ACTIVITY_INACTIVITY_WARNING'),
    onSkipOffer: () => setCurrentState('ACTIVITY_SKIP_OFFER'),
    onTimeout: () => handleInteraction('timeout'),
    activityDurationSeconds: 30,
  });

  // Initialize lesson
  useEffect(() => {
    if (!lessonId || !user) return;

    const init = async () => {
      try {
        const res = await startRecipe(lessonId);
        await processResponseWithAutoAdvance(res);
      } catch (err) {
        console.error('Error al iniciar lección:', err);
      }
    };
    init();

    return () => {
      stopSpeaking();
      stopListening();
      resetLessonStore();
    };
  }, [
    lessonId,
    user,
    startRecipe,
    processResponseWithAutoAdvance,
    stopSpeaking,
    stopListening,
    resetLessonStore,
  ]);

  // Handle timers
  useEffect(() => {
    if (currentState === 'QUESTION' || currentState === 'EVALUATION') {
      startTimer();
    } else {
      resetTimer();
    }
  }, [currentState, startTimer, resetTimer]);

  // Scroll to bottom on content change
  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [contentText]);

  const handleRaiseHand = useCallback(() => {
    if (handState !== 'idle') return;
    stopSpeaking();
    setHandState('raised');
    setTimeout(() => setHandState('listening'), 500);
  }, [handState, stopSpeaking]);

  const handleDoubtConfirm = useCallback(
    (text: string) => {
      setHandState('idle');
      handleInteraction(text);
    },
    [handleInteraction],
  );

  // Voice button handler
  const handleVoiceButtonClick = useCallback(() => {
    if (isListening) {
      stopListening();
      if (transcript.trim()) {
        handleInteraction(transcript.trim());
      }
    } else {
      startListening();
    }
  }, [isListening, transcript, startListening, stopListening, handleInteraction]);

  // Show "Comenzar" button when needsStart is true
  if (currentState === 'AWAITING_START' || needsStart) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-50 to-white flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-lg">
          <div className="text-6xl mb-6">🎓</div>
          <h1 className="text-3xl font-bold text-slate-800 mb-4">
            ¡Hola, {studentName || user?.name || 'Estudiante'}!
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            {contentText || 'Vamos a comenzar tu clase de matemáticas.'}
          </p>
          <Button
            onClick={() => handleInteraction('sí')}
            disabled={isProcessing}
            size="lg"
            className="text-lg px-8 py-4"
          >
            {isProcessing ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Comenzando...
              </>
            ) : (
              '🚀 ¡Comenzar Clase!'
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (isStarting && !sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 relative">
            <div className="absolute inset-0 bg-sky-400 rounded-full animate-ping opacity-30" />
            <div className="absolute inset-0 bg-sky-500 rounded-full animate-pulse flex items-center justify-center">
              <span className="text-4xl">🚀</span>
            </div>
          </div>
          <p className="text-xl font-bold text-sky-600">Preparando la clase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-slate-100 font-sans text-slate-800 flex flex-col">
      <ResumeToast isVisible={wasResumed} onDismiss={() => setWasResumed(false)} />

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-sky-100 h-16 flex items-center px-4 sm:px-6 shrink-0 relative z-10">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
          >
            <IconArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">Volver</span>
          </Link>

          <div className="flex items-center gap-3 bg-white border-2 border-sky-100 px-4 py-2 rounded-full shadow-sm">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                currentState === 'ACTIVE_CLASS' ? 'bg-emerald-400' : 'bg-amber-400'
              } animate-pulse`}
            />
            <span className="text-sm font-semibold text-slate-700">
              {STATE_LABELS[currentState] || 'Listo'}
            </span>
          </div>

          <VoiceSettingsPanel
            settings={voiceSettings}
            onSettingsChange={updateSettings}
            onPreview={handlePreviewVoice}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Left Panel - Mascot & Hand */}
        <section className="w-full lg:w-5/12 flex flex-col items-center justify-center">
          <Mascot />
          <div className="mt-6">
            <QuestionHandButton
              handState={handState}
              onRaiseHand={handleRaiseHand}
              isDisabled={isProcessing || handState !== 'idle'}
            />
          </div>

          {handState !== 'idle' ? (
            <div className="mt-4 w-full max-w-md">
              <VoiceInputWithConfirmation onConfirm={handleDoubtConfirm} />
              <button
                onClick={() => setHandState('idle')}
                className="mt-3 w-full text-sm text-slate-500 hover:text-slate-700 transition-colors text-center"
              >
                Cancelar
              </button>
            </div>
          ) : null}
        </section>

        {/* Right Panel - Content */}
        <section className="w-full lg:w-7/12 flex flex-col bg-white rounded-3xl border-2 border-sky-100 shadow-sm min-h-[500px] overflow-hidden">
          {currentState === 'ACTIVITY_SKIP_OFFER' ? (
            <ActivitySkipOffer
              onRepeat={() => {
                resetTimer();
                setCurrentState('QUESTION');
              }}
              onContinue={() => handleInteraction('continue')}
              studentName={studentName || user?.name || ''}
            />
          ) : (
            <ContentPanel
              contentType={contentType}
              explanationText={contentText}
              activityQuestion={activityQuestion}
              activityOptions={activityOptions}
              onActivitySelect={handleInteraction}
              activityCorrect={activityCorrect}
              activityFeedback={activityFeedback}
              timeRemaining={timeRemaining}
              hasWarned={hasWarned}
              studentName={studentName}
              config={config}
              pedagogicalState={currentState}
            />
          )}

          {/* Input Area */}
          {handState === 'idle' && contentType !== 'completed' && contentType !== 'activity' ? (
            <div className="p-4 sm:p-6 bg-white border-t-2 border-sky-50 rounded-b-3xl">
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-4">
                {(['voice', 'type'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setInputMode(mode)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-all ${
                      inputMode === mode
                        ? 'bg-sky-500 text-white shadow-md'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {mode === 'voice' ? (
                      <>
                        <IconMicrophone className="w-4 h-4" />
                        Voz
                      </>
                    ) : (
                      '✏️ Escribir'
                    )}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="flex gap-3">
                {inputMode === 'voice' ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <button
                      onClick={handleVoiceButtonClick}
                      disabled={isProcessing || !isRecognitionSupported}
                      className={`w-full h-16 flex items-center justify-center gap-3 rounded-2xl transition-all font-medium ${
                        isListening
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-600'
                      } disabled:opacity-50`}
                    >
                      {isListening ? (
                        <>
                          <IconPlayerStop className="w-6 h-6" />
                          <span>Escuchando...</span>
                        </>
                      ) : (
                        <>
                          <IconMicrophone className="w-6 h-6" />
                          <span>Habla ahora</span>
                        </>
                      )}
                    </button>

                    {/* Status messages */}
                    {isListening || transcript ? (
                      <p className="text-center text-sm text-sky-600 animate-pulse">
                        {isListening ? `🎤 ${transcript || 'Escuchando...'}` : ''}
                      </p>
                    ) : null}

                    {!isRecognitionSupported ? (
                      <p className="text-center text-sm text-amber-600">
                        ⚠️ Voz no disponible en este navegador
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleInteraction(inputText)}
                      className="w-full h-16 pl-5 pr-16 bg-slate-50 border-2 border-slate-200 rounded-2xl text-base focus:border-sky-400 focus:bg-white focus:outline-none transition-all"
                      placeholder="Escribe aquí tu respuesta..."
                      disabled={isProcessing}
                    />
                    <button
                      onClick={() => {
                        handleInteraction(inputText);
                        setInputText('');
                      }}
                      disabled={!inputText.trim() || isProcessing}
                      className="absolute right-2 top-2 bottom-2 aspect-square bg-sky-500 text-white rounded-xl flex items-center justify-center hover:bg-sky-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <IconSend className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </main>
      <div ref={conversationEndRef} />
    </div>
  );
}

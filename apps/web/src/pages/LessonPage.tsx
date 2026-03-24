import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { IconArrowLeft, IconAlertOctagon } from '@tabler/icons-react';

import { useGamificationStore } from '@/stores/gamification.store';
import { useAudio } from '@/contexts/AudioContext';
import { SpriteAudioEvent } from '@/audio/types/audio-events';
import { Mascot } from '@/components/mascot/Mascot';
import { Spinner, Button } from '@/components/ui';
import { LessonHeader } from '@/features/lesson/components/LessonHeader';
import {
  useClassOrchestrator,
  useVoiceSettingsSync,
} from '@/features/lesson/hooks/useClassOrchestrator';
import { useAutoStart } from '@/features/lesson/hooks/useAutoStart';
import { useTextSync } from '@/features/lesson/hooks/useTextSync';
import { useVoiceSettings } from '@/components/voice-settings/useVoiceSettings';
import { ConcentrationPanel } from '@/features/lesson/components/ConcentrationPanel';
import { QuestionPanel } from '@/features/lesson/components/QuestionPanel';
import { ActivityPanel } from '@/features/lesson/components/ActivityPanel';
import { FeedbackPanel } from '@/features/lesson/components/FeedbackPanel';
import { CompletedPanel } from '@/features/lesson/components/CompletedPanel';
import { useLessonStore } from '@/stores/lessonStore';

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { settings: voiceSettings, updateSettings } = useVoiceSettings();
  const { particleTrigger } = useGamificationStore();
  const { playSprite } = useAudio();
  const isRepeat = useLessonStore((state) => state.isRepeat);
  const xpEarned = useLessonStore((state) => state.xpEarned);
  const accuracy = useLessonStore((state) => state.accuracy);

  const prevParticleTrigger = useRef(particleTrigger);

  useEffect(() => {
    if (particleTrigger > prevParticleTrigger.current) {
      playSprite(SpriteAudioEvent.XPGain);
      prevParticleTrigger.current = particleTrigger;
    }
  }, [particleTrigger, playSprite]);

  useVoiceSettingsSync(voiceSettings);

  const {
    uiState,
    currentStep,
    totalSteps,
    contentText,
    transitionText,
    closureText,
    fullVoiceText,
    questionText,
    options,
    feedback,
    isProcessing,
    isSpeaking,
    questionResults,
    startClass,
    submitAnswer,
    speakContent,
    stopSpeaking,
    reset,
    getCurrentAudioElement,
  } = useClassOrchestrator();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityCorrect, setActivityCorrect] = useState<boolean | null>(null);

  const { isStarting, error, retryCount, retry } = useAutoStart(lessonId || null, startClass, {
    maxRetries: 3,
    autoStart: true,
  });

  const {
    isSynced,
    reset: resetTextSync,
    currentWordIndex,
  } = useTextSync({
    fullText: fullVoiceText,
    audioElementGetter: getCurrentAudioElement,
    playbackRate: voiceSettings.speakingRate,
  });

  const stopRef = useRef(stopSpeaking);
  const resetRef = useRef(reset);
  const prevQ = useRef<string>('');

  useEffect(() => {
    stopRef.current = stopSpeaking;
    resetRef.current = reset;
  }, [stopSpeaking, reset]);

  useEffect(() => {
    if (questionText !== prevQ.current) {
      prevQ.current = questionText;
      setSelectedId(null);
      setActivityCorrect(null);
    }
  }, [questionText]);

  useEffect(() => {
    if (feedback && uiState === 'feedback') {
      setActivityCorrect(feedback.isCorrect);
    }
  }, [feedback, uiState]);

  useEffect(() => {
    return () => {
      stopRef.current();
      resetRef.current();
    };
  }, []);

  const handleMCQ = (text: string, id: string) => {
    setSelectedId(id);
    submitAnswer(text);
  };

  const handleRestart = () => {
    reset();
    if (lessonId) startClass(lessonId);
  };

  const isStart = uiState === 'idle';
  const isLoading = isStarting && !contentText && !error;

  let currentPanel = null;
  switch (uiState) {
    case 'concentration':
      currentPanel = (
        <ConcentrationPanel
          fullVoiceText={fullVoiceText}
          transitionText={transitionText}
          contentText={contentText}
          closureText={closureText}
          currentWordIndex={currentWordIndex}
          isSynced={isSynced}
          isSpeaking={isSpeaking}
          onRepeat={() => {
            resetTextSync();
            speakContent();
          }}
        />
      );
      break;
    case 'question':
      currentPanel = (
        <QuestionPanel
          question={questionText}
          onAnswer={submitAnswer}
          isProcessing={isProcessing}
        />
      );
      break;
    case 'activity':
      currentPanel = (
        <ActivityPanel
          question={questionText}
          options={options}
          onAnswer={handleMCQ}
          isProcessing={isProcessing}
          selectedId={selectedId}
          isCorrect={activityCorrect}
        />
      );
      break;
    case 'feedback':
      currentPanel = feedback ? <FeedbackPanel fb={feedback} /> : null;
      break;
    case 'completed':
      currentPanel = (
        <CompletedPanel
          onRestart={handleRestart}
          isRepeat={isRepeat}
          xpEarned={xpEarned ?? undefined}
          accuracy={accuracy ?? undefined}
          questionResults={questionResults}
        />
      );
      break;
  }

  if (error && isStart) {
    return (
      <div className="min-h-screen bg-[#f0f9ff] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="w-full max-w-md animate-bounce-in bg-white border-4 border-rose-300 shadow-[0_8px_0_0_#fda4af] rounded-[2rem] p-8 text-center relative z-10">
          <div className="w-20 h-20 bg-rose-100 border-4 border-rose-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <IconAlertOctagon className="w-10 h-10 text-rose-500" stroke={2.5} />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">¡Oh no! Conexión perdida</h2>
          <p className="text-slate-600 font-medium mb-6">{error}</p>

          <Button onClick={retry} variant="primary" className="w-full mb-4">
            Reintentar conexión ({retryCount}/3)
          </Button>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-sky-600 transition-colors outline-none"
          >
            <IconArrowLeft className="w-4 h-4" /> Volver al mapa
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f0f9ff] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-sky-200 rounded-full blur-3xl opacity-50 animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-200 rounded-full blur-3xl opacity-50 animate-pulse"
          style={{ animationDelay: '1s' }}
        />

        <div className="relative z-10 flex flex-col items-center text-center">
          <Mascot className="w-56 h-56 animate-float mb-8" />
          <div className="bg-white/90 backdrop-blur-sm border-4 border-sky-200 shadow-[0_6px_0_0_#bae6fd] px-8 py-4 rounded-[2rem] flex items-center gap-4">
            <Spinner size="md" className="text-sky-500" />
            <span className="text-xl font-black text-sky-900 tracking-tight">
              Preparando la aventura...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f9ff] font-sans text-slate-800 flex flex-col overflow-x-hidden relative">
      <div className="fixed top-0 left-0 w-[40rem] h-[40rem] bg-sky-200 rounded-full blur-[100px] opacity-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[40rem] h-[40rem] bg-amber-200 rounded-full blur-[100px] opacity-20 translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <LessonHeader
        isStart={isStart}
        uiState={uiState}
        currentStep={currentStep}
        totalSteps={totalSteps}
        voiceSettings={voiceSettings}
        updateSettings={updateSettings}
        speakContent={speakContent}
      />

      <main
        className={`flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 flex transition-all duration-700 ease-in-out relative z-10 ${
          isStart
            ? 'flex-col items-center justify-center min-h-[calc(100vh-8rem)]'
            : 'flex-col lg:flex-row gap-8 lg:items-start'
        }`}
      >
        <section
          className={`flex flex-col items-center transition-all duration-1000 shrink-0 ${
            isStart
              ? 'w-full mb-8 justify-center'
              : 'w-full lg:w-5/12 lg:sticky lg:top-12 lg:justify-center'
          }`}
        >
          <div className="relative group">
            <div
              className={`absolute inset-0 bg-sky-400/20 blur-3xl rounded-full transition-opacity duration-700 ${
                isSpeaking ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <Mascot
              className={isStart ? 'w-72 h-72 sm:w-96 sm:h-96' : 'w-56 h-56 sm:w-72 sm:h-72'}
            />
          </div>
        </section>

        <section
          className={`flex flex-col transition-all duration-700 ease-out ${
            isStart
              ? 'w-full max-w-lg'
              : 'w-full lg:w-7/12 bg-white/95 backdrop-blur-md rounded-[3rem] border-4 border-white shadow-[0_8px_32px_rgba(56,189,248,0.15)] min-h-[550px] overflow-hidden relative'
          }`}
        >
          <div className="flex-1 flex flex-col w-full h-full animate-in fade-in slide-in-from-bottom-8 duration-500">
            {currentPanel}
          </div>
        </section>
      </main>
    </div>
  );
}

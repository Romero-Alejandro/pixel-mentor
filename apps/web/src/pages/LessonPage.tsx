import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { IconArrowLeft, IconAlertOctagon } from '@tabler/icons-react';

import { useGamificationStore } from '@/stores/gamification.store';
import { useAudio } from '@/contexts/AudioContext';
import { SpriteAudioEvent } from '@/audio/types/audio-events';
import { Mascot } from '@/components/mascot/Mascot';
import { Spinner, Button } from '@/components/ui';
import { UI_STATES } from '@/features/lesson/constants/lesson.constants';
import { LessonHeader } from '@/features/lesson/components/LessonHeader';
import { ConcentrationPanel } from '@/features/lesson/components/ConcentrationPanel';
import { QuestionPanel } from '@/features/lesson/components/QuestionPanel';
import { ActivityPanel } from '@/features/lesson/components/ActivityPanel';
import { FeedbackPanel } from '@/features/lesson/components/FeedbackPanel';
import { CompletedPanel } from '@/features/lesson/components/CompletedPanel';
import {
  useClassOrchestrator,
  useVoiceSettingsSync,
} from '@/features/lesson/hooks/useClassOrchestrator';
import { useAutoStart } from '@/features/lesson/hooks/useAutoStart';
import { useTextSync } from '@/features/lesson/hooks/useTextSync';
import { useVoiceSettings } from '@/components/voice-settings/useVoiceSettings';
import { useLessonStore } from '@/stores/lessonStore';

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { settings: voiceSettings, updateSettings } = useVoiceSettings();
  const { particleTrigger } = useGamificationStore();
  const { playSprite } = useAudio();

  // Zustand 5 Shallow selector is ideal here if we mapped it, but individual hooks are fine
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

  const orchestrator = useClassOrchestrator();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityCorrect, setActivityCorrect] = useState<boolean | null>(null);

  const { isStarting, error, retryCount, retry } = useAutoStart(
    lessonId || null,
    orchestrator.startClass,
  );

  const textSync = useTextSync({
    fullText: orchestrator.fullVoiceText,
    audioElementGetter: orchestrator.getCurrentAudioElement,
    playbackRate: voiceSettings.speakingRate,
  });

  // Limpiar selecciones previas al cambiar la pregunta
  const prevQ = useRef<string>('');
  useEffect(() => {
    if (orchestrator.questionText !== prevQ.current) {
      prevQ.current = orchestrator.questionText;
      setSelectedId(null);
      setActivityCorrect(null);
    }
  }, [orchestrator.questionText]);

  useEffect(() => {
    if (orchestrator.feedback && orchestrator.uiState === UI_STATES.FEEDBACK) {
      setActivityCorrect(orchestrator.feedback.isCorrect);
    }
  }, [orchestrator.feedback, orchestrator.uiState]);

  useEffect(() => {
    return () => {
      orchestrator.stopSpeaking();
      orchestrator.reset();
    };
  }, []);

  function handleMCQ(text: string, id: string) {
    setSelectedId(id);
    orchestrator.submitAnswer(text);
  }

  function handleRestart() {
    orchestrator.reset();
    if (lessonId) orchestrator.startClass(lessonId);
  }

  const isIdle = orchestrator.uiState === UI_STATES.IDLE;
  const isLoading = isStarting && !orchestrator.contentText && !error;

  function renderPanel() {
    switch (orchestrator.uiState) {
      case UI_STATES.CONCENTRATION:
        return (
          <ConcentrationPanel
            fullVoiceText={orchestrator.fullVoiceText}
            transitionText={orchestrator.transitionText}
            contentText={orchestrator.contentText}
            closureText={orchestrator.closureText}
            currentWordIndex={textSync.currentWordIndex}
            isSynced={textSync.isSynced}
            isSpeaking={orchestrator.isSpeaking}
            onRepeat={() => {
              textSync.reset();
              orchestrator.speakContent();
            }}
          />
        );
      case UI_STATES.QUESTION:
        return (
          <QuestionPanel
            question={orchestrator.questionText}
            onAnswer={orchestrator.submitAnswer}
            isProcessing={orchestrator.isProcessing}
          />
        );
      case UI_STATES.ACTIVITY:
        return (
          <ActivityPanel
            question={orchestrator.questionText}
            options={orchestrator.options}
            onAnswer={handleMCQ}
            isProcessing={orchestrator.isProcessing}
            selectedId={selectedId}
            isCorrect={activityCorrect}
          />
        );
      case UI_STATES.FEEDBACK:
        return orchestrator.feedback ? (
          <FeedbackPanel
            fb={orchestrator.feedback}
            nextLessonText={orchestrator.contentText}
            isStreaming={orchestrator.isStreaming}
          />
        ) : null;
      case UI_STATES.COMPLETED:
        return (
          <CompletedPanel
            onRestart={handleRestart}
            isRepeat={isRepeat}
            xpEarned={xpEarned ?? undefined}
            accuracy={accuracy ?? undefined}
            questionResults={orchestrator.questionResults}
          />
        );
      default:
        return null;
    }
  }

  if (error && isIdle) {
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
        isStart={isIdle}
        uiState={orchestrator.uiState}
        currentStep={orchestrator.currentStep}
        totalSteps={orchestrator.totalSteps}
        voiceSettings={voiceSettings}
        updateSettings={updateSettings}
        speakContent={orchestrator.speakContent}
        onReset={orchestrator.resetSession}
      />

      <main
        className={`flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 flex transition-all duration-700 ease-in-out relative z-10 ${isIdle ? 'flex-col items-center justify-center min-h-[calc(100vh-8rem)]' : 'flex-col lg:flex-row gap-8 lg:items-start'}`}
      >
        <section
          className={`flex flex-col items-center transition-all duration-1000 shrink-0 ${isIdle ? 'w-full mb-8 justify-center' : 'w-full lg:w-5/12 lg:sticky lg:top-12 lg:justify-center'}`}
        >
          <div className="relative group">
            <div
              className={`absolute inset-0 bg-sky-400/20 blur-3xl rounded-full transition-opacity duration-700 ${orchestrator.isSpeaking ? 'opacity-100' : 'opacity-0'}`}
            />
            <Mascot
              className={isIdle ? 'w-72 h-72 sm:w-96 sm:h-96' : 'w-56 h-56 sm:w-72 sm:h-72'}
            />
          </div>
        </section>

        <section
          className={`flex flex-col transition-all duration-700 ease-out ${isIdle ? 'w-full max-w-lg' : 'w-full lg:w-7/12 bg-white/95 backdrop-blur-md rounded-[3rem] border-4 border-white shadow-[0_8px_32px_rgba(56,189,248,0.15)] min-h-[550px] overflow-y-auto relative'}`}
        >
          <div className="flex-1 flex flex-col w-full h-full animate-in fade-in slide-in-from-bottom-8 duration-500">
            {renderPanel()}
          </div>
        </section>
      </main>
    </div>
  );
}

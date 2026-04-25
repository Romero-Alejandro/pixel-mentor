import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { IconArrowLeft, IconAlertOctagon, IconSparkles } from '@tabler/icons-react';
import { useShallow } from 'zustand/react/shallow';

import { useGamificationStore } from '@/features/gamification/stores/gamification.store';
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
import { useVoiceSettings } from '@/features/voice/hooks/useVoiceSettings';
import { useLessonStore } from '@/features/lesson/stores/lesson.store';
import { cn } from '@/utils/cn';

const PANEL_TRANSITIONS = {
  enter: 'animate-in fade-in slide-in-from-bottom-4 duration-500',
  exit: 'animate-out fade-out slide-out-to-top-2 duration-300',
} as const;

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();

  const { settings: voiceSettings, updateSettings } = useVoiceSettings();
  const { particleTrigger } = useGamificationStore();
  const { playSprite } = useAudio();

  const { isRepeat, xpEarned, accuracy, isSpeaking, isStreaming } = useLessonStore(
    useShallow((state) => ({
      isRepeat: state.isRepeat,
      xpEarned: state.xpEarned,
      accuracy: state.accuracy,
      isSpeaking: state.isSpeaking,
      isStreaming: state.isStreaming,
    })),
  );

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
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { isInitializing, error, retryCount, retry, resetStarted } = useAutoStart(
    lessonId || null,
    orchestrator.startClass,
  );

  const handleRestart = async () => {
    await orchestrator.reset();
    resetStarted();
  };

  const textSync = useTextSync({
    fullText: orchestrator.fullVoiceText,
    audioElementGetter: orchestrator.getCurrentAudioElement,
    playbackRate: voiceSettings.speakingRate,
  });

  const prevQ = useRef<string>('');

  useEffect(() => {
    if (orchestrator.questionText !== prevQ.current) {
      if (prevQ.current && orchestrator.questionText) {
        setIsTransitioning(true);
      }
      prevQ.current = orchestrator.questionText;
      setSelectedId(null);
      setActivityCorrect(null);
    }
  }, [orchestrator.questionText]);

  useEffect(() => {
    if (isTransitioning && orchestrator.contentText) {
      setIsTransitioning(false);
    }
  }, [isTransitioning, orchestrator.contentText]);

  useEffect(() => {
    if (orchestrator.feedbackData) {
      setActivityCorrect(orchestrator.feedbackData.isCorrect);
    }
  }, [orchestrator.feedbackData]);

  useEffect(() => {
    return () => {
      orchestrator.stopSpeaking();
      orchestrator.reset();
    };
  }, []);

  const handleMCQ = (text: string, id: string) => {
    setSelectedId(id);
    orchestrator.submitAnswer(text);
  };

  const handleRepeatContent = () => {
    textSync.reset();
    orchestrator.speakContent();
  };

  const isIdle = orchestrator.uiState === UI_STATES.IDLE;
  const isLoading = isInitializing && !orchestrator.contentText && !error;

  const panelKey = useMemo(
    () => `${orchestrator.uiState}-${orchestrator.currentStep}`,
    [orchestrator.uiState, orchestrator.currentStep],
  );

  const renderActivePanel = () => {
    switch (orchestrator.uiState) {
      case UI_STATES.IDLE:
        if (isLoading) return null;
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-sky-50 border-4 border-sky-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <IconSparkles className="w-12 h-12 text-sky-400 animate-pulse" stroke={2.5} />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-800 mb-4 tracking-tight">
              ¡Misión Lista!
            </h2>
            <p className="text-lg text-slate-500 font-bold mb-8 max-w-sm leading-relaxed">
              Tu aventura está a punto de comenzar. Ajusta el volumen y prepárate.
            </p>
            <div className="flex items-center gap-3 bg-sky-50 px-6 py-3 rounded-2xl border-2 border-sky-100">
              <Spinner size="sm" className="text-sky-500" />
              <span className="text-sm font-black text-sky-700 uppercase tracking-widest">
                Conectando
              </span>
            </div>
          </div>
        );

      case UI_STATES.CONCENTRATION:
        return (
          <ConcentrationPanel
            fullVoiceText={orchestrator.fullVoiceText}
            transitionText={orchestrator.transitionText}
            contentText={orchestrator.contentText}
            closureText={orchestrator.closureText}
            currentWordIndex={textSync.currentWordIndex}
            isSynced={textSync.isSynced}
            isSpeaking={isSpeaking}
            isAttemptingSync={textSync.isAttemptingSync}
            syncError={textSync.syncError}
            onRepeat={handleRepeatContent}
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
        return orchestrator.feedbackData ? (
          <FeedbackPanel
            fb={orchestrator.feedbackData}
            nextLessonText={orchestrator.contentText}
            isStreaming={isStreaming}
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
  };

  if (error && isIdle) {
    return (
      <div className="h-[100dvh] bg-sky-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-rose-200 rounded-full blur-3xl opacity-40 animate-pulse" />
        <div
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-amber-200 rounded-full blur-3xl opacity-40 animate-pulse"
          style={{ animationDelay: '1s' }}
        />

        <div className="w-full max-w-md bg-white border-4 border-rose-300 rounded-[2.5rem] p-8 text-center relative z-10 shadow-[0_12px_0_0_#fda4af]">
          <div className="w-24 h-24 bg-rose-100 border-4 border-rose-200 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <IconAlertOctagon className="w-12 h-12 text-rose-500" stroke={2.5} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 mb-3">¡Oh no!</h2>
          <p className="text-slate-600 font-medium mb-2">La conexión se perdió</p>
          <p className="text-slate-400 text-sm mb-6">{error}</p>

          <Button
            onClick={retry}
            variant="primary"
            className="w-full mb-4 py-5 rounded-2xl text-lg shadow-[0_6px_0_0_#f43f5e] hover:shadow-[0_8px_0_0_#e11d48] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            Reintentar ({retryCount}/3)
          </Button>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-sky-600 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg p-1"
          >
            <IconArrowLeft className="w-4 h-4" stroke={3} /> Volver al mapa
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-[100dvh] bg-sky-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-sky-200 rounded-full blur-3xl opacity-50 animate-pulse" />
        <div
          className="absolute bottom-1/3 right-1/3 w-72 h-72 bg-amber-200 rounded-full blur-3xl opacity-50 animate-pulse"
          style={{ animationDelay: '0.5s' }}
        />

        <div className="relative z-10 flex flex-col items-center text-center animate-fade-in">
          <Mascot className="w-56 h-56 animate-float mb-8" />

          <div className="bg-white/90 backdrop-blur-sm border-4 border-sky-200 shadow-[0_8px_0_0_#bae6fd] px-8 py-5 rounded-[2rem] flex items-center gap-4">
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
    <div className="h-[100dvh] bg-sky-50 font-sans text-slate-800 flex flex-col overflow-hidden relative">
      <div className="absolute top-0 left-0 w-[40rem] h-[40rem] bg-sky-200 rounded-full blur-[100px] opacity-30 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[40rem] h-[40rem] bg-amber-200 rounded-full blur-[100px] opacity-20 translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <LessonHeader
        isStart={isIdle}
        uiState={orchestrator.uiState}
        currentStep={orchestrator.currentStep}
        totalSteps={orchestrator.totalSteps}
        voiceSettings={voiceSettings}
        updateSettings={updateSettings}
        speakContent={orchestrator.speakContent}
        onReset={handleRestart}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-0 relative z-10 transition-all duration-700 ease-in-out">
        <div
          className={cn(
            'flex-1 w-full min-h-0 transition-all duration-700 ease-out',
            isIdle
              ? 'flex flex-col items-center justify-center'
              : 'flex flex-col lg:grid lg:grid-cols-12 gap-4 lg:gap-8 h-full',
          )}
        >
          <section
            className={cn(
              'relative flex flex-col items-center justify-center transition-all duration-700 shrink-0',
              isIdle
                ? 'w-full mb-8'
                : 'lg:col-span-5 min-h-[160px] sm:min-h-[200px] lg:min-h-0 lg:h-full',
            )}
          >
            <div className="relative group flex items-center justify-center h-full w-full">
              <div
                className={cn(
                  'absolute inset-0 bg-sky-400/20 blur-3xl rounded-full transition-all duration-700',
                  isSpeaking ? 'opacity-100 scale-110' : 'opacity-0 scale-100',
                )}
              />
              <Mascot
                className={cn(
                  'relative z-10 transition-all duration-500',
                  isIdle
                    ? 'w-72 h-72 sm:w-96 sm:h-96'
                    : 'w-40 h-40 sm:w-56 sm:h-56 lg:w-72 lg:h-72',
                )}
              />
            </div>
          </section>

          <section
            className={cn(
              'flex flex-col transition-all duration-700 ease-out relative',
              isIdle ? 'w-full max-w-lg mx-auto' : 'lg:col-span-7 flex-1 min-h-0 h-full w-full',
            )}
          >
            <div
              className={cn(
                'bg-white/95 backdrop-blur-md rounded-[2.5rem] lg:rounded-[3rem]',
                'border-4 border-white shadow-[0_8px_32px_rgba(56,189,248,0.15)]',
                'flex-1 flex flex-col w-full overflow-hidden relative',
                !isIdle && 'animate-in fade-in slide-in-from-bottom-8 duration-500',
              )}
            >
              {isTransitioning ? (
                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 flex items-center justify-center">
                  <Spinner size="lg" className="text-sky-500" />
                </div>
              ) : null}

              <div
                key={panelKey}
                className={cn(
                  'flex-1 flex flex-col w-full h-full min-h-0',
                  PANEL_TRANSITIONS.enter,
                )}
              >
                {renderActivePanel()}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

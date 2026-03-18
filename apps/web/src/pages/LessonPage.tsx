import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';

import { Mascot } from '@/components/mascot/Mascot';
import { Spinner, ErrorBanner } from '@/components/ui';
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

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { settings: voiceSettings, updateSettings } = useVoiceSettings();

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

  const handleMCQ = useCallback(
    (text: string, id: string) => {
      setSelectedId(id);
      submitAnswer(text);
    },
    [submitAnswer],
  );

  const handleRestart = useCallback(() => {
    reset();
    if (lessonId) startClass(lessonId);
  }, [reset, lessonId, startClass]);

  const isStart = uiState === 'idle';
  const isLoading = isStarting && !contentText && !error;

  const currentPanel = useMemo(() => {
    switch (uiState) {
      case 'concentration':
        return (
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
      case 'question':
        return (
          <QuestionPanel
            question={questionText}
            onAnswer={submitAnswer}
            isProcessing={isProcessing}
          />
        );
      case 'activity':
        return (
          <ActivityPanel
            question={questionText}
            options={options}
            onAnswer={handleMCQ}
            isProcessing={isProcessing}
            selectedId={selectedId}
            isCorrect={activityCorrect}
          />
        );
      case 'feedback':
        return feedback ? <FeedbackPanel fb={feedback} /> : null;
      case 'completed':
        return <CompletedPanel onRestart={handleRestart} />;
      default:
        return null;
    }
  }, [
    uiState,
    fullVoiceText,
    transitionText,
    contentText,
    closureText,
    currentWordIndex,
    isSynced,
    isSpeaking,
    resetTextSync,
    speakContent,
    questionText,
    submitAnswer,
    isProcessing,
    options,
    handleMCQ,
    selectedId,
    activityCorrect,
    feedback,
    handleRestart,
  ]);

  if (error && isStart) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
          <ErrorBanner
            title="¡Ups! El tutor se distrajo"
            message={error}
            onRetry={retry}
            retryCount={retryCount}
          />
          <Link
            to="/dashboard"
            className="mt-6 block text-center text-sm font-bold text-slate-400 hover:text-sky-600 transition-colors uppercase tracking-widest"
          >
            ← Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Mascot className="w-48 h-48 animate-bounce mb-8" />
        <div className="bg-white px-10 py-5 rounded-[2rem] shadow-xl shadow-sky-100/50 border border-sky-50 flex items-center gap-4 animate-pulse">
          <Spinner size="md" className="text-sky-500" />
          <span className="text-xl font-black text-slate-700 tracking-tight">
            Entrando al mundo del saber...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-sky-50/50 font-sans text-slate-800 flex flex-col overflow-x-hidden">
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
        className={`flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8 flex transition-all duration-700 ease-in-out ${
          isStart
            ? 'flex-col items-center justify-center min-h-[calc(100vh-8rem)]'
            : 'flex-col lg:flex-row gap-10 lg:items-start'
        }`}
      >
        <section
          className={`flex flex-col items-center transition-all duration-1000 shrink-0 ${
            isStart
              ? 'w-full mb-8 justify-center'
              : 'w-full lg:w-5/12 lg:sticky lg:top-0 lg:h-screen lg:justify-center'
          }`}
        >
          <div className="relative group">
            <div
              className={`absolute inset-0 bg-sky-400/20 blur-3xl rounded-full transition-opacity duration-700 ${
                isSpeaking ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <Mascot
              className={isStart ? 'w-64 h-64 sm:w-80 sm:h-80' : 'w-52 h-52 sm:w-64 sm:h-64'}
            />
          </div>

          {!isStart && uiState !== 'completed' ? (
            <div className="mt-8 flex items-center gap-3 bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-sky-100 shadow-lg animate-in fade-in slide-in-from-bottom-4">
              <span className="flex gap-1.5">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="w-2 h-2 bg-sky-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </span>
              <span className="text-xs font-black text-sky-600 uppercase tracking-widest">
                Tu tutor está hablando
              </span>
            </div>
          ) : null}
        </section>

        <section
          className={`flex flex-col transition-all duration-700 ease-out ${
            isStart
              ? 'w-full max-w-lg'
              : 'w-full lg:w-7/12 bg-white/95 backdrop-blur-md rounded-[3rem] border-2 border-white shadow-2xl shadow-sky-200/30 min-h-[560px] overflow-hidden relative'
          }`}
        >
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-8 duration-700">
            {currentPanel}
          </div>
        </section>
      </main>
    </div>
  );
}

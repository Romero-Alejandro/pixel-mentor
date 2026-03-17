/**
 * LessonPage.tsx — 5 UIStates distintos:
 *   idle          → StartPanel
 *   concentration → ConcentrationPanel  (auto-avanza con timer)
 *   question      → QuestionPanel       (input libre — comprensión)
 *   activity      → ActivityPanel       (MCQ — evaluación directa)
 *   feedback      → FeedbackPanel       (auto-avanza con timer)
 *   completed     → CompletedPanel
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { IconArrowLeft, IconSend, IconRepeat } from '@tabler/icons-react';

import {
  VoiceSettingsPanel,
  useVoiceSettings,
} from '@/components/voice-settings/VoiceSettingsPanel';
import {
  useClassOrchestrator,
  useVoiceSettingsSync,
  type UIState,
} from '@/hooks/useClassOrchestrator';
import { Mascot } from '@/components/mascot/Mascot';
import { Spinner } from '@/components/ui';

const UI_LABELS: Record<UIState, string> = {
  idle: 'Preparado',
  concentration: 'Aprendiendo',
  question: 'Pregunta',
  activity: 'Actividad',
  feedback: 'Retroalimentación',
  completed: '¡Completado!',
};

function StartPanel({ onStart, isLoading }: { onStart(): void; isLoading: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-8">
      <Mascot className="w-48 h-48" />
      <div>
        <h2 className="text-2xl font-bold text-slate-800">¡Vamos a aprender!</h2>
        <p className="text-slate-500 mt-1 max-w-sm">
          El tutor te guiará automáticamente paso a paso.
        </p>
      </div>
      <button
        onClick={onStart}
        disabled={isLoading}
        className="px-10 py-4 bg-sky-500 text-white text-lg font-bold rounded-2xl hover:bg-sky-600 disabled:opacity-50 transition-all shadow-lg hover:-translate-y-0.5 active:scale-95"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Spinner size="sm" />
            Iniciando...
          </span>
        ) : (
          '🚀 Comenzar la clase'
        )}
      </button>
    </div>
  );
}

function ConcentrationPanel({
  text,
  isSpeaking,
  onRepeat,
}: {
  text: string;
  isSpeaking: boolean;
  onRepeat(): void;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
      <div className="bg-white rounded-2xl border-2 border-sky-100 shadow-sm p-6 w-full max-w-lg">
        <p className="text-lg text-slate-700 leading-relaxed">
          {text || 'El tutor está explicando...'}
        </p>
      </div>
      <div className="h-8 flex items-center">
        {isSpeaking ? (
          <div className="flex items-center gap-2 text-sky-500 text-sm">
            <span className="flex gap-0.5">
              {[0, 120, 240].map((d) => (
                <span
                  key={d}
                  className="w-1 h-4 bg-sky-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </span>
            Hablando...
          </div>
        ) : text ? (
          <button
            onClick={onRepeat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-sky-500 hover:bg-sky-50 rounded-lg transition-colors"
          >
            <IconRepeat className="w-4 h-4" />
            Repetir
          </button>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Spinner size="sm" />
            Cargando...
          </div>
        )}
      </div>
    </div>
  );
}

/** Pregunta de comprensión: respuesta de texto libre evaluada por el LLM */
function QuestionPanel({
  question,
  onAnswer,
  isProcessing,
}: {
  question: string;
  onAnswer(t: string): void;
  isProcessing: boolean;
}) {
  const [val, setVal] = useState('');
  const submit = useCallback(() => {
    const t = val.trim();
    if (!t || isProcessing) return;
    onAnswer(t);
    setVal('');
  }, [val, isProcessing, onAnswer]);

  return (
    <div className="flex-1 flex flex-col p-6 gap-4">
      <div className="bg-sky-50 rounded-xl border border-sky-200 p-4">
        <span className="text-xs font-semibold text-sky-600 uppercase tracking-wide">
          💬 El tutor pregunta
        </span>
        <p className="mt-2 text-base font-semibold text-slate-800">{question}</p>
      </div>
      <div className="flex-1 flex flex-col gap-3">
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Escribí tu respuesta aquí..."
          disabled={isProcessing}
          rows={3}
          className="w-full p-3 rounded-xl border-2 border-slate-200 bg-white text-slate-800 focus:border-sky-400 focus:outline-none resize-none transition-colors disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={!val.trim() || isProcessing}
          className="self-end flex items-center gap-2 px-5 py-2.5 bg-sky-500 text-white font-semibold rounded-xl hover:bg-sky-600 disabled:opacity-40 transition-colors shadow"
        >
          {isProcessing ? (
            <Spinner size="sm" />
          ) : (
            <>
              <IconSend className="w-4 h-4" />
              Responder
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** Actividad / examen MCQ: evaluación determinista (sin LLM) */
function ActivityPanel({
  question,
  options,
  onAnswer,
  isProcessing,
  selectedId,
  isCorrect,
}: {
  question: string;
  options: { id: string; text: string; isCorrect?: boolean }[];
  onAnswer(text: string, id: string): void;
  isProcessing: boolean;
  selectedId: string | null;
  isCorrect: boolean | null;
}) {
  const answered = selectedId !== null;

  const cls = (opt: { id: string; isCorrect?: boolean }) => {
    if (!answered)
      return 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50 cursor-pointer';
    if (opt.id === selectedId)
      return isCorrect
        ? 'border-emerald-500 bg-emerald-50 cursor-default'
        : 'border-rose-500 bg-rose-50 cursor-default';
    if (opt.isCorrect && isCorrect === false)
      return 'border-emerald-400 bg-emerald-50 opacity-80 cursor-default';
    return 'border-slate-200 bg-white opacity-40 cursor-default';
  };

  return (
    <div className="flex-1 flex flex-col p-6 gap-4">
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
          📝 Actividad
        </span>
        <p className="mt-2 text-base font-semibold text-slate-800">{question}</p>
      </div>
      <div className="space-y-3">
        {options.map((opt, i) => (
          <button
            key={opt.id}
            onClick={() => !answered && !isProcessing && onAnswer(opt.text, opt.id)}
            disabled={answered || isProcessing}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left font-medium transition-all duration-200 shadow-sm ${cls(opt)} ${!answered && !isProcessing ? 'hover:shadow-md active:scale-[0.99]' : ''}`}
          >
            <span
              className={`w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-sm font-bold ${opt.id === selectedId && answered ? (isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white') : 'bg-slate-100 text-slate-600'}`}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1">{opt.text}</span>
            {answered && opt.id === selectedId ? <span>{isCorrect ? '✅' : '❌'}</span> : null}
            {answered && isCorrect === false && opt.isCorrect && opt.id !== selectedId ? (
              <span>✅</span>
            ) : null}
          </button>
        ))}
      </div>
      {isProcessing ? (
        <div className="flex justify-center mt-2">
          <Spinner size="sm" className="text-sky-500" />
        </div>
      ) : null}
    </div>
  );
}

function FeedbackPanel({
  fb,
}: {
  fb: { isCorrect: boolean; message: string; encouragement?: string };
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
      <div
        className={`w-20 h-20 rounded-full flex items-center justify-center ${fb.isCorrect ? 'bg-emerald-100' : 'bg-amber-100'}`}
      >
        <span className="text-4xl">{fb.isCorrect ? '🎉' : '💪'}</span>
      </div>
      <h3 className="text-xl font-bold">{fb.isCorrect ? '¡Correcto!' : '¡Casi!'}</h3>
      <p className="text-slate-600 max-w-sm">{fb.message}</p>
      {fb.encouragement ? (
        <p className="text-sm font-medium text-sky-600">{fb.encouragement}</p>
      ) : null}
      <p className="text-xs text-slate-400 animate-pulse mt-2">Continuando automáticamente...</p>
    </div>
  );
}

function CompletedPanel({ onRestart }: { onRestart(): void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-6">
      <div className="relative w-28 h-28">
        <div className="absolute inset-0 bg-emerald-300 rounded-full animate-ping opacity-30" />
        <div className="absolute inset-0 flex items-center justify-center text-6xl">🏆</div>
      </div>
      <div>
        <h2 className="text-2xl font-bold text-slate-800">¡Clase completada!</h2>
        <p className="text-slate-500 mt-1">Excelente trabajo.</p>
      </div>
      <button
        onClick={onRestart}
        className="px-6 py-3 bg-sky-500 text-white rounded-xl font-semibold hover:bg-sky-600 transition-colors shadow"
      >
        🔄 Repetir
      </button>
      <Link to="/dashboard" className="text-sm text-slate-400 hover:text-sky-600">
        ← Volver al inicio
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { settings: voiceSettings, updateSettings } = useVoiceSettings();
  useVoiceSettingsSync(voiceSettings);

  const {
    uiState,
    currentStep,
    totalSteps,
    contentText,
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
  } = useClassOrchestrator();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activityCorrect, setActivityCorrect] = useState<boolean | null>(null);
  const prevQ = useRef('');

  useEffect(() => {
    if (questionText !== prevQ.current) {
      prevQ.current = questionText;
      setSelectedId(null);
      setActivityCorrect(null);
    }
  }, [questionText]);

  useEffect(() => {
    if (feedback && uiState === 'feedback') setActivityCorrect(feedback.isCorrect);
  }, [feedback, uiState]);

  const handleStart = useCallback(() => {
    if (lessonId) startClass(lessonId);
  }, [lessonId, startClass]);
  const handleMCQ = useCallback(
    (text: string, id: string) => {
      setSelectedId(id);
      submitAnswer(text);
    },
    [submitAnswer],
  );
  const handleFree = useCallback((text: string) => submitAnswer(text), [submitAnswer]);
  const handleRestart = useCallback(() => {
    reset();
    if (lessonId) startClass(lessonId);
  }, [reset, lessonId, startClass]);

  useEffect(
    () => () => {
      stopSpeaking();
      reset();
    },
    [],
  ); // eslint-disable-line

  const isStart = uiState === 'idle';

  if (isStart && isProcessing && !contentText)
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-slate-100 flex flex-col">
        <header className="bg-white/80 border-b border-sky-100 h-16 flex items-center px-6">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-slate-500 hover:text-sky-600"
          >
            <IconArrowLeft className="w-5 h-5" />
            <span className="text-sm">Volver</span>
          </Link>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center gap-4">
          <Mascot className="w-48 h-48" />
          <div className="flex items-center gap-2 text-slate-500">
            <Spinner size="sm" />
            <span>Cargando tu clase...</span>
          </div>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-slate-100 font-sans text-slate-800 flex flex-col overflow-x-hidden">
      <header className="bg-white/80 backdrop-blur-sm border-b border-sky-100 h-16 flex items-center px-4 sm:px-6 shrink-0 z-10">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
          >
            <IconArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">Volver</span>
          </Link>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex items-center gap-3 bg-white border-2 border-sky-100 px-4 py-2 rounded-full shadow-sm transition-opacity ${isStart ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full animate-pulse ${uiState === 'completed' ? 'bg-emerald-400' : 'bg-amber-400'}`}
              />
              <span className="text-sm font-semibold text-slate-700">{UI_LABELS[uiState]}</span>
            </div>
            {totalSteps > 0 && !isStart ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>
                  Paso {currentStep + 1} / {totalSteps}
                </span>
                <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all duration-500"
                    style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <VoiceSettingsPanel
            settings={voiceSettings}
            onSettingsChange={updateSettings}
            onPreview={speakContent}
          />
        </div>
      </header>

      <main
        className={`flex-1 max-w-7xl mx-auto w-full p-3 sm:p-4 flex min-h-0 transition-all duration-700 ${isStart ? 'flex-col items-center justify-center' : 'flex-col lg:flex-row gap-6'}`}
      >
        <section
          className={`flex flex-col items-center justify-center transition-all duration-700 ${isStart ? 'w-full' : 'w-full lg:w-5/12'}`}
        >
          <Mascot className={isStart ? 'w-56 h-56 sm:w-72 sm:h-72' : 'w-44 h-44'} />
        </section>

        <section
          className={`flex flex-col transition-all duration-700 ${isStart ? 'w-full max-w-lg' : 'w-full lg:w-7/12 bg-white rounded-3xl border-2 border-sky-100 shadow-sm min-h-[480px] overflow-hidden'}`}
        >
          {uiState === 'idle' ? (
            <StartPanel onStart={handleStart} isLoading={isProcessing} />
          ) : null}
          {uiState === 'concentration' ? (
            <ConcentrationPanel
              text={contentText}
              isSpeaking={isSpeaking}
              onRepeat={speakContent}
            />
          ) : null}
          {uiState === 'question' ? (
            <QuestionPanel
              question={questionText}
              onAnswer={handleFree}
              isProcessing={isProcessing}
            />
          ) : null}
          {uiState === 'activity' ? (
            <ActivityPanel
              question={questionText}
              options={options}
              onAnswer={handleMCQ}
              isProcessing={isProcessing}
              selectedId={selectedId}
              isCorrect={activityCorrect}
            />
          ) : null}
          {uiState === 'feedback' && feedback ? <FeedbackPanel fb={feedback} /> : null}
          {uiState === 'completed' ? <CompletedPanel onRestart={handleRestart} /> : null}
        </section>
      </main>
    </div>
  );
}

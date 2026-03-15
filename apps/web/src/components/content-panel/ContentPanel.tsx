import { type ActivityOption } from '../activity-card/ActivityCard';

import { getEncouragementPhrase, getJoke } from '@/utils/dialogue';
import { type LessonConfig } from '@/stores/lessonStore';

export type ContentType = 'explanation' | 'question' | 'activity' | 'listening' | 'completed';

// Script content from static content
export interface ScriptContent {
  transition?: string;
  content?: string;
  examples?: string[];
  closure?: string;
}

interface ContentPanelProps {
  contentType: ContentType;
  // For explanation
  explanationText?: string;
  // Script content (static content from backend)
  scriptContent?: ScriptContent;
  // For question (voice)
  questionPrompt?: string;
  // For activity
  activityQuestion?: string;
  activityOptions?: ActivityOption[];
  onActivitySelect?: (optionId: string) => void;
  activityCorrect?: boolean | null;
  activityFeedback?: string;
  // Activity timers
  timeRemaining?: number;
  hasWarned?: boolean;
  // Student name for personalized dialogue
  studentName?: string | null;
  // Configuration for dialogue phrases
  config?: LessonConfig | null;
  // For completed
  completionMessage?: string;
  // Current pedagogical state for specific UI modes
  pedagogicalState?: string;
}

export function ContentPanel({
  contentType,
  explanationText,
  scriptContent,
  questionPrompt,
  activityQuestion,
  activityOptions = [],
  onActivitySelect,
  activityCorrect = null,
  activityFeedback,
  completionMessage = '¡Misión completada!',
  studentName,
  timeRemaining,
  hasWarned,
  config = null,
  pedagogicalState,
}: ContentPanelProps) {
  // === MODO PIZARRA: Durante actividades ===
  if (contentType === 'activity' && activityQuestion && activityOptions.length > 0) {
    return (
      <div className="flex flex-col h-full">
        {/* Header de pizarra */}
        <div className="bg-amber-500 text-white px-6 py-3 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <h3 className="font-bold">¡Vamos a practicar!</h3>
              <p className="text-amber-100 text-sm">Selecciona la respuesta correcta</p>
            </div>
          </div>
        </div>

        {/* Contenido de la pizarra */}
        <div className="flex-1 p-6 bg-amber-50 overflow-y-auto">
          {/* Pregunta en la pizarra */}
          <div className="bg-white rounded-2xl p-6 shadow-lg mb-6 border-4 border-amber-200">
            <h2 className="text-xl font-bold text-slate-800 text-center">{activityQuestion}</h2>
          </div>

          {/* Opciones estilo pizarra */}
          <div className="space-y-3">
            {activityOptions.map((option, index) => {
              const isSelected = false;
              const showResult = activityCorrect !== null;

              let optionClass = 'border-2 border-slate-300 bg-white';
              if (showResult) {
                if (option.isCorrect) {
                  optionClass = 'border-emerald-500 bg-emerald-100';
                } else if (isSelected && !option.isCorrect) {
                  optionClass = 'border-red-500 bg-red-100';
                }
              }

              return (
                <button
                  key={option.id}
                  onClick={() => onActivitySelect?.(option.id)}
                  disabled={showResult}
                  className={`
                    w-full flex items-center gap-4 p-4 rounded-xl text-left font-semibold 
                    transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02]
                    ${optionClass}
                    ${!showResult ? 'hover:border-amber-400 cursor-pointer' : 'cursor-not-allowed'}
                  `}
                >
                  {/* Letra en círculo */}
                  <span
                    className={`
                    w-10 h-10 flex items-center justify-center rounded-full text-lg font-bold shrink-0
                    ${
                      showResult && option.isCorrect
                        ? 'bg-emerald-500 text-white'
                        : showResult && !option.isCorrect
                          ? 'bg-slate-300 text-slate-600'
                          : 'bg-amber-500 text-white'
                    }
                  `}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>

                  <span className="flex-1 text-lg text-slate-800">{option.text}</span>

                  {showResult && option.isCorrect ? <span className="text-2xl">✅</span> : null}
                  {showResult && !option.isCorrect && isSelected ? (
                    <span className="text-2xl">❌</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {activityFeedback ? (
            <div
              className={`
              mt-6 p-4 rounded-xl border-2 text-center font-medium
              ${activityCorrect ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-amber-100 border-amber-300 text-amber-800'}
            `}
            >
              {activityFeedback}
            </div>
          ) : null}

          {/* Timer */}
          {timeRemaining !== undefined ? (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow">
                <span
                  className={`text-lg ${hasWarned ? 'text-red-500 animate-pulse' : 'text-slate-600'}`}
                >
                  ⏱️
                </span>
                <span className={`font-bold ${hasWarned ? 'text-red-500' : 'text-slate-700'}`}>
                  {timeRemaining}s
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // === MODO ESCUCHANDO: Resolviendo dudas ===
  if (contentType === 'listening') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-24 h-24 mb-6 relative">
          <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-50" />
          <div className="absolute inset-0 bg-amber-500 rounded-full animate-pulse flex items-center justify-center">
            <span className="text-5xl">💭</span>
          </div>
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">
          {questionPrompt || 'Cuéntame tu duda...'}
        </h3>
        <p className="text-slate-500">Estoy pensando...</p>
      </div>
    );
  }

  // === MODO EVALUACIÓN: Mostrando resultado ===
  if (pedagogicalState === 'EVALUATION' && activityCorrect !== null) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div
          className={`w-24 h-24 mb-6 rounded-full flex items-center justify-center ${
            activityCorrect ? 'bg-emerald-100' : 'bg-amber-100'
          }`}
        >
          <span className="text-5xl">{activityCorrect ? '🎉' : '💪'}</span>
        </div>

        <h3 className="text-2xl font-bold text-slate-800 mb-2">
          {activityCorrect ? '¡Muy bien!' : '¡Casi lo tienes!'}
        </h3>

        {activityFeedback ? (
          <p className="text-lg text-slate-600 mb-4 max-w-md">{activityFeedback}</p>
        ) : null}

        <p className="text-sm text-slate-400 animate-pulse">Continuando...</p>
      </div>
    );
  }

  // === MODO COMPLETADO ===
  if (contentType === 'completed') {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="w-32 h-32 mb-6 relative">
          <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-30" />
          <div className="absolute inset-0 flex items-center justify-center text-7xl">🏆</div>
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-2">¡Excelente!</h2>
        <p className="text-lg text-slate-600 max-w-md">{completionMessage}</p>
        <p className="text-sm text-slate-400 mt-4">Has completado esta lección</p>
      </div>
    );
  }

  // === MODO EXPLICACIÓN: Contenido normal ===
  return (
    <div className="h-full overflow-y-auto">
      {/* Transición */}
      {scriptContent?.transition ? (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border-b border-amber-200 px-6 py-4">
          <p className="text-amber-800 font-medium">💬 {scriptContent.transition}</p>
        </div>
      ) : null}

      {/* Contenido principal */}
      <div className="p-6 space-y-4">
        <div className="bg-gradient-to-br from-sky-50 to-white rounded-2xl p-6 shadow-md border border-sky-100">
          <p className="text-lg text-slate-700 leading-relaxed">
            {explanationText ||
              scriptContent?.content ||
              `¡Hola, ${studentName || 'estudiante'}! Vamos a aprender algo increíble hoy.`}
          </p>
        </div>

        {/* Ejemplos */}
        {scriptContent?.examples && scriptContent.examples.length > 0 ? (
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <h4 className="text-sm font-bold text-emerald-700 mb-2">📋 Ejemplos:</h4>
            <ul className="space-y-1">
              {scriptContent.examples.map((example, idx) => (
                <li key={idx} className="text-sm text-emerald-600 flex items-start gap-2">
                  <span className="text-emerald-400">•</span>
                  <span>{example}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Cierre */}
        {scriptContent?.closure ? (
          <div className="bg-violet-50 rounded-xl p-4 border border-violet-200">
            <p className="text-violet-700 font-medium">✨ {scriptContent.closure}</p>
          </div>
        ) : null}

        {/* Frases de ánimo ocasionales */}
        {studentName && config && Math.random() < 0.15 ? (
          <div className="bg-amber-50 rounded-xl p-3 text-center text-amber-700 text-sm">
            {Math.random() < 0.5
              ? getEncouragementPhrase(config, studentName)
              : getJoke(config, studentName)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { useState, useCallback } from 'react';

export interface ActivityOption {
  id: string;
  text: string;
  isCorrect?: boolean;
}

export interface ActivityCardProps {
  question: string;
  options: ActivityOption[];
  onSelect: (optionId: string) => void;
  isCorrect?: boolean | null;
  correctOptionId?: string;
  feedback?: string;
  isDisabled?: boolean;
  maxAttempts?: number;
  currentAttempt?: number;
}

export function ActivityCard({
  question,
  options,
  onSelect,
  isCorrect = null,
  correctOptionId,
  feedback,
  isDisabled = false,
  maxAttempts = 3,
  currentAttempt = 0,
}: ActivityCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = useCallback(
    (optionId: string) => {
      if (isDisabled) return;
      setSelectedId(optionId);
      onSelect(optionId);
    },
    [isDisabled, onSelect],
  );

  const attemptsRemaining = maxAttempts - currentAttempt;

  const getOptionStyle = (optionId: string) => {
    if (isCorrect === null) {
      // No answer yet
      return selectedId === optionId
        ? 'border-sky-500 bg-sky-50 ring-2 ring-sky-200'
        : 'border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50';
    }

    if (isCorrect) {
      // Show correct answer
      if (optionId === correctOptionId) {
        return 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200';
      }
      if (optionId === selectedId) {
        return 'border-emerald-300 bg-emerald-50 opacity-75';
      }
      return 'border-slate-200 bg-white opacity-50';
    }

    // Incorrect answer
    if (optionId === selectedId) {
      return 'border-rose-500 bg-rose-50 ring-2 ring-rose-200';
    }
    if (optionId === correctOptionId) {
      return 'border-emerald-500 bg-emerald-50';
    }
    return 'border-slate-200 bg-white opacity-75';
  };

  const getOptionIcon = (optionId: string) => {
    if (isCorrect === null) return null;

    if (isCorrect) {
      if (optionId === correctOptionId) {
        return (
          <svg
            className="w-5 h-5 text-emerald-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      }
      return null;
    }

    // Incorrect
    if (optionId === selectedId) {
      return (
        <svg
          className="w-5 h-5 text-rose-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      );
    }
    if (optionId === correctOptionId) {
      return (
        <svg
          className="w-5 h-5 text-emerald-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {/* Question Header */}
      <div className="mb-4">
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-700">
          📝 Actividad
        </span>
        {attemptsRemaining < maxAttempts ? (
          <span className="ml-2 text-xs text-slate-500">
            Intentos: {currentAttempt}/{maxAttempts}
          </span>
        ) : null}
      </div>

      {/* Question Text */}
      <h3 className="text-lg font-semibold text-slate-800 mb-6">{question}</h3>

      {/* Options */}
      <div className="space-y-3">
        {options.map((option, index) => (
          <button
            key={option.id}
            onClick={() => handleSelect(option.id)}
            disabled={isDisabled}
            className={`
              w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left font-medium transition-all duration-200
              ${getOptionStyle(option.id)}
              ${!isDisabled ? 'cursor-pointer hover:shadow-md active:scale-[0.99]' : 'cursor-not-allowed'}
            `}
          >
            {/* Option Letter */}
            <span
              className={`
                w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold shrink-0
                ${
                  selectedId === option.id && isCorrect === null
                    ? 'bg-sky-500 text-white'
                    : 'bg-slate-100 text-slate-600'
                }
              `}
            >
              {String.fromCharCode(65 + index)}
            </span>

            {/* Option Text */}
            <span className="flex-1">{option.text}</span>

            {/* Result Icon */}
            {getOptionIcon(option.id)}
          </button>
        ))}
      </div>

      {/* Feedback */}
      {feedback ? (
        <div
          className={`
            mt-4 p-4 rounded-xl border-2
            ${
              isCorrect
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }
          `}
        >
          <p className="font-medium">{feedback}</p>
        </div>
      ) : null}

      {/* Hint for wrong answer */}
      {isCorrect === false && attemptsRemaining > 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          ¡Inténtalo de nuevo! Tienes {attemptsRemaining}{' '}
          {attemptsRemaining === 1 ? 'intento' : 'intentos'} más.
        </p>
      ) : null}
    </div>
  );
}

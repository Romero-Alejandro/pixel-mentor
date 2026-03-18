import { memo } from 'react';
import { Link } from 'react-router-dom';
import { IconArrowLeft } from '@tabler/icons-react';

import { UIState } from '../hooks/useLessonState';

import { VoiceSettingsPanel } from '@/components/voice-settings/VoiceSettingsPanel';
import type { VoiceSettings } from '@/hooks/useVoice';

interface HeaderProps {
  isStart: boolean;
  uiState: UIState;
  currentStep: number;
  totalSteps: number;
  voiceSettings: VoiceSettings;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  speakContent: () => void;
}

const UI_LABELS: Record<UIState, string> = {
  idle: 'Preparado',
  concentration: 'Aprendiendo',
  question: 'Pregunta',
  activity: 'Actividad',
  feedback: 'Retroalimentación',
  completed: '¡Logrado!',
};

export const LessonHeader = memo(
  ({
    isStart,
    uiState,
    currentStep,
    totalSteps,
    voiceSettings,
    updateSettings,
    speakContent,
  }: HeaderProps) => {
    return (
      <header className="sticky top-0 z-30 h-16 w-full border-b border-sky-100 bg-white/80 px-4 backdrop-blur-md shadow-sm sm:px-6">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
          {/* Lado Izquierdo: Navegación */}
          <div className="flex flex-1 items-center">
            <Link
              to="/dashboard"
              className="group flex items-center gap-2 rounded-xl px-3 py-2 text-slate-500 transition-all hover:bg-sky-50 hover:text-sky-600"
              aria-label="Volver al panel"
            >
              <IconArrowLeft className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
              <span className="hidden text-sm font-semibold sm:inline">Panel</span>
            </Link>
          </div>

          {/* Centro: Estado y Progreso */}
          <div
            className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${
              isStart ? 'pointer-events-none scale-95 opacity-0' : 'scale-100 opacity-100'
            }`}
          >
            {/* Badge de Estado */}
            <div className="flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50/50 px-4 py-1 shadow-sm">
              <span
                className={`h-2 w-2 rounded-full animate-pulse ${
                  uiState === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                {UI_LABELS[uiState]}
              </span>
            </div>

            {/* Barra de Pasos */}
            {totalSteps > 0 ? (
              <div
                className="flex items-center gap-1.5"
                aria-label={`Paso ${currentStep + 1} de ${totalSteps}`}
              >
                {Array.from({ length: totalSteps }).map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      idx <= currentStep
                        ? 'w-5 bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]'
                        : 'w-1.5 bg-slate-200'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* Lado Derecho: Ajustes de Voz */}
          <div className="flex flex-1 justify-end">
            <VoiceSettingsPanel
              settings={voiceSettings}
              onSettingsChange={updateSettings}
              onPreview={speakContent}
            />
          </div>
        </div>
      </header>
    );
  },
);

LessonHeader.displayName = 'LessonHeader';

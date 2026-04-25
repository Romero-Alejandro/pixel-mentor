import { Link } from 'react-router-dom';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';
import { cn } from '@/utils/cn';
import { UIState } from '../hooks/useLessonState';
import { VoiceSettingsPanel } from '@/features/voice/components/VoiceSettingsPanel';
import type { VoiceSettings } from '@/features/voice/hooks/useVoice';

interface HeaderProps {
  isStart: boolean;
  uiState: UIState;
  currentStep: number;
  totalSteps: number;
  voiceSettings: VoiceSettings;
  updateSettings: (settings: Partial<VoiceSettings>) => void;
  speakContent: () => void;
  onReset?: () => void;
}

const UI_LABELS: Record<UIState, string> = {
  idle: 'Preparado',
  concentration: 'Aprendiendo',
  question: 'Tu Turno',
  activity: 'Desafío',
  feedback: 'Resultado',
  completed: '¡Misión Cumplida!',
};

export function LessonHeader({
  isStart,
  uiState,
  currentStep,
  totalSteps,
  voiceSettings,
  updateSettings,
  speakContent,
  onReset,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 h-20 w-full border-b-4 border-sky-100 bg-white/80 px-4 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between">
        <div className="flex flex-1 items-center">
          <Link
            to="/dashboard"
            className="group flex items-center gap-2 rounded-2xl px-4 py-2 border-4 border-transparent hover:border-sky-200 bg-transparent hover:bg-sky-50 text-slate-500 hover:text-sky-700 font-black transition-all cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
            aria-label="Volver al mapa"
          >
            <IconArrowLeft
              className="h-6 w-6 transition-transform group-hover:-translate-x-1"
              stroke={3}
            />
            <span className="hidden sm:inline tracking-wider uppercase text-xs">Mapa</span>
          </Link>
        </div>

        <div
          className={cn(
            'flex flex-col items-center gap-2 transition-all duration-500',
            isStart ? 'pointer-events-none scale-95 opacity-0' : 'scale-100 opacity-100',
          )}
        >
          <div className="flex items-center gap-2 rounded-full border-4 border-sky-200 bg-sky-50 px-5 py-1.5 shadow-[0_4px_0_0_#bae6fd]">
            <span
              className={cn(
                'h-3 w-3 rounded-full animate-pulse',
                uiState === 'completed' ? 'bg-emerald-500' : 'bg-amber-500',
              )}
            />
            <span className="text-[11px] font-black uppercase tracking-widest text-sky-900">
              {UI_LABELS[uiState]}
            </span>
          </div>

          {totalSteps > 0 ? (
            <div
              className="flex items-center gap-2 bg-slate-100 rounded-full px-2 py-1 border-2 border-slate-200"
              aria-label={`Paso ${currentStep + 1} de ${totalSteps}`}
            >
              {Array.from({ length: totalSteps }).map((_, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'h-2 rounded-full transition-all duration-500',
                    idx <= currentStep
                      ? 'w-6 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]'
                      : 'w-2 bg-slate-300',
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 justify-end items-center gap-2">
          {onReset && !isStart ? (
            <button
              onClick={onReset}
              className="group flex items-center gap-2 rounded-2xl px-4 py-2 border-4 border-transparent hover:border-rose-200 bg-transparent hover:bg-rose-50 text-slate-500 hover:text-rose-600 font-black transition-all cursor-pointer outline-none focus-visible:ring-4 focus-visible:ring-rose-200"
              aria-label="Reiniciar clase"
              title="Reiniciar clase"
            >
              <IconRefresh
                className="h-5 w-5 transition-transform group-hover:rotate-180"
                stroke={3}
              />
              <span className="hidden sm:inline tracking-wider uppercase text-xs">Reiniciar</span>
            </button>
          ) : null}
          <VoiceSettingsPanel
            settings={voiceSettings}
            onSettingsChange={updateSettings}
            onPreview={speakContent}
          />
        </div>
      </div>
    </header>
  );
}

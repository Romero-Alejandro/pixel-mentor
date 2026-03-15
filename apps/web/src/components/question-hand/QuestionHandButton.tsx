import { useCallback } from 'react';
import { IconHandStop, IconCheck, IconClock } from '@tabler/icons-react';

export type HandState = 'idle' | 'raised' | 'listening' | 'resolved';

interface QuestionHandButtonProps {
  handState: HandState;
  onRaiseHand: () => void;
  isDisabled?: boolean;
  cooldownRemaining?: number;
}

export function QuestionHandButton({
  handState,
  onRaiseHand,
  isDisabled = false,
  cooldownRemaining: externalCooldown = 0,
}: QuestionHandButtonProps) {
  const actualCooldown = externalCooldown;

  const handleClick = useCallback(() => {
    if (isDisabled || actualCooldown > 0 || handState !== 'idle') return;
    onRaiseHand();
  }, [isDisabled, actualCooldown, handState, onRaiseHand]);

  const isActive = handState === 'raised' || handState === 'listening';
  const isResolved = handState === 'resolved';
  const isOnCooldown = actualCooldown > 0;

  const getButtonContent = () => {
    if (isResolved) {
      return (
        <>
          <IconCheck className="w-5 h-5" />
          <span>¡Listo!</span>
        </>
      );
    }
    if (handState === 'listening') {
      return (
        <>
          <div className="w-5 h-5 relative">
            <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-75" />
            <div className="absolute inset-0 bg-amber-500 rounded-full" />
          </div>
          <span>Escuchando...</span>
        </>
      );
    }
    if (handState === 'raised') {
      return (
        <>
          <span className="text-xl">✋</span>
          <span>Tu duda</span>
        </>
      );
    }
    if (isOnCooldown) {
      return (
        <>
          <IconClock className="w-5 h-5" />
          <span>{actualCooldown}s</span>
        </>
      );
    }
    return (
      <>
        <IconHandStop className="w-5 h-5" />
        <span>Tengo una duda</span>
      </>
    );
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled || isOnCooldown}
      className={`
        flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all duration-200
        ${
          isDisabled || isOnCooldown
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : isActive
              ? 'bg-amber-100 text-amber-700 border-2 border-amber-300 animate-pulse'
              : isResolved
                ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300'
                : 'bg-white text-slate-700 border-2 border-slate-200 hover:border-amber-300 hover:bg-amber-50 active:scale-95 shadow-sm'
        }
      `}
    >
      {getButtonContent()}
    </button>
  );
}

export { type QuestionHandButtonProps };

import { useState, useCallback, ChangeEvent, useMemo } from 'react';
import { IconVolume, IconVolumeOff, IconVolume2, IconVolume3 } from '@tabler/icons-react';

import { useAudio } from '@/contexts/AudioContext';
import { cn } from '@/utils/cn';

interface VolumeSliderProps {
  volume: number;
  onChange: (value: number) => void;
  isMuted: boolean;
}

const VolumeSlider = ({ volume, onChange, isMuted }: VolumeSliderProps) => {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange],
  );

  const percentage = useMemo(() => Math.round(volume * 100), [volume]);

  return (
    <div
      className="absolute top-full right-0 pt-3 w-44 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
      role="dialog"
      aria-label="Control de volumen"
    >
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-4">
        <div className="relative pt-4 pb-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleChange}
            className={cn(
              'w-full h-1.5 rounded-full appearance-none cursor-pointer accent-sky-600',
              isMuted ? 'bg-slate-200' : 'bg-slate-100',
            )}
            style={{
              background: `linear-gradient(to right, #0284c7 0%, #0284c7 ${percentage}%, #f1f5f9 ${percentage}%, #f1f5f9 100%)`,
            }}
          />
          <span
            className="absolute top-0 -translate-x-1/2 text-[11px] font-bold text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-md border border-sky-100"
            style={{ left: `${percentage}%` }}
          >
            {percentage}%
          </span>
        </div>

        <div className="flex justify-between mt-1 px-0.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Mín
          </span>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Máx
          </span>
        </div>
      </div>
    </div>
  );
};

export function AudioControl() {
  const { isMuted, toggleMute, volume, setVolume } = useAudio();
  const [isHovered, setIsHovered] = useState(false);

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <IconVolumeOff className="w-5 h-5" />;
    if (volume < 0.3) return <IconVolume className="w-5 h-5" />;
    if (volume < 0.7) return <IconVolume2 className="w-5 h-5" />;
    return <IconVolume3 className="w-5 h-5" />;
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={toggleMute}
        className={cn(
          'p-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500/40',
          isHovered ? 'bg-sky-50 text-sky-600' : 'text-slate-500 hover:bg-slate-50',
        )}
        aria-label={isMuted ? 'Activar sonido' : 'Silenciar'}
      >
        {getVolumeIcon()}
      </button>

      {isHovered ? <VolumeSlider volume={volume} onChange={setVolume} isMuted={isMuted} /> : null}
    </div>
  );
}

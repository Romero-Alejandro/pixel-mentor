import { useCallback, useEffect } from 'react';
import { IconRepeat, IconPlayerPlay } from '@tabler/icons-react';

import { useLessonStore } from '@/stores/lessonStore';
import { Button } from '@/components/ui';
import { useAudio } from '@/contexts/AudioContext';

interface ActivitySkipOfferProps {
  onRepeat: () => void;
  onContinue: () => void;
  studentName: string;
}

export function ActivitySkipOffer({ onRepeat, onContinue, studentName }: ActivitySkipOfferProps) {
  const setCurrentState = useLessonStore((state) => state.setCurrentState);
  const { playClick, playClickSecondary, playModalOpen } = useAudio();

  // Sonido cuando aparece el panel
  useEffect(() => {
    playModalOpen();
  }, [playModalOpen]);

  const handleRepeat = useCallback(() => {
    playClickSecondary();
    setCurrentState('ACTIVITY_REPEAT');
    onRepeat();
  }, [setCurrentState, onRepeat, playClickSecondary]);

  const handleContinue = useCallback(() => {
    playClick();
    setCurrentState('ACTIVE_CLASS');
    onContinue();
  }, [setCurrentState, onContinue, playClick]);

  return (
    <div className="p-6 bg-gradient-to-br from-amber-50 to-amber-100/50 border-2 border-amber-200 rounded-xl text-center">
      <h3 className="text-xl font-bold text-amber-800 mb-2">¿Qué prefieres, {studentName}?</h3>
      <p className="text-amber-600 mb-6">Elige cómo continuar tu aprendizaje</p>
      <div className="flex flex-col gap-3">
        <Button onClick={handleRepeat} variant="secondary" className="w-full justify-center">
          <IconRepeat className="w-5 h-5 mr-2" />
          Repetir el tema
        </Button>
        <Button onClick={handleContinue} className="w-full justify-center">
          <IconPlayerPlay className="w-5 h-5 mr-2" />
          Continuar
        </Button>
      </div>
    </div>
  );
}

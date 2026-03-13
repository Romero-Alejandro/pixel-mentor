import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas';
import { useEffect } from 'react';

import { useLessonStore } from '@/stores/lessonStore';

interface RiveObjectWithOpacity {
  name: string;
  opacity: number;
}

export function Mascot() {
  const { isSpeaking, isListening, currentState } = useLessonStore();

  const { rive, RiveComponent } = useRive({
    src: '/assets/robot-expressions.riv',
    animations: 'Idle',
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
    onLoad: (riveInstance) => {
      if (!riveInstance) return;

      const artboard = (riveInstance as unknown as { artboard: any }).artboard;
      if (!artboard) return;

      const hiddenNodes = ['Background', 'BG', 'Expressions', 'Accessories', 'Buttons', 'Shadow'];

      for (let i = 0; i < artboard.objectsCount; i++) {
        const obj = artboard.objectAt(i) as RiveObjectWithOpacity;
        if (obj && hiddenNodes.some((name) => obj.name.includes(name))) {
          if (typeof obj.opacity === 'number') {
            obj.opacity = 0;
          }
        }
      }
    },
  });

  useEffect(() => {
    if (!rive) return;

    rive.stop();

    if (isSpeaking) {
      rive.play(['normal smile_face', 'normal smile_arms']);
    } else if (isListening) {
      rive.play(['surprised_face', 'suprised_arms']);
    } else if (currentState === 'RESOLVING_DOUBT') {
      rive.play(['super happy_face', 'super happy_arms']);
    } else {
      rive.play('Idle');
    }
  }, [rive, isSpeaking, isListening, currentState]);

  return (
    <div className="w-64 h-64 mx-auto flex items-center justify-center relative overflow-hidden bg-transparent">
      <div className="absolute inset-0 bg-cyan-500/5 blur-3xl rounded-full" />
      <RiveComponent className="w-full h-full relative z-10 scale-110" />
    </div>
  );
}

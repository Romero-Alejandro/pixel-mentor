import { useEffect } from 'react';

import { useLessonStore } from '@/features/lesson/stores/lesson.store';
import { useRecipeInteraction } from '@/features/lesson/hooks/useLessonQueries';
import { useAudio } from '@/contexts/AudioContext';
import { useAlert } from '@/hooks/useConfirmationDialogs';
import { SpriteAudioEvent, MicroAudioEvent } from '@/audio/types/audio-events';

export function LessonStart() {
  const { sessionId, studentName } = useLessonStore();
  const { mutateAsync: interactWithRecipe } = useRecipeInteraction();
  const setCurrentState = useLessonStore((state) => state.setCurrentState);
  const { playMicro, playSprite } = useAudio();
  const alert = useAlert();

  // Sonido al aparecer el panel de inicio de lección
  useEffect(() => {
    playSprite(SpriteAudioEvent.LessonStart);
  }, [playSprite]);

  const handleStartLesson = async () => {
    playMicro(MicroAudioEvent.Click);
    console.log('LessonStart button clicked');
    console.log('sessionId:', sessionId);

    if (!sessionId) {
      console.error('No sessionId available');
      await alert({ title: 'Error', message: 'No session ID available', variant: 'error' });
      return;
    }

    try {
      console.log('Sending interaction with input: sí');
      const result = await interactWithRecipe({ sessionId, input: 'sí' });
      console.log('Interaction successful:', result);

      // Update the lesson store with the response
      setCurrentState(result.pedagogicalState);

      console.log('State updated to:', result.pedagogicalState);
    } catch (error: unknown) {
      console.error('Failed to start lesson:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      await alert({
        title: 'Error',
        message: 'Error starting lesson: ' + message,
        variant: 'error',
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="mb-6">
        <span className="text-5xl">📚</span>
      </div>
      <h1 className="text-2xl font-bold text-slate-800 mb-4">
        ¡Hola, {studentName || 'Estudiante'}! Bienvenido a la clase de hoy.
      </h1>
      <button
        onClick={handleStartLesson}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
      >
        ¿Estás listo?
      </button>
    </div>
  );
}

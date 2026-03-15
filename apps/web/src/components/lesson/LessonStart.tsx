import { useLessonStore } from '../../stores/lessonStore';
import { useRecipeInteraction } from '../../hooks/useLessonQueries';

export function LessonStart() {
  const { sessionId, studentName } = useLessonStore();
  const { mutateAsync: interactWithRecipe } = useRecipeInteraction();
  const setCurrentState = useLessonStore((state) => state.setCurrentState);

  const handleStartLesson = async () => {
    console.log('LessonStart button clicked');
    console.log('sessionId:', sessionId);

    if (!sessionId) {
      console.error('No sessionId available');
      alert('Error: No session ID available');
      return;
    }

    try {
      console.log('Sending interaction with input: sí');
      const result = await interactWithRecipe({ sessionId, input: 'sí' });
      console.log('Interaction successful:', result);

      // Update the lesson store with the response
      setCurrentState(result.pedagogicalState);

      console.log('State updated to:', result.pedagogicalState);
    } catch (error: any) {
      console.error('Failed to start lesson:', error);
      alert('Error starting lesson: ' + (error.message || 'Unknown error'));
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

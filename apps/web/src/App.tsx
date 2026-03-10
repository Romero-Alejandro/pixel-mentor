import { useLessonStore } from './stores/lessonStore';

function App() {
  const { currentState, isListening, isSpeaking } = useLessonStore();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="max-w-md w-full p-6 bg-white rounded-2xl shadow-lg">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700">Pixel Mentor</h1>
          <p className="text-gray-600 mt-2">Tu tutor interactivo</p>
        </header>

        <main className="space-y-6">
          <div className="text-center p-8 bg-primary-50 rounded-xl">
            <div className="text-6xl mb-4">{isListening ? '🎤' : isSpeaking ? '🔊' : '🎯'}</div>
            <p className="text-lg font-medium text-primary-800">
              {currentState === 'EXPLICACION' ? 'Escuchando...' : null}
              {currentState === 'PREGUNTA' ? '¿Qué quieres aprender?' : null}
              {currentState === 'EVALUACION' ? 'Evaluando...' : null}
            </p>
          </div>

          <div className="flex justify-center gap-4">
            <button
              className="px-6 py-3 bg-primary-600 text-white rounded-full font-medium
                         hover:bg-primary-700 transition-colors disabled:opacity-50"
              disabled={isListening || isSpeaking}
            >
              {isListening ? 'Escuchando...' : 'Hablar'}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;

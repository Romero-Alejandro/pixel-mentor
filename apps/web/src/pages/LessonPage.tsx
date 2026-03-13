import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';
import { useLessonStore } from '../stores/lessonStore';
import { type PedagogicalState } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import { useStartLesson, useLessonInteraction } from '../hooks/useLessonQueries';

import { Mascot } from '@/components/mascot/Mascot';

interface Message {
  role: 'tutor' | 'student';
  text: string;
}

const STATE_LABELS: Record<PedagogicalState, string> = {
  ACTIVE_CLASS: 'Hablando',
  RESOLVING_DOUBT: 'Pensando',
  EXPLANATION: 'Explicando',
  QUESTION: 'Preguntando',
  EVALUATION: 'Revisando',
};

export function LessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const { user } = useAuthStore();
  const {
    currentState,
    setCurrentState,
    setIsSpeaking: setGlobalIsSpeaking,
    setIsListening: setGlobalIsListening,
  } = useLessonStore();
  const {
    isSpeaking,
    isListening,
    transcript,
    error: speechError,
    speak,
    startListening,
    stopListening,
    clearTranscript,
    stopSpeaking,
  } = useSpeech();
  const { mutateAsync: startLesson, isPending: isStarting } = useStartLesson();
  const { mutateAsync: interactWithLesson, isPending: isInteracting } = useLessonInteraction();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const isProcessing = isStarting || isInteracting;

  useEffect(() => {
    setGlobalIsSpeaking(isSpeaking);
  }, [isSpeaking, setGlobalIsSpeaking]);

  useEffect(() => {
    setGlobalIsListening(isListening);
  }, [isListening, setGlobalIsListening]);

  useEffect(() => {
    if (transcript) {
      setInputText(transcript);
      clearTranscript();
    }
  }, [transcript, clearTranscript]);

  useEffect(() => {
    if (!lessonId || !user) return;
    let mounted = true;

    const initLesson = async () => {
      setActionError(null);
      try {
        const response = await startLesson(lessonId);
        if (!mounted) return;
        setSessionId(response.sessionId);
        setCurrentState(response.pedagogicalState);
        setConversation([{ role: 'tutor', text: response.voiceText }]);
        speak(response.voiceText);
      } catch (err) {
        if (mounted) {
          setActionError(err instanceof Error ? err.message : 'No pudimos conectar.');
        }
      }
    };

    initLesson();

    return () => {
      mounted = false;
      stopSpeaking();
      useLessonStore.getState().reset();
    };
  }, [lessonId, user, startLesson, setCurrentState, speak, stopSpeaking]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleSend = async () => {
    if (!inputText.trim() || !sessionId) return;
    const userText = inputText;
    setInputText('');
    setConversation((prev) => [...prev, { role: 'student', text: userText }]);
    stopSpeaking();
    setActionError(null);
    try {
      const response = await interactWithLesson({ sessionId, input: userText });
      setCurrentState(response.pedagogicalState);
      setConversation((prev) => [...prev, { role: 'tutor', text: response.voiceText }]);
      if (response.sessionCompleted) {
        setIsSessionComplete(true);
      }
      speak(response.voiceText);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Error al enviar mensaje.');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isStarting && !sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50">
        <div className="text-center">
          <div className="text-6xl animate-bounce mb-6">🚀</div>
          <p className="text-xl font-black text-sky-600">Preparando la nave...</p>
        </div>
      </div>
    );
  }

  const lastTutorMessage = conversation.filter((m) => m.role === 'tutor').pop();

  return (
    <div className="min-h-screen bg-sky-50 font-sans flex flex-col text-slate-800">
      <header className="bg-white border-b-2 border-sky-100 h-20 flex items-center px-6 shrink-0 relative z-10">
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <Link
            to="/dashboard"
            className="w-12 h-12 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-sky-100 hover:text-sky-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <div className="flex items-center gap-3 bg-white border-2 border-sky-100 px-5 py-2.5 rounded-full shadow-sm">
            <div
              className={`w-3 h-3 rounded-full ${currentState === 'ACTIVE_CLASS' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`}
            ></div>
            <span className="text-sm font-bold text-slate-700">
              {STATE_LABELS[currentState] || 'Listo'}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 min-h-0">
        <section className="w-full lg:w-5/12 flex flex-col bg-white rounded-3xl border-2 border-sky-100 shadow-sm overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-b from-sky-50 to-white pointer-events-none"></div>

          <div className="flex-1 flex flex-col justify-center items-center p-8 relative z-10">
            <Mascot />
          </div>

          <div className="p-6 bg-white relative z-10">
            <div className="bg-sky-50 border-2 border-sky-100 rounded-2xl p-6 relative">
              <div className="absolute -top-3 left-8 w-6 h-6 bg-sky-50 border-t-2 border-l-2 border-sky-100 transform rotate-45"></div>
              <p className="text-lg text-slate-700 font-bold leading-relaxed relative z-10">
                {lastTutorMessage ? lastTutorMessage.text : '¡Hola!'}
              </p>
            </div>
          </div>
        </section>

        <section className="w-full lg:w-7/12 flex flex-col bg-white rounded-3xl border-2 border-sky-100 shadow-sm min-h-[500px]">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {actionError || speechError ? (
              <div className="p-4 bg-rose-50 border-2 border-rose-100 text-rose-600 font-bold rounded-2xl">
                {actionError || speechError}
              </div>
            ) : null}

            {conversation.map((message, index) => (
              <div
                key={index}
                className={`flex w-full ${message.role === 'student' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-5 rounded-3xl text-base font-medium leading-relaxed ${
                    message.role === 'student'
                      ? 'bg-sky-500 text-white rounded-tr-sm shadow-md'
                      : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
            <div ref={conversationEndRef} />
          </div>

          <div className="p-4 sm:p-6 bg-white border-t-2 border-sky-50 rounded-b-3xl">
            {isSessionComplete ? (
              <Link
                to="/mission-report"
                state={{
                  stats: {
                    xpEarned: conversation.length * 15,
                    accuracy: 100,
                    conceptsMastered: ['Hablar Claro', 'Escuchar'],
                  },
                }}
                className="w-full flex items-center justify-center py-4 bg-emerald-500 text-white text-lg font-black rounded-2xl hover:bg-emerald-600 transition-colors shadow-md hover:-translate-y-1 transform"
              >
                ¡Ver mis estrellas! ⭐
              </Link>
            ) : (
              <div className="flex gap-4">
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing || isSpeaking}
                  className={`w-16 h-16 shrink-0 flex items-center justify-center rounded-2xl transition-all ${
                    isListening
                      ? 'bg-rose-500 text-white shadow-lg scale-105'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  } disabled:opacity-50`}
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe aquí..."
                    disabled={isProcessing || isSessionComplete}
                    className="w-full h-16 pl-6 pr-16 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg font-medium focus:border-sky-400 focus:bg-white focus:outline-none transition-all disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || isProcessing}
                    className="absolute right-2 top-2 bottom-2 aspect-square bg-sky-500 text-white rounded-xl flex items-center justify-center hover:bg-sky-600 disabled:opacity-50 transition-colors shadow-sm"
                  >
                    <svg
                      className="w-6 h-6 ml-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

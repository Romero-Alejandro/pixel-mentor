import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';

import { api, type Session, type PedagogicalState } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';

const STATE_LABELS: Record<string, string> = {
  ACTIVE_CLASS: 'SYS_ACTIVE',
  RESOLVING_DOUBT: 'SYS_ANALYSIS',
  CLARIFYING: 'SYS_CLARIFY',
  QUESTION: 'SYS_QUERY',
  EVALUATION: 'SYS_EVAL',
  EXPLANATION: 'SYS_EXPLAIN',
  COMPLETED: 'SYS_DONE',
};

interface Message {
  role: 'tutor' | 'student';
  text: string;
}

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [conversation, setConversation] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const { isSpeaking, speak, stopSpeaking } = useSpeech();

  useEffect(() => {
    if (!sessionId) return;
    const fetchSession = async () => {
      try {
        const data = await api.getSession(sessionId);
        setSession(data);
        setSessionCompleted(data.status === 'completed' || data.status === 'escalated');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error en enlace de sesión.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSession();
  }, [sessionId]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView();
  }, [conversation]);

  const handleSend = async () => {
    if (!inputText.trim() || !sessionId) return;
    const userText = inputText;
    setInputText('');
    setConversation((prev) => [...prev, { role: 'student', text: userText }]);
    stopSpeaking();
    setIsProcessing(true);
    setError(null);
    try {
      const response = await api.interactWithLesson(sessionId, userText);
      setConversation((prev) => [...prev, { role: 'tutor', text: response.voiceText }]);
      if (response.sessionCompleted) {
        setSessionCompleted(true);
        if (sessionId) {
          const updated = await api.getSession(sessionId);
          setSession(updated);
        }
      }
      speak(response.voiceText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fallo en transmisión.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = async () => {
    if (!sessionId) return;
    if (!confirm('Confirmar reinicio de sesión. Datos volátiles se perderán.')) return;
    setIsProcessing(true);
    try {
      const data = await api.resetSession(sessionId);
      setSession(data);
      setConversation([]);
      setSessionCompleted(data.status === 'completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al reiniciar núcleo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const currentState: PedagogicalState = session?.stateCheckpoint?.currentState || 'ACTIVE_CLASS';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center font-mono text-sm text-slate-500 uppercase tracking-widest">
          Leyendo archivo histórico...
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <p className="text-slate-900 font-medium text-sm mb-4">
            {error || 'Archivo no localizado.'}
          </p>
          <Link
            to="/dashboard"
            className="text-slate-500 text-sm hover:text-slate-900 transition-colors"
          >
            Volver al Terminal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col text-slate-900">
      <header className="bg-white border-b border-slate-200 h-14 flex items-center px-6 shrink-0">
        <div className="flex-1 flex items-center">
          <Link
            to="/dashboard"
            className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            ← Terminal
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${currentState === 'ACTIVE_CLASS' ? 'bg-emerald-500' : 'bg-slate-400'}`}
            ></div>
            <span className="text-xs font-mono text-slate-600 uppercase tracking-wider">
              {STATE_LABELS[currentState] || 'SYS_ARCHIVE'}
            </span>
          </div>
          <div className="w-px h-4 bg-slate-200"></div>
          <button
            onClick={handleReset}
            disabled={isProcessing}
            className="text-xs font-mono text-slate-500 hover:text-slate-900 transition-colors disabled:opacity-50"
          >
            [ PURGAR ]
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <section className="w-full lg:w-1/3 bg-slate-950 flex flex-col relative border-r border-slate-800">
          <div className="flex-1 flex flex-col justify-center items-center p-8 text-center text-slate-500 font-mono text-sm uppercase tracking-widest">
            <div className="w-16 h-16 border border-slate-800 rounded flex items-center justify-center mb-6 bg-slate-900">
              SYS
            </div>
            Visualización Deshabilitada
          </div>
        </section>

        <section className="flex-1 flex flex-col bg-white min-h-0">
          <div className="h-12 border-b border-slate-100 bg-slate-50 px-6 flex justify-between items-center shrink-0">
            <h3 className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
              Archivo de Telemetría
            </h3>
            {sessionCompleted ? (
              <span className="text-xs font-mono text-emerald-600 border border-emerald-200 bg-emerald-50 px-2 py-0.5 rounded-sm">
                COMPLETADO
              </span>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error ? (
              <div className="p-3 border border-red-200 bg-red-50 text-red-700 text-sm rounded-md">
                {error}
              </div>
            ) : null}
            {conversation.length === 0 ? (
              <div className="text-sm text-slate-400 font-mono">
                Fin del archivo. Esperando entrada...
              </div>
            ) : (
              conversation.map((message, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${message.role === 'student' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] font-mono text-slate-400 mb-1 uppercase tracking-widest">
                    {message.role === 'student' ? 'Operador' : 'Sistema'}
                  </span>
                  <div
                    className={`max-w-[85%] p-4 rounded-md text-sm leading-relaxed ${
                      message.role === 'student'
                        ? 'bg-slate-50 border border-slate-200 text-slate-900'
                        : 'bg-white border border-slate-100 shadow-sm text-slate-800'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))
            )}
            <div ref={conversationEndRef} />
          </div>

          <div className="p-6 border-t border-slate-100 bg-white shrink-0">
            {sessionCompleted ? (
              <Link
                to="/mission-report"
                state={{
                  stats: {
                    xpEarned: conversation.length * 15,
                    accuracy: 100,
                    conceptsMastered: ['Análisis Histórico'],
                  },
                }}
                className="w-full flex items-center justify-center py-3 bg-slate-900 text-white text-sm font-medium rounded-md hover:bg-slate-800 transition-colors"
              >
                Acceder al Reporte Final
              </Link>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={isSpeaking ? stopSpeaking : () => {}}
                  disabled={!isSpeaking}
                  className="w-12 h-12 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                >
                  <div
                    className={`w-3 h-3 rounded-full ${isSpeaking ? 'bg-amber-500 animate-pulse' : 'bg-slate-300'}`}
                  ></div>
                </button>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escriba instrucción..."
                    disabled={isProcessing || sessionCompleted}
                    className="w-full h-12 pl-4 pr-12 bg-slate-50 border border-slate-200 rounded-md text-sm focus:border-slate-400 focus:bg-white focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || isProcessing || sessionCompleted}
                    className="absolute right-2 top-2 bottom-2 w-8 flex items-center justify-center text-slate-400 hover:text-slate-900 disabled:opacity-50 transition-colors"
                  >
                    →
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

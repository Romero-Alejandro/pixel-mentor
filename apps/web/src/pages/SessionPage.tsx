import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { IconArrowLeft, IconRefresh, IconCheck, IconRobotFace } from '@tabler/icons-react';

import { Button, Card, Badge, Spinner } from '@/components/ui';
import { VoiceSettingsPanel } from '@/components/voice-settings/VoiceSettingsPanel';
import { SessionGamificationBar } from '@/components/gamification/SessionGamificationBar';
import { ChatMessage } from '@/features/session/components/ChatMessage';
import { ChatInput } from '@/features/session/components/ChatInput';
import { useGamificationStore } from '@/stores/gamification.store';
import { useSessionLogic } from '@/hooks/useSessionLogic';
import { useVoiceSettings } from '@/components/voice-settings/useVoiceSettings';

const STATE_LABELS: Record<string, string> = {
  IDLE: 'Inactivo',
  ACTIVE: 'Activo',
  PAUSED_FOR_QUESTION: 'Pregunta',
  AWAITING_CONFIRMATION: 'Esperando',
  PAUSED_IDLE: 'Pausado',
  COMPLETED: 'Completado',
  ESCALATED: 'Escalado',
  ACTIVE_CLASS: 'En clase',
  RESOLVING_DOUBT: 'Analizando',
  CLARIFYING: 'Aclarando',
  QUESTION: 'Pregunta',
  EVALUATION: 'Evaluando',
  EXPLANATION: 'Explicando',
};

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { settings: voiceSettings, updateSettings } = useVoiceSettings();
  const conversationEndRef = useRef<HTMLDivElement>(null);

  const {
    session,
    isLoading,
    error,
    inputText,
    setInputText,
    conversation,
    isProcessing,
    sessionCompleted,
    isSpeaking,
    stopSpeaking,
    handleSend,
    handleReset,
    handlePreviewVoice,
    currentState,
  } = useSessionLogic(sessionId, voiceSettings);

  const { profile: gamificationProfile, fetchProfile: fetchGamificationProfile } =
    useGamificationStore();

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  useEffect(() => {
    if (session?.studentId) fetchGamificationProfile().catch(() => {});
  }, [session?.studentId, fetchGamificationProfile]);

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-sky-50">
        <Spinner size="lg" className="text-sky-500 mb-6" />
        <p className="text-sky-800 font-black animate-pulse uppercase tracking-widest">
          Preparando Sesión...
        </p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-50 p-6">
        <Card
          variant="locked"
          className="text-center p-8 bg-white border-4 border-rose-200 shadow-[0_8px_0_0_#fecdd3] rounded-[2rem] max-w-sm w-full"
        >
          <p className="text-rose-800 font-black text-xl mb-6">
            {error || 'Sesión no encontrada.'}
          </p>
          <Link to="/dashboard" className="block outline-none">
            <Button className="w-full bg-rose-500 border-rose-600 shadow-[0_4px_0_0_#e11d48] hover:bg-rose-400">
              <IconArrowLeft className="w-5 h-5 mr-2" /> Volver al inicio
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-50 font-sans flex flex-col text-slate-800">
      <header className="bg-white/90 backdrop-blur-md border-b-4 border-sky-200 h-20 flex items-center px-4 sm:px-6 shrink-0 sticky top-0 z-50 shadow-sm">
        <div className="flex-1 flex items-center">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-2xl border-4 border-transparent hover:border-slate-200 hover:bg-slate-50 text-sm font-black text-slate-500 hover:text-slate-700 transition-all outline-none group"
          >
            <IconArrowLeft
              className="w-5 h-5 transition-transform group-hover:-translate-x-1"
              stroke={3}
            />
            <span className="hidden sm:block uppercase tracking-wider">Salir</span>
          </Link>
        </div>

        {gamificationProfile ? (
          <SessionGamificationBar profile={gamificationProfile} className="hidden lg:flex" />
        ) : null}

        <div className="flex items-center gap-4 ml-4">
          <VoiceSettingsPanel
            settings={voiceSettings}
            onSettingsChange={updateSettings}
            onPreview={handlePreviewVoice}
          />
          <div className="w-1 h-8 bg-slate-200 rounded-full hidden sm:block" />

          <div className="hidden sm:flex items-center gap-2 bg-slate-100 border-2 border-slate-200 px-3 py-1.5 rounded-xl">
            <div
              className={`w-3 h-3 rounded-full ${currentState === 'ACTIVE_CLASS' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`}
            />
            <span className="text-xs font-black text-slate-600 uppercase tracking-wider">
              {STATE_LABELS[currentState] || 'Sesión'}
            </span>
          </div>

          <button
            onClick={handleReset}
            disabled={isProcessing}
            className="p-2 sm:px-4 sm:py-2 rounded-xl border-4 border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 font-black text-xs uppercase tracking-wider transition-all active:translate-y-1 outline-none flex items-center gap-2"
          >
            <IconRefresh className="w-5 h-5" stroke={3} />
            <span className="hidden sm:block">Reiniciar</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row p-4 sm:p-6 lg:p-8 gap-6 max-w-[1600px] mx-auto w-full min-h-0">
        {/* Tutor Window (Visualizer) */}
        <section className="w-full lg:w-1/3 bg-gradient-to-b from-sky-400 to-blue-600 rounded-[2.5rem] flex flex-col relative border-4 border-sky-700 shadow-[0_8px_0_0_#0369a1] overflow-hidden min-h-[250px] lg:min-h-0">
          <div className="absolute inset-0 bg-white/10 blur-2xl rounded-full scale-150 translate-x-1/4 -translate-y-1/4 pointer-events-none" />
          <div className="flex-1 flex flex-col justify-center items-center p-8 text-center text-white relative z-10">
            <div
              className={`w-32 h-32 rounded-[2rem] flex items-center justify-center mb-6 bg-white/20 border-4 border-white/40 shadow-xl backdrop-blur-sm transition-transform duration-700 ${isSpeaking ? 'scale-110' : 'scale-100'}`}
            >
              <IconRobotFace
                className={`w-20 h-20 text-white ${isSpeaking ? 'animate-bounce' : ''}`}
                stroke={2}
              />
            </div>
            <p className="text-lg font-black tracking-wide drop-shadow-md">
              {isSpeaking ? 'El tutor está hablando...' : 'El tutor te escucha'}
            </p>
          </div>
        </section>

        {/* Chat Interface */}
        <section className="flex-1 flex flex-col bg-white rounded-[2.5rem] border-4 border-slate-200 shadow-[0_8px_0_0_#e2e8f0] min-h-[500px]">
          <div className="h-16 border-b-4 border-slate-100 bg-slate-50 px-6 sm:px-8 flex justify-between items-center shrink-0 rounded-t-[2rem]">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">
              Chat de Aprendizaje
            </h3>
            {sessionCompleted ? (
              <Badge variant="success" className="animate-bounce-in border-2">
                <IconCheck className="w-4 h-4 mr-1" stroke={3} /> Misión Completada
              </Badge>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar bg-[url('/pattern-dots.svg')] bg-repeat opacity-95">
            {error ? (
              <div className="p-4 bg-rose-50 border-4 border-rose-200 text-rose-700 font-bold text-sm rounded-2xl animate-bounce-in shadow-sm">
                {error}
              </div>
            ) : null}

            {conversation.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                <IconRobotFace className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-lg font-black text-slate-400">
                  ¡Saluda a tu tutor para empezar!
                </p>
              </div>
            ) : (
              conversation.map((message, index) => <ChatMessage key={index} message={message} />)
            )}
            <div ref={conversationEndRef} className="h-4" />
          </div>

          {sessionCompleted ? (
            <div className="p-6 border-t-4 border-slate-100 bg-emerald-50 rounded-b-[2rem]">
              <Link
                to="/mission-report"
                state={{ sessionId: session.id }}
                className="block outline-none"
              >
                <Button className="w-full py-4 text-lg bg-emerald-500 border-4 border-emerald-600 shadow-[0_6px_0_0_#059669] hover:bg-emerald-400 hover:shadow-[0_8px_0_0_#059669] text-white font-black uppercase tracking-wider">
                  <IconCheck className="w-6 h-6 mr-2" stroke={3} /> Ver Reporte Final
                </Button>
              </Link>
            </div>
          ) : (
            <ChatInput
              inputText={inputText}
              setInputText={setInputText}
              onSend={handleSend}
              onKeyPress={handleKeyPress}
              isProcessing={isProcessing}
              isSpeaking={isSpeaking}
              stopSpeaking={stopSpeaking}
              sessionCompleted={sessionCompleted}
            />
          )}
        </section>
      </main>
    </div>
  );
}

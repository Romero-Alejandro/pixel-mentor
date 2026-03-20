import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  IconArrowLeft,
  IconRefresh,
  IconPlayerPause,
  IconSend,
  IconCheck,
} from '@tabler/icons-react';

import { Button, Card, Badge, Spinner } from '../components/ui';

import { VoiceSettingsPanel } from '@/components/voice-settings/VoiceSettingsPanel';
import { SessionGamificationBar } from '@/components/gamification/SessionGamificationBar';
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
    if (session?.studentId) {
      fetchGamificationProfile().catch(() => {});
    }
  }, [session?.studentId, fetchGamificationProfile]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4 text-sky-500" />
          <p className="text-slate-500 font-medium">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card variant="outlined" className="text-center p-8">
          <p className="text-slate-800 font-medium mb-4">{error || 'Sesión no encontrada.'}</p>
          <Link
            to="/dashboard"
            className="text-sky-600 hover:text-sky-700 font-medium transition-colors"
          >
            Volver al inicio
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col text-slate-900">
      <header className="bg-white border-b border-slate-200 h-14 flex items-center px-4 sm:px-6 shrink-0">
        <div className="flex-1 flex items-center">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <IconArrowLeft className="w-4 h-4" />
            <span>Volver</span>
          </Link>
        </div>
        {gamificationProfile ? <SessionGamificationBar profile={gamificationProfile} /> : null}
        <div className="flex items-center gap-4">
          <VoiceSettingsPanel
            settings={voiceSettings}
            onSettingsChange={updateSettings}
            onPreview={handlePreviewVoice}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                currentState === 'ACTIVE_CLASS' ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            <span className="text-xs font-medium text-slate-600 uppercase tracking-wider">
              {STATE_LABELS[currentState] || 'Archivo'}
            </span>
          </div>
          <div className="w-px h-4 bg-slate-200" />
          <button
            onClick={handleReset}
            disabled={isProcessing}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <IconRefresh className="w-3 h-3" />
            Reiniciar
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row min-h-0">
        <section className="w-full lg:w-1/3 bg-slate-900 flex flex-col relative border-r border-slate-800">
          <div className="flex-1 flex flex-col justify-center items-center p-8 text-center text-slate-500">
            <div className="w-16 h-16 border border-slate-700 rounded flex items-center justify-center mb-6 bg-slate-800">
              <span className="text-2xl">🎓</span>
            </div>
            <p className="text-sm">Visualización no disponible</p>
          </div>
        </section>

        <section className="flex-1 flex flex-col bg-white min-h-0">
          <div className="h-12 border-b border-slate-100 bg-slate-50 px-6 flex justify-between items-center shrink-0">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Historial de la Sesión
            </h3>
            {sessionCompleted ? (
              <Badge variant="success">
                <IconCheck className="w-3 h-3 mr-1" />
                Completado
              </Badge>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {error ? (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl">
                {error}
              </div>
            ) : null}
            {conversation.length === 0 ? (
              <div className="text-sm text-slate-400">
                Sin mensajes. ¡Envía tu primera respuesta!
              </div>
            ) : (
              conversation.map((message, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${message.role === 'student' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-widest">
                    {message.role === 'student' ? 'Tú' : 'Tutor'}
                  </span>
                  <div
                    className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${
                      message.role === 'student'
                        ? 'bg-sky-500 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))
            )}
            <div ref={conversationEndRef} />
          </div>

          <div className="p-4 border-t border-slate-100 bg-white shrink-0">
            {sessionCompleted ? (
              <Link to="/mission-report" state={{ sessionId: session.id }}>
                <Button className="w-full" size="lg">
                  <IconCheck className="w-5 h-5 mr-2" />
                  Ver Reporte Final
                </Button>
              </Link>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={() => (isSpeaking ? stopSpeaking() : null)}
                  disabled={!isSpeaking}
                  className="w-12 h-12 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                  aria-label={isSpeaking ? 'Detener' : 'Reproducir'}
                >
                  <IconPlayerPause
                    className={`w-5 h-5 ${isSpeaking ? 'text-red-500' : 'text-slate-300'}`}
                  />
                </button>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Escribe tu respuesta..."
                    disabled={isProcessing || sessionCompleted}
                    className="w-full h-12 pl-4 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-sky-400 focus:bg-white focus:outline-none transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!inputText.trim() || isProcessing || sessionCompleted}
                    className="absolute right-2 top-2 bottom-2 w-8 flex items-center justify-center text-sky-500 hover:text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Enviar"
                  >
                    {isProcessing ? <Spinner size="sm" /> : <IconSend className="w-5 h-5" />}
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

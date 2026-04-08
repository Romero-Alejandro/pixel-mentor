/**
 * LongTextTestPage — renders the ConcentrationPanel with very long text for E2E testing.
 *
 * This page is used by Playwright E2E tests to verify that long text (>5000 chars)
 * is displayed without truncation and that TTS can stream it using the real backend.
 * The TTS endpoint is publicly accessible in E2E mode (no auth required).
 */
import { useEffect } from 'react';

import { useVoice } from '@/features/voice/hooks/useVoice';
import { useVoiceSettings } from '@/features/voice/hooks/useVoiceSettings';
import { useVoiceSettingsSync } from '@/features/lesson/hooks/useClassOrchestrator';
import { ConcentrationPanel } from '@/features/lesson/components/ConcentrationPanel';
import { Button } from '@/components/ui';

// Generate a long text (~6000+ characters)
const generateLongText = (): string => {
  const base = `
Aprendamos sobre la naturaleza. La naturaleza es el conjunto de todo lo que existe en el universo que no ha sido creado por el ser humano. Esto incluye plantas, animales, montañas, ríos, océanos, el cielo, el clima, y todos los fenómenos naturales. La naturaleza nos proporciona aire limpio, agua dulce, alimentos, medicinas, y materiales para construir nuestras casas. Además, la naturaleza es fundamental para nuestro bienestar emocional y espiritual; muchas personas encuentran paz y inspiración en entornos naturales.

Los ecosistemas son comunidades de seres vivos que interactúan entre sí y con su entorno. Cada ecosistema tiene sus propias características, como el tipo de clima, la clase de suelo, y las especies que lo habitan. Algunos ejemplos de ecosistemas son los bosques tropicales, los desiertos, los océanos, los lagos, y las praderas. Es importante proteger estos ecosistemas porque están interconectados; un cambio en uno puede afectar a otros.

La biodiversidad se refiere a la variedad de vida en la Tierra. Incluye la diversidad de especies, la diversidad genética dentro de cada especie, y la diversidad de ecosistemas. Alta biodiversidad significa que hay muchos tipos diferentes de plantas, animales, microorganismos, y que estos pueden adaptarse a cambios ambientales. La pérdida de biodiversidad es un problema grave porque debilita los ecosistemas y reduce su capacidad para proporcionar servicios esenciales como la polinización de cultivos, la purificación del agua, y la regulación del clima.

El cambio climático es uno de los mayores desafíos que enfrenta la naturaleza hoy en día. Las actividades humanas, especialmente la quema de combustibles fósiles (carbón, petróleo, gas), están aumentando las concentraciones de gases de efecto invernadero en la atmósfera. Esto atrapa calor y eleva la temperatura global. Los efectos incluyen derretimiento de glaciares, aumento del nivel del mar, fenómenos meteorológicos más extremos (huracanes, sequías, inundaciones), y cambios en los patrones de lluvia. Para combatir el cambio climático, necesitamos reducir las emisiones, transitar a energías renovables (solar, eólica, hidroeléctrica), y proteger los bosques que absorben CO2.

La conservación de la naturaleza requiere acciones a múltiples niveles. A nivel individual, podemos reducir nuestro consumo de recursos, reciclar, usar transporte sostenible, y apoyar productos ecológicos. A nivel comunitario, podemos crear zonas verdes, participar en limpiezas de ríos, y educar a otros. A nivel gubernamental, se necesitan leyes que protejan áreas naturales, regulen la contaminación, y promuevan un desarrollo sostenible. Las organizaciones internacionales también juegan un papel crucial coordinando esfuerzos globales.

La educación ambiental es clave para fomentar una relación más respetuosa con la naturaleza. Cuando las personas comprenden la importancia de la naturaleza y los riesgos que enfrenta, es más probable que adopten comportamientos responsables. Las escuelas, los medios de comunicación, y los líderes comunitarios pueden ayudar a difundir este conocimiento. Además, es importante reconocer y respetar el conocimiento tradicional de los pueblos indígenas, que han vivido en armonía con la naturaleza durante siglos.

En resumen, la naturaleza es nuestro hogar y nuestra supervivencia depende de ella. Debemos actuar ahora para protegerla, no solo por nosotros mismos, sino por las generaciones futuras. Cada pequeño esfuerzo cuenta, y juntos podemos marcar la diferencia.
`;
  // Repeat to reach >6000 characters (4 repeats gives ~6-8k)
  const repeated = base.repeat(4);
  return repeated.trim();
};

const LONG_TEXT = generateLongText();

export function LongTextTestPage() {
  const { settings: voiceSettings } = useVoiceSettings();
  const { speak, isSpeaking, stopSpeaking } = useVoice();

  // Sync voice settings to the orchestrator context
  useVoiceSettingsSync(voiceSettings);

  const handleSpeak = () => {
    speak(LONG_TEXT, {
      character: 'person',
      languageCode: 'es-AR',
      speakingRate: 1.0,
      pitch: 0,
    }).catch((e) => {
      console.error('TTS speak error:', e);
    });
  };

  const handleStop = () => {
    stopSpeaking();
  };

  // Auto-start TTS on mount after a short delay
  useEffect(() => {
    const timeout = setTimeout(() => {
      handleSpeak();
    }, 1000);
    return () => clearTimeout(timeout);
  }, [speak]);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Long Text Test Page</h1>

      <div className="mb-4 flex gap-4">
        <Button onClick={handleSpeak} disabled={isSpeaking} variant="primary">
          {isSpeaking ? 'Reproduciendo...' : 'Iniciar TTS'}
        </Button>
        {isSpeaking ? (
          <Button onClick={handleStop} variant="secondary">
            Detener
          </Button>
        ) : null}
      </div>

      {/* TTS status indicators required by tests */}
      {isSpeaking ? (
        <div className="mb-4">
          <span
            role="status"
            aria-label="Escuchando"
            className="block text-sm font-bold text-emerald-600"
          >
            Escuchando
          </span>
          <span aria-hidden="true" className="text-sm text-slate-600">
            Tu tutor está hablando
          </span>
        </div>
      ) : null}

      <div className="bg-white rounded-3xl border border-sky-100 shadow-md p-6 max-h-[70vh] overflow-y-auto">
        <ConcentrationPanel
          fullVoiceText={LONG_TEXT}
          transitionText=""
          contentText={LONG_TEXT}
          closureText=""
          currentWordIndex={0}
          isSynced={true}
          isSpeaking={isSpeaking}
          onRepeat={handleSpeak}
        />
      </div>

      {/* Button to trigger repeat (same aria-label as expected) */}
      <div className="mt-4">
        <Button
          onClick={handleSpeak}
          disabled={isSpeaking}
          aria-label="repetir explicación"
          variant="secondary"
        >
          Repetir explicación
        </Button>
      </div>

      <p className="mt-4 text-sm text-slate-500">Caracteres del texto: {LONG_TEXT.length}</p>
    </div>
  );
}

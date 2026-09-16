import {
  PRAGMATIC_STATUS,
  type PragmaticStatus,
  type Discrepancy,
  type PragmaticModuleData,
  type ClinicalReport,
  createDiscrepancy,
  createPragmaticModule,
  createClinicalReport,
} from '@/features/clinical/domain/entities/clinical-report.entity.js';
import type { Session } from '@/features/session/domain/entities/session.entity.js';
import type { Recipe } from '@/features/recipe/domain/entities/recipe.entity.js';

interface PairConfig {
  par: string;
  a: string;
  b: string;
  cv05: number;
  cv15: number;
}

const PAIRS: readonly PairConfig[] = [
  { par: 'ILR-ILE', a: 'ILR', b: 'ILE', cv05: 11, cv15: 8 },
  { par: 'ICL-IEL', a: 'ICL', b: 'IEL', cv05: 10, cv15: 8 },
  { par: 'IMT-IVP', a: 'IMT', b: 'IVP', cv05: 12, cv15: 9 },
  { par: 'ICV-IMT', a: 'ICV', b: 'IMT', cv05: 11, cv15: 8 },
] as const;

const LABELS: readonly string[] = ['ILR', 'ILE', 'ICL', 'IEL', 'IMT', 'IVP', 'ICV'] as const;

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * ⚠️ PLACEHOLDER / SIMULACIÓN — NO constituye una evaluación clínica real.
 *
 * Los 7 puntajes de escala (ILR, ILE, ICL, IEL, IMT, IVP, ICV) no miden
 * desempeño del estudiante: se derivan de un hash determinista de
 * (sessionId, userId) pasado por un RNG (mulberry32), con un ajuste cosmético
 * de -2 por intento fallido y recortes a rangos fijos. Las discrepancias y el
 * módulo pragmático aplican umbrales reales (valores críticos .05/.15) sobre
 * esos números fabricados — la significancia estadística es rigurosa, los
 * datos de entrada no.
 *
 * Contrato: todo consumidor DEBE exponer `clinicalReportSimulated: true` en
 * el payload (ver MissionReport en gamification.routes.ts) y la UI debe
 * mostrar el aviso de simulación (MissionReportPage).
 *
 * Reemplazo real (pendiente de decisión de producto): derivar cada escala de
 * activity_attempts / event_logs (accuracy por tipo de atom, intentos, uso de
 * pistas, tiempos) con validación clínica de las fórmulas.
 */
export class ClinicalCalculatorService {
  calculate(session: Session, _recipe: Recipe, userId: string): ClinicalReport {
    const failedAttempts = session.failedAttempts ?? session.stateCheckpoint.failedAttempts ?? 0;
    const totalWrongAnswers = session.stateCheckpoint.totalWrongAnswers ?? 0;
    const questionCount = session.stateCheckpoint.questionCount ?? 0;

    const seedBase = hashString(`${session.id}:${userId}`);

    const scores = new Map<string, number>();

    for (const label of LABELS) {
      const labelHash = hashString(`${seedBase}:${label}`);
      const labelRng = mulberry32(labelHash);
      const rand = labelRng();
      const base = 50 + rand * 20;
      const adjusted = base - failedAttempts * 2;
      const clamped = clamp(Math.round(adjusted), 40, 85);
      const withRange = clamp(clamped, 45, 80);
      const finalScore = ((): number => {
        const altRand = mulberry32(labelHash + 7919)();
        const wideBase = 45 + altRand * 35 - failedAttempts * 2;
        const blended = Math.round((clamped + Math.round(wideBase)) / 2);
        return clamp(blended, 40, 85);
      })();
      scores.set(label, withRange > 0 ? finalScore : withRange);
    }

    const discrepancies: Discrepancy[] = PAIRS.map((pair) => {
      const scoreA = scores.get(pair.a) ?? 50;
      const scoreB = scores.get(pair.b) ?? 50;
      const difference = Math.abs(scoreA - scoreB);
      const formula = `|${scoreA} - ${scoreB}| = ${difference}`;
      const alpha05 = { isSignificant: difference >= pair.cv05, cv: pair.cv05 };
      const alpha15 = { isSignificant: difference >= pair.cv15, cv: pair.cv15 };
      const prevalence = clamp(Math.round(50 * Math.exp(-0.12 * difference) * 10) / 10, 0.1, 50);

      const isSignificant = alpha05.isSignificant || alpha15.isSignificant;
      const threshold = alpha05.isSignificant ? pair.cv05 : pair.cv15;
      const pLevel: '.05' | '.15' | undefined = !isSignificant
        ? '.15'
        : alpha05.isSignificant
          ? '.05'
          : '.15';

      const interpretation = {
        isSignificant,
        threshold,
        pLevel,
      };

      return createDiscrepancy({
        par: pair.par,
        formula,
        difference,
        alpha05,
        alpha15,
        prevalence,
        interpretation,
      });
    });

    const baseHash = seedBase % 3;
    const anomaliesObserved = Math.min(
      15,
      (failedAttempts ?? 0) + (totalWrongAnswers ?? 0) + (questionCount ?? 0) + baseHash + 5,
    );

    const threshold = 4;
    const scaleMax = 15;
    let status: PragmaticStatus = PRAGMATIC_STATUS.MEETS;
    if (anomaliesObserved > threshold) status = PRAGMATIC_STATUS.NOT_MEETS;
    else if (anomaliesObserved === threshold) status = PRAGMATIC_STATUS.BORDERLINE;

    const pragmaticModule: PragmaticModuleData = createPragmaticModule({
      anomaliesObserved,
      threshold,
      scaleMax,
      status,
    });

    return createClinicalReport({
      clinicalDiscrepancies: discrepancies,
      pragmaticModule,
    });
  }
}

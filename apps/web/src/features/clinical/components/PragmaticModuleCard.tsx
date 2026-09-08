import {
  IconBrain,
  IconMessage,
  IconAlertCircle,
  IconCircleCheck,
  IconInfoCircle,
  IconTrendingUp,
  IconEye,
  IconChevronRight,
  IconSparkles,
  IconAlertTriangle,
} from '@tabler/icons-react';

import { cn } from '@/utils/cn';
import type {
  PragmaticModuleCardProps,
  PragmaticModuleData,
  PragmaticStatus,
} from '@/features/clinical/types/clinical.types';
import { PRAGMATIC_STATUS } from '@/features/clinical/types/clinical.types';

// Intent: Clinician reviewing pragmatic language (VHP) — one glance must
// answer "does criterion hold?" plus how severe (11 vs threshold).
// Feel: calm diagnostic card with clear hierarchy — not flat text.
// Palette: rose = does NOT meet (alert), emerald = meets (reassuring),
//         amber = borderline (watch).
// Depth: white card, colored header wash, gummy shadow.
// Surfaces: page → card white → hero inset tinted → insight left-border.
// Typography: Quicksand hero number, tabular-nums.
// Spacing: 4px base, rounded-[1.5rem] / rounded-2xl.

const STATUS_CONFIG: Record<
  PragmaticStatus,
  {
    label: string;
    shortLabel: string;
    description: string;
    heroClass: string;
    pillClass: string;
    iconBg: string;
    gaugeClass: string;
    insightBorder: string;
    insightBg: string;
  }
> = {
  [PRAGMATIC_STATUS.MEETS]: {
    label: 'Cumple criterio',
    shortLabel: 'Cumple',
    description: 'El perfil pragmático se encuentra dentro del rango esperado.',
    heroClass: 'bg-emerald-50 border-emerald-200',
    pillClass: 'bg-emerald-500 text-white border-emerald-600 shadow-sm',
    iconBg: 'bg-emerald-500 text-white border-emerald-600',
    gaugeClass: 'bg-emerald-400',
    insightBorder: 'border-l-emerald-400',
    insightBg: 'bg-emerald-50/70',
  },
  [PRAGMATIC_STATUS.NOT_MEETS]: {
    label: 'No cumple criterio',
    shortLabel: 'No cumple',
    description: 'Se detectan dificultades pragmáticas por encima del umbral clínico.',
    heroClass: 'bg-rose-50 border-rose-200',
    pillClass: 'bg-rose-500 text-white border-rose-600 shadow-sm',
    iconBg: 'bg-rose-500 text-white border-rose-600',
    gaugeClass: 'bg-rose-400',
    insightBorder: 'border-l-rose-400',
    insightBg: 'bg-rose-50/70',
  },
  [PRAGMATIC_STATUS.BORDERLINE]: {
    label: 'Criterio límite',
    shortLabel: 'Límite',
    description: 'Puntuación en zona gris — valorar contexto y reevaluación.',
    heroClass: 'bg-amber-50 border-amber-200',
    pillClass: 'bg-amber-400 text-amber-900 border-amber-500 shadow-sm',
    iconBg: 'bg-amber-400 text-amber-900 border-amber-500',
    gaugeClass: 'bg-amber-400',
    insightBorder: 'border-l-amber-400',
    insightBg: 'bg-amber-50/70',
  },
};

function DotGauge({
  value,
  max,
  threshold,
  status,
}: {
  value: number;
  max: number;
  threshold: number;
  status: PragmaticStatus;
}) {
  const normalized = Math.min(max, Math.max(0, value));
  const pct = (normalized / max) * 100;
  const cfg = STATUS_CONFIG[status];
  // Build dots array
  const dots = Array.from({ length: max }, (_, i) => i < value);

  return (
    <div className="flex flex-col gap-2" role="img" aria-label={`${value} de ${max} anomalías`}>
      {/* Dots line */}
      <div className="flex flex-wrap gap-1.5" aria-hidden="true">
        {dots.map((filled, i) => (
          <span
            key={i}
            className={cn(
              'w-2.5 h-2.5 rounded-full border transition-colors',
              filled ? cn('border-transparent', cfg.gaugeClass) : 'bg-slate-100 border-slate-200',
              i === threshold - 1 && 'ring-2 ring-slate-300 ring-offset-1',
            )}
            title={i === threshold - 1 ? `Umbral = ${threshold}` : undefined}
          />
        ))}
      </div>

      {/* Bar + threshold marker */}
      <div className="relative h-2.5 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden p-0.5">
        <div
          className={cn('h-full rounded-full transition-all', cfg.gaugeClass)}
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
        {/* Threshold tick */}
        <span
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-slate-700 rounded-full border border-white shadow-sm"
          style={{ left: `${(threshold / max) * 100}%` }}
          aria-hidden="true"
          title={`Umbral ${threshold}`}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] font-bold">
        <span className="text-slate-500">
          Umbral: <span className="tabular-nums text-slate-700">{threshold}</span>
        </span>
        <span className="text-slate-500">
          Escala 0–<span className="tabular-nums">{max}</span>
        </span>
      </div>
    </div>
  );
}

function StatusHero({
  data,
  cfg,
}: {
  data: PragmaticModuleData;
  cfg: (typeof STATUS_CONFIG)[PragmaticStatus];
}) {
  const Icon =
    data.status === PRAGMATIC_STATUS.MEETS
      ? IconCircleCheck
      : data.status === PRAGMATIC_STATUS.BORDERLINE
        ? IconAlertTriangle
        : IconAlertCircle;

  return (
    <div
      className={cn('rounded-2xl border-2 px-4 py-3 flex flex-col gap-2', cfg.heroClass)}
      role="status"
      aria-label={cfg.label}
    >
      <div className="flex items-center gap-3 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-black uppercase tracking-wider',
            cfg.pillClass,
          )}
        >
          <Icon className="w-4 h-4" aria-hidden="true" stroke={2.5} />
          {cfg.label}
        </span>
        <span className="text-xs font-medium text-slate-600 leading-tight">{cfg.description}</span>
      </div>

      {data.anomaliesObserved !== undefined && data.threshold !== undefined ? (
        <div className="flex items-baseline gap-2 flex-wrap">
          <code className="inline-flex items-center rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-sm font-mono font-bold tabular-nums text-slate-800">
            {data.anomaliesObserved} {data.status === PRAGMATIC_STATUS.MEETS ? '<' : '≥'}{' '}
            {data.threshold}
          </code>
          <span className="text-xs font-medium text-slate-500">anomalías vs umbral normativo</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Pragmatic / VHP module — clinical status card.
 * Shows hero stat, gauge toward threshold, semantic status pill, and insight callout.
 */
export function PragmaticModuleCard({
  data,
  title = 'Módulo pragmático (VHP)',
  subtitle = 'Valoración de habilidades pragmáticas — perfil verbal',
  className,
}: PragmaticModuleCardProps) {
  const threshold = data.threshold ?? 4;
  const scaleMax = data.scaleMax ?? 15;
  const cfg = STATUS_CONFIG[data.status];
  const anomalies = data.anomaliesObserved;

  const defaultInsight =
    data.insight ??
    (data.status === PRAGMATIC_STATUS.NOT_MEETS
      ? 'Se detectan dificultades pragmáticas significativas. Se recomienda profundizar con observación en contexto natural y valorar intervención en uso del lenguaje.'
      : data.status === PRAGMATIC_STATUS.BORDERLINE
        ? 'Perfil límite. Conviene reevaluar y contrastar con informantes (familia/escuela) antes de concluir criterio.'
        : 'Perfil pragmático sin hallazgos relevantes en esta escala. Mantener seguimiento si hay queja funcional.');

  return (
    <article
      className={cn(
        'flex flex-col rounded-[1.75rem] bg-white border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden',
        'focus-within:ring-2 focus-within:ring-sky-300 focus-within:border-sky-300',
        className,
      )}
      aria-labelledby="vhp-title"
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 bg-gradient-to-r from-indigo-50 via-white to-sky-50 border-b border-slate-100 flex items-start gap-3">
        <span
          className={cn(
            'inline-flex items-center justify-center w-10 h-10 rounded-2xl border-2 shadow-sm shrink-0',
            data.status === PRAGMATIC_STATUS.NOT_MEETS
              ? 'bg-indigo-500 text-white border-indigo-600'
              : data.status === PRAGMATIC_STATUS.BORDERLINE
                ? 'bg-amber-400 text-amber-900 border-amber-500'
                : 'bg-emerald-500 text-white border-emerald-600',
          )}
          aria-hidden="true"
        >
          <IconBrain className="w-5 h-5" stroke={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="vhp-title"
            className="text-[15px] sm:text-base font-black tracking-tight text-slate-900 leading-tight flex items-center gap-2 flex-wrap"
          >
            {title}
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 text-white px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
              <IconMessage className="w-3 h-3" aria-hidden="true" />
              VHP
            </span>
          </h2>
          {subtitle ? (
            <p className="text-xs font-medium text-slate-500 leading-snug mt-0.5">{subtitle}</p>
          ) : null}
        </div>
        {/* Header status dot */}
        <span
          className={cn(
            'w-2.5 h-2.5 rounded-full border-2 shrink-0 mt-1',
            cfg.gaugeClass,
            'border-white shadow-sm',
          )}
          aria-hidden="true"
          title={cfg.label}
        />
      </div>

      {/* Stat hero */}
      <div className="px-5 pt-5 pb-4 flex flex-col sm:flex-row sm:items-start gap-5">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <IconTrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
            Anomalías observadas
          </span>
          <div className="flex items-baseline gap-3 mt-1">
            <span
              className={cn(
                'text-5xl font-black tabular-nums leading-none tracking-tight',
                data.status === PRAGMATIC_STATUS.NOT_MEETS
                  ? 'text-rose-600'
                  : data.status === PRAGMATIC_STATUS.BORDERLINE
                    ? 'text-amber-600'
                    : 'text-emerald-600',
              )}
              aria-label={`${anomalies} anomalías`}
            >
              {anomalies}
            </span>
            <span className="text-sm font-bold text-slate-500">/ {scaleMax}</span>
            <span
              className={cn(
                'hidden sm:inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-wider',
                cfg.heroClass,
                data.status === PRAGMATIC_STATUS.NOT_MEETS
                  ? 'text-rose-700 border-rose-200'
                  : data.status === PRAGMATIC_STATUS.BORDERLINE
                    ? 'text-amber-800 border-amber-200'
                    : 'text-emerald-700 border-emerald-200',
              )}
            >
              <IconSparkles className="w-3 h-3 mr-1" aria-hidden="true" />
              {data.status === PRAGMATIC_STATUS.NOT_MEETS
                ? 'Por encima del umbral'
                : data.status === PRAGMATIC_STATUS.BORDERLINE
                  ? 'Zona límite'
                  : 'Dentro de rango'}
            </span>
          </div>
          {data.normativeLabel ? (
            <span className="text-[11px] font-medium text-slate-400 mt-1">
              {data.normativeLabel}
            </span>
          ) : (
            <span className="text-[11px] font-medium text-slate-400 mt-1">
              Escala normativa · puntos directos
            </span>
          )}

          <div className="mt-4">
            <DotGauge value={anomalies} max={scaleMax} threshold={threshold} status={data.status} />
          </div>
        </div>

        {/* Visual aside — stacked info */}
        <div className="sm:w-[200px] shrink-0 rounded-2xl bg-slate-50 border-2 border-slate-200 p-3 flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Criterio
          </span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center justify-center w-8 h-8 rounded-xl border-2 shrink-0',
                cfg.iconBg,
              )}
              aria-hidden="true"
            >
              {data.status === PRAGMATIC_STATUS.MEETS ? (
                <IconCircleCheck className="w-5 h-5" stroke={2.2} />
              ) : data.status === PRAGMATIC_STATUS.BORDERLINE ? (
                <IconAlertTriangle className="w-5 h-5" stroke={2.2} />
              ) : (
                <IconAlertCircle className="w-5 h-5" stroke={2.2} />
              )}
            </span>
            <span className="text-sm font-black leading-tight text-slate-800">
              {cfg.shortLabel}
            </span>
          </div>
          <p className="text-xs font-medium leading-relaxed text-slate-500">
            Umbral clínico en{' '}
            <span className="font-black tabular-nums text-slate-700">{threshold}</span> anomalías
            {anomalies > threshold
              ? ` — ${anomalies - threshold} por encima.`
              : anomalies === threshold
                ? ' — en el límite.'
                : ` — ${threshold - anomalies} por debajo.`}
          </p>
        </div>
      </div>

      {/* Status hero */}
      <div className="px-5 pb-4">
        <StatusHero data={data} cfg={cfg} />
      </div>

      {/* Insight callout */}
      <div className="px-5 pb-5">
        <div
          className={cn(
            'rounded-2xl border border-slate-200 border-l-4 px-4 py-3 flex gap-3',
            cfg.insightBg,
            cfg.insightBorder,
          )}
          role="note"
          aria-label="Interpretación clínica"
        >
          <span
            className={cn(
              'inline-flex items-center justify-center w-7 h-7 rounded-xl border shrink-0 mt-0.5',
              data.status === PRAGMATIC_STATUS.NOT_MEETS
                ? 'bg-white border-rose-200 text-rose-500'
                : data.status === PRAGMATIC_STATUS.BORDERLINE
                  ? 'bg-white border-amber-200 text-amber-600'
                  : 'bg-white border-emerald-200 text-emerald-600',
            )}
            aria-hidden="true"
          >
            <IconInfoCircle className="w-4 h-4" />
          </span>
          <p className="text-sm font-medium leading-relaxed text-slate-700">{defaultInsight}</p>
        </div>
      </div>

      {/* Footer action */}
      {data.onViewDetail ? (
        <div className="px-5 pb-5 pt-0">
          <button
            type="button"
            onClick={data.onViewDetail}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white px-4 py-2 text-xs font-black uppercase tracking-wider hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-colors"
            aria-label="Ver detalle del módulo pragmático"
          >
            <IconEye className="w-4 h-4" aria-hidden="true" />
            Ver detalle
            <IconChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </article>
  );
}

export default PragmaticModuleCard;

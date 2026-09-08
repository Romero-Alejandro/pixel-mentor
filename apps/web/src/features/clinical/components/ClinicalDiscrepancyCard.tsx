import {
  IconCheck,
  IconX,
  IconInfoCircle,
  IconScale,
  IconChartBar,
  IconBulb,
  IconAlertTriangle,
  IconCircleCheck,
  IconPercentage,
} from '@tabler/icons-react';

import { cn } from '@/utils/cn';
import type {
  Discrepancy,
  DiscrepancyInterpretation,
  SignificanceResult,
  ClinicalDiscrepancySectionProps,
  DiscrepancyCardProps,
  RarityLevel,
} from '@/features/clinical/types/clinical.types';
import { RARITY_LEVEL } from '@/features/clinical/types/clinical.types';

// ────────────────────────────────────────────────────────────
// Intent: Clinical analyst at 9am with WISC/WAIS printout — must spot
// which inter-index gaps matter in <10s, understand base rate, and copy
// a citable interpretation. Feel: calm clinical paper + Pixel Mentor
// gummy warmth — not sterile table, not toy UI.
// Palette: paper #fff / sky canvas; emerald = significant, rose =
///          non-significant, amber = watch, slate for body.
// Depth:   borders-only + whisper gummy shadow for elevation.
// Surfaces: page #f0f9ff → card white → inset cell slate-50.
// Typography: Quicksand black for emphasis, mono tabular-nums for scores.
// Spacing: 4px base (p-4 / gap-3 / rounded-2xl).
// ────────────────────────────────────────────────────────────

// ── Helpers ─────────────────────────────────────────────────

function getRarityLevel(prevalence: number): RarityLevel {
  if (prevalence >= 25) return RARITY_LEVEL.VERY_FREQUENT;
  if (prevalence >= 10) return RARITY_LEVEL.FREQUENT;
  if (prevalence >= 5) return RARITY_LEVEL.INFREQUENT;
  if (prevalence >= 2) return RARITY_LEVEL.VERY_INFREQUENT;
  return RARITY_LEVEL.RARE;
}

const RARITY_CONFIG: Record<
  RarityLevel,
  { label: string; shortLabel: string; barClass: string; badgeClass: string }
> = {
  [RARITY_LEVEL.VERY_FREQUENT]: {
    label: 'Muy frecuente',
    shortLabel: 'Frecuente',
    barClass: 'bg-sky-400',
    badgeClass: 'bg-sky-100 text-sky-700 border-sky-200',
  },
  [RARITY_LEVEL.FREQUENT]: {
    label: 'Frecuente',
    shortLabel: 'Frecuente',
    barClass: 'bg-emerald-400',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  [RARITY_LEVEL.INFREQUENT]: {
    label: 'Infrecuente',
    shortLabel: 'Infrecuente',
    barClass: 'bg-amber-400',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  [RARITY_LEVEL.VERY_INFREQUENT]: {
    label: 'Muy infrecuente',
    shortLabel: 'Muy infrecuente',
    barClass: 'bg-orange-400',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  [RARITY_LEVEL.RARE]: {
    label: 'Rara',
    shortLabel: 'Rara',
    barClass: 'bg-rose-400',
    badgeClass: 'bg-rose-100 text-rose-700 border-rose-200',
  },
};

// ── Significance Chip ───────────────────────────────────────

/**
 * Semantic chip for a single alpha threshold.
 * Icon + color + text — never color alone. CV shown as sublabel/tooltip.
 */
function SignificanceChip({
  label,
  result,
  compact,
}: {
  label: string;
  result: SignificanceResult;
  compact?: boolean;
}) {
  const { isSignificant, cv } = result;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-black tracking-wide',
        isSignificant
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
          : 'bg-rose-50 border-rose-200 text-rose-700',
        compact && 'px-2.5 py-0.5 text-[11px]',
      )}
      role="status"
      aria-label={`${label}: ${isSignificant ? 'Significativa' : 'No significativa'} — CV ${cv}`}
      title={`Valor crítico (CV) = ${cv}. ${isSignificant ? 'Supera' : 'No supera'} el umbral al nivel ${label}.`}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full w-4 h-4 shrink-0',
          isSignificant ? 'bg-emerald-500 text-white' : 'bg-rose-400 text-white',
        )}
        aria-hidden="true"
      >
        {isSignificant ? (
          <IconCheck className="w-3 h-3" stroke={3} />
        ) : (
          <IconX className="w-3 h-3" stroke={3} />
        )}
      </span>
      <span className="uppercase leading-none">{isSignificant ? 'Sí' : 'No'}</span>
      <span className="hidden sm:inline font-medium normal-case text-[11px] opacity-70">
        · CV {cv}
      </span>
      {/* Mobile: CV on second line via sr-like tiny label */}
      <span className="sm:hidden font-bold text-[10px] leading-none opacity-60">CV{cv}</span>
      <span className="sr-only">alpha {label}</span>
    </div>
  );
}

// ── Prevalence Indicator ────────────────────────────────────

function PrevalenceIndicator({ prevalence }: { prevalence: number }) {
  const rarity = getRarityLevel(prevalence);
  const config = RARITY_CONFIG[rarity];
  // Clamp bar width: at least 6% visible, max 100%
  const barWidth = Math.max(6, Math.min(100, prevalence));

  return (
    <div
      className="flex flex-col gap-1.5"
      role="img"
      aria-label={`Prevalencia ${prevalence.toFixed(1)} por ciento — ${config.label}`}
      title={`${prevalence.toFixed(1)}% de la muestra normativa presenta una diferencia igual o mayor. ${config.label}.`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-sm font-black tabular-nums text-slate-800">
          <IconPercentage className="w-3.5 h-3.5 text-slate-400" />
          {prevalence.toFixed(1)}%
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
            config.badgeClass,
          )}
        >
          {config.shortLabel}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden p-0.5">
        <div
          className={cn('h-full rounded-full transition-all', config.barClass)}
          style={{ width: `${barWidth}%` }}
          aria-hidden="true"
        />
      </div>
      <span className="text-[11px] leading-tight text-slate-500">
        {prevalence < 10
          ? 'Base rate baja — diferencia poco común.'
          : prevalence < 25
            ? 'Presentación habitual en muestra normativa.'
            : 'Muy habitual — diferencia esperable.'}
      </span>
    </div>
  );
}

// ── Interpretation Block ────────────────────────────────────

function InterpretationBlock({
  interpretation,
  difference,
}: {
  interpretation: DiscrepancyInterpretation;
  difference: number;
}) {
  const { isSignificant, threshold, pLevel } = interpretation;
  const operator = isSignificant ? '≥' : '<';
  const tone = isSignificant
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : 'bg-slate-50 border-slate-200 text-slate-700';

  return (
    <div
      className={cn('rounded-2xl border-2 p-3 flex flex-col gap-2', tone)}
      role="status"
      aria-label={
        isSignificant
          ? `Diferencia significativa: ${difference} ${operator} ${threshold}`
          : `Diferencia no significativa: ${difference} ${operator} ${threshold}`
      }
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-black uppercase tracking-wide',
            isSignificant
              ? 'bg-emerald-500 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-slate-600 border-slate-300',
          )}
        >
          {isSignificant ? (
            <IconCircleCheck className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <IconInfoCircle className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {isSignificant ? 'Significativa' : 'No significativa'}
        </span>
        {pLevel ? (
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            p {pLevel}
          </span>
        ) : null}
      </div>

      {/* Threshold math — tabular, secondary typography */}
      <div className="flex items-baseline gap-2 flex-wrap">
        <code className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-sm font-mono font-bold tabular-nums text-slate-800">
          {difference} {operator} {threshold}
        </code>
        <span className="text-xs font-medium text-slate-500">
          umbral {pLevel ?? ''} · CV {threshold}
        </span>
      </div>

      <p className="text-xs leading-relaxed font-medium opacity-80">
        {isSignificant
          ? 'La diferencia supera el valor crítico y se considera clínicamente significativa para este nivel α.'
          : 'No alcanza el valor crítico; no se interpreta como discrepancia clínicamente significativa.'}
      </p>
    </div>
  );
}

// ── Single Card ─────────────────────────────────────────────

/**
 * Clinical discrepancy card — one pairwise comparison.
 * Replaces a 6-column dense row with a scannable card.
 */
export function DiscrepancyCard({ discrepancy, className }: DiscrepancyCardProps) {
  const { par, formula, difference, alpha05, alpha15, prevalence, interpretation } = discrepancy;

  return (
    <article
      className={cn(
        'group flex flex-col rounded-[1.5rem] bg-white border-2 border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 overflow-hidden',
        'focus-within:ring-2 focus-within:ring-sky-300 focus-within:border-sky-300',
        className,
      )}
      aria-label={`Par ${par} — diferencia ${difference} — fórmula ${formula}`}
    >
      {/* Top strip — par badge + formula */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 text-white border-2 border-sky-600 shadow-sm px-3 py-1.5 text-sm font-black tracking-wider shrink-0"
            aria-label={`Par ${par}`}
          >
            <IconScale className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" aria-hidden="true" />
            {par}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Par contraste
          </span>
        </div>
        <code
          className="inline-flex items-center rounded-full bg-slate-900 text-white px-3 py-1 text-xs font-mono font-bold tabular-nums tracking-tight"
          title={`Fórmula: ${formula}`}
          aria-label={`Fórmula ${formula}`}
        >
          {formula}
        </code>
      </div>

      {/* Difference hero */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
            <IconChartBar className="w-3.5 h-3.5" aria-hidden="true" />
            Diferencia
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-4xl font-black tabular-nums text-slate-900 leading-none tracking-tight">
              {difference}
            </span>
            <span className="text-xs font-bold text-slate-500">puntos</span>
          </div>
          <span className="text-[11px] font-mono font-medium text-slate-400 mt-0.5 tabular-nums">
            {formula}
          </span>
        </div>

        {/* Decorative delta hint */}
        <div
          className={cn(
            'hidden sm:flex items-center justify-center w-12 h-12 rounded-2xl border-2 shrink-0',
            interpretation.isSignificant
              ? 'bg-amber-50 border-amber-200 text-amber-600'
              : 'bg-slate-50 border-slate-200 text-slate-400',
          )}
          aria-hidden="true"
          title={interpretation.isSignificant ? 'Discrepancia marcada' : 'Sin discrepancia marcada'}
        >
          <IconScale className="w-6 h-6" stroke={1.75} />
        </div>
      </div>

      {/* Significance — α chips */}
      <div className="px-4 pb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          Significancia
        </p>
        <div className="flex flex-wrap gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">
              α .05
            </span>
            <SignificanceChip label="α .05" result={alpha05} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ml-1">
              α .15
            </span>
            <SignificanceChip label="α .15" result={alpha15} />
          </div>
        </div>
        <p className="sr-only">
          CV valores críticos: α .05 = {alpha05.cv}, α .15 = {alpha15.cv}
        </p>
      </div>

      {/* Prevalence */}
      <div className="px-4 pb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          Prevalencia
        </p>
        <PrevalenceIndicator prevalence={prevalence} />
      </div>

      {/* Interpretation */}
      <div className="px-4 pb-4 mt-auto">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
          <IconBulb className="w-3.5 h-3.5" aria-hidden="true" />
          Interpretación
        </p>
        <InterpretationBlock interpretation={interpretation} difference={difference} />
      </div>
    </article>
  );
}

// ── Summary Banner ──────────────────────────────────────────

function SummaryBanner({ discrepancies }: { discrepancies: Discrepancy[] }) {
  const total = discrepancies.length;
  const significantCount = discrepancies.filter((d) => d.interpretation.isSignificant).length;
  const hasSignificant = significantCount > 0;
  const none = significantCount === 0;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3',
        hasSignificant
          ? 'bg-amber-50 border-amber-200'
          : none && total > 0
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-slate-50 border-slate-200',
      )}
      role="status"
      aria-live="polite"
      aria-label={`Resumen: ${significantCount} de ${total} discrepancias significativas`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={cn(
            'inline-flex items-center justify-center w-9 h-9 rounded-xl border-2 shrink-0',
            hasSignificant
              ? 'bg-amber-400 border-amber-500 text-white'
              : 'bg-emerald-400 border-emerald-500 text-white',
          )}
          aria-hidden="true"
        >
          {hasSignificant ? (
            <IconAlertTriangle className="w-5 h-5" stroke={2.2} />
          ) : (
            <IconCircleCheck className="w-5 h-5" stroke={2.2} />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-black leading-tight text-slate-800">
            {hasSignificant ? (
              <>
                <span className="tabular-nums">{significantCount}</span> de{' '}
                <span className="tabular-nums">{total}</span> discrepancias significativas
              </>
            ) : total === 0 ? (
              'Sin discrepancias para mostrar'
            ) : (
              'Ninguna discrepancia significativa'
            )}
          </p>
          <p className="text-xs font-medium text-slate-500 leading-tight">
            {hasSignificant
              ? 'Revisa los pares marcados — superan el umbral crítico.'
              : total === 0
                ? 'Añade pares para evaluar.'
                : 'Todas las diferencias están dentro del rango esperado.'}
          </p>
        </div>
      </div>

      {/* Dots summary — quick scan */}
      {total > 0 ? (
        <div
          className="flex items-center gap-1.5 shrink-0 self-start sm:self-center"
          aria-hidden="true"
          title={`${significantCount} significativas`}
        >
          {discrepancies.map((d, i) => (
            <span
              key={`${d.par}-${i}`}
              className={cn(
                'w-2.5 h-2.5 rounded-full border',
                d.interpretation.isSignificant
                  ? 'bg-amber-400 border-amber-500'
                  : 'bg-slate-200 border-slate-300',
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Desktop Table (enhanced, accessible) ────────────────────

function DiscrepancyTable({ discrepancies }: { discrepancies: Discrepancy[] }) {
  if (discrepancies.length === 0) return null;

  return (
    <div
      className="hidden lg:block overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm"
      role="region"
      aria-label="Tabla de discrepancias clínicas"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <caption className="sr-only">
            Tabla de discrepancias por par — incluye diferencia, fórmula, significancia α .05 y α
            .15 con valor crítico, prevalencia e interpretación.
          </caption>
          <thead className="sticky top-0 z-10 bg-slate-50 border-b-2 border-slate-200">
            <tr className="text-[11px] font-black uppercase tracking-widest text-slate-500">
              <th scope="col" className="text-left px-4 py-3 font-black whitespace-nowrap">
                Par
              </th>
              <th scope="col" className="text-left px-4 py-3 font-black whitespace-nowrap">
                Diferencia
              </th>
              <th scope="col" className="text-center px-3 py-3 font-black whitespace-nowrap">
                α .05 (CV)
              </th>
              <th scope="col" className="text-center px-3 py-3 font-black whitespace-nowrap">
                α .15 (CV)
              </th>
              <th scope="col" className="text-left px-4 py-3 font-black whitespace-nowrap">
                Prevalencia
              </th>
              <th scope="col" className="text-left px-4 py-3 font-black min-w-[220px]">
                Interpretación
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {discrepancies.map((d, idx) => {
              const rarity = RARITY_CONFIG[getRarityLevel(d.prevalence)];
              return (
                <tr
                  key={`${d.par}-${idx}`}
                  className={cn(
                    'transition-colors hover:bg-sky-50/60 focus-within:bg-sky-50',
                    idx % 2 === 1 && 'bg-slate-50/60',
                  )}
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="inline-flex items-center rounded-full bg-sky-500 text-white border border-sky-600 px-2.5 py-1 text-xs font-black tracking-wider">
                      {d.par}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-black tabular-nums text-slate-900 text-base">
                      {d.difference}
                    </span>
                    <span className="ml-2 font-mono text-xs text-slate-500 tabular-nums">
                      {d.formula}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <SignificanceChip label="α .05" result={d.alpha05} compact />
                  </td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <SignificanceChip label="α .15" result={d.alpha15} compact />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap min-w-[180px]">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black tabular-nums text-slate-800">
                          {d.prevalence.toFixed(1)}%
                        </span>
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                            rarity.badgeClass,
                          )}
                        >
                          {rarity.shortLabel}
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', rarity.barClass)}
                          style={{ width: `${Math.max(6, Math.min(100, d.prevalence))}%` }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-xs font-black uppercase tracking-wide',
                        d.interpretation.isSignificant
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-600',
                      )}
                    >
                      {d.interpretation.isSignificant ? (
                        <IconCheck className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <IconX className="w-3 h-3" aria-hidden="true" />
                      )}
                      {d.interpretation.isSignificant ? 'Sí' : 'No'} · {d.difference}{' '}
                      {d.interpretation.isSignificant ? '≥' : '<'} {d.interpretation.threshold}
                    </span>
                    {d.interpretation.pLevel ? (
                      <span className="ml-2 text-[11px] font-bold text-slate-400">
                        p {d.interpretation.pLevel}
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center gap-2 text-[11px] font-medium text-slate-500">
        <IconInfoCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        CV = valor crítico. El pill muestra significancia; el número entre paréntesis es el umbral.
        La barra de prevalencia indica rareza normativa.
      </div>
    </div>
  );
}

// ── Empty State ─────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center"
      role="status"
      aria-label="Sin datos de discrepancias"
    >
      <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white border-2 border-slate-200 text-slate-400">
        <IconScale className="w-6 h-6" aria-hidden="true" />
      </span>
      <p className="text-sm font-black text-slate-700">Sin discrepancias para mostrar</p>
      <p className="text-xs font-medium text-slate-500 max-w-sm">
        Añade pares de índices (p. ej. ILR-ILE) para evaluar diferencias, significancia y
        prevalencia base rate.
      </p>
    </div>
  );
}

// ── Public Section ──────────────────────────────────────────

/**
 * Clinical discrepancy section — summary banner + responsive cards + enhanced desktop table.
 * Mobile: stacked cards. Desktop (lg): cards grid + optional table view.
 */
export function ClinicalDiscrepancySection({
  discrepancies,
  title = 'Discrepancias clínicas',
  subtitle = 'Comparación por pares — significancia estadística y prevalencia normativa',
  className,
}: ClinicalDiscrepancySectionProps) {
  const hasData = discrepancies.length > 0;

  return (
    <section
      className={cn('flex flex-col gap-4', className)}
      aria-labelledby="clinical-discrepancy-heading"
    >
      {/* Section header */}
      <div className="flex flex-col gap-1">
        <h2
          id="clinical-discrepancy-heading"
          className="text-lg sm:text-xl font-black tracking-tight text-slate-900 flex items-center gap-2"
        >
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-indigo-500 text-white border-2 border-indigo-600 shadow-sm shrink-0">
            <IconScale className="w-4 h-4" aria-hidden="true" />
          </span>
          {title}
        </h2>
        {subtitle ? (
          <p className="text-sm font-medium text-slate-500 leading-snug">{subtitle}</p>
        ) : null}
      </div>

      {hasData ? <SummaryBanner discrepancies={discrepancies} /> : null}

      {!hasData ? (
        <EmptyState />
      ) : (
        <>
          {/* Cards grid — always visible, primary on mobile */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            role="list"
            aria-label="Discrepancias por par"
          >
            {discrepancies.map((d, idx) => (
              <div key={`${d.par}-${idx}`} role="listitem">
                <DiscrepancyCard discrepancy={d} />
              </div>
            ))}
          </div>

          {/* Enhanced table — desktop companion (lg+) */}
          <DiscrepancyTable discrepancies={discrepancies} />
        </>
      )}
    </section>
  );
}

export default ClinicalDiscrepancySection;

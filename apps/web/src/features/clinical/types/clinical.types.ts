/**
 * Clinical discrepancy & pragmatic module types.
 * Strict typing — no `any`, `unknown` + narrowing enforced at boundaries.
 */

export const SIGNIFICANCE_LEVEL = {
  ALPHA_05: '0.05',
  ALPHA_15: '0.15',
} as const;

export type SignificanceLevel = (typeof SIGNIFICANCE_LEVEL)[keyof typeof SIGNIFICANCE_LEVEL];

export const PRAGMATIC_STATUS = {
  MEETS: 'meets',
  NOT_MEETS: 'not-meets',
  BORDERLINE: 'borderline',
} as const;

export type PragmaticStatus = (typeof PRAGMATIC_STATUS)[keyof typeof PRAGMATIC_STATUS];

export const RARITY_LEVEL = {
  VERY_FREQUENT: 'very-frequent',
  FREQUENT: 'frequent',
  INFREQUENT: 'infrequent',
  VERY_INFREQUENT: 'very-infrequent',
  RARE: 'rare',
} as const;

export type RarityLevel = (typeof RARITY_LEVEL)[keyof typeof RARITY_LEVEL];

/** Result for a single alpha threshold (CV = critical value). */
export interface SignificanceResult {
  /** Whether the observed difference reaches the critical value. */
  isSignificant: boolean;
  /** Critical value for this alpha level. */
  cv: number;
}

/** Interpretation block for a pair discrepancy. */
export interface DiscrepancyInterpretation {
  /** Whether the discrepancy is clinically significant after interpretation. */
  isSignificant: boolean;
  /** Threshold value used for the decision (e.g. 8 for α=.15, 10 for α=.05). */
  threshold: number;
  /** p-level that anchors the threshold, when applicable. */
  pLevel?: '.05' | '.15';
}

/**
 * One pairwise discrepancy entry.
 * @example
 * { par: "ILR-ILE", formula: "|57 - 50| = 7", difference: 7,
 *   alpha05: { isSignificant: false, cv: 11 },
 *   alpha15: { isSignificant: false, cv: 8 },
 *   prevalence: 29.7,
 *   interpretation: { isSignificant: false, threshold: 8, pLevel: ".15" } }
 */
export interface Discrepancy {
  /** Pair label, e.g. "ILR-ILE" or "ICV - IRP". */
  par: string;
  /** Human-readable formula, e.g. "|57 - 50| = 7". */
  formula: string;
  /** Absolute difference value. */
  difference: number;
  /** Significance at α = .05 (stricter CV). */
  alpha05: SignificanceResult;
  /** Significance at α = .15 (more sensitive CV). */
  alpha15: SignificanceResult;
  /** Base rate / prevalence in normative sample, 0–100. */
  prevalence: number;
  /** Clinical interpretation synthesis. */
  interpretation: DiscrepancyInterpretation;
}

/** Props for the list/section wrapper. */
export interface ClinicalDiscrepancySectionProps {
  discrepancies: Discrepancy[];
  title?: string;
  subtitle?: string;
  className?: string;
}

/** Props for a single card. */
export interface DiscrepancyCardProps {
  discrepancy: Discrepancy;
  className?: string;
}

/** Data for the pragmatic / VHP module card. */
export interface PragmaticModuleData {
  /** Observed anomaly count, e.g. 11. */
  anomaliesObserved: number;
  /** Criterion threshold for flagging (default typical = 5 or 7 depending on scale). */
  threshold?: number;
  /** Maximum scale value for gauge normalization (default 15). */
  scaleMax?: number;
  /** Criterion status. */
  status: PragmaticStatus;
  /** Clinical insight sentence shown in the callout box. */
  insight?: string;
  /** Short label for the normative scale, e.g. "T-score · prorated". */
  normativeLabel?: string;
  /** Optional action callback for the "View detail" footer. */
  onViewDetail?: () => void;
}

export interface PragmaticModuleCardProps {
  data: PragmaticModuleData;
  title?: string;
  subtitle?: string;
  className?: string;
}

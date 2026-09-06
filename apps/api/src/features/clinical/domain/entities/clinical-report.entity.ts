export const PRAGMATIC_STATUS = {
  MEETS: 'meets',
  NOT_MEETS: 'not-meets',
  BORDERLINE: 'borderline',
} as const;

export type PragmaticStatus = (typeof PRAGMATIC_STATUS)[keyof typeof PRAGMATIC_STATUS];

export interface SignificanceResult {
  readonly isSignificant: boolean;
  readonly cv: number;
}

export interface DiscrepancyInterpretation {
  readonly isSignificant: boolean;
  readonly threshold: number;
  readonly pLevel?: '.05' | '.15';
}

export interface Discrepancy {
  readonly par: string;
  readonly formula: string;
  readonly difference: number;
  readonly alpha05: SignificanceResult;
  readonly alpha15: SignificanceResult;
  readonly prevalence: number;
  readonly interpretation: DiscrepancyInterpretation;
}

export interface PragmaticModuleData {
  readonly anomaliesObserved: number;
  readonly threshold?: number;
  readonly scaleMax?: number;
  readonly status: PragmaticStatus;
  readonly insight?: string;
  readonly normativeLabel?: string;
}

export interface ClinicalReport {
  readonly clinicalDiscrepancies: readonly Discrepancy[];
  readonly pragmaticModule: PragmaticModuleData;
}

export function createDiscrepancy(params: {
  par: string;
  formula: string;
  difference: number;
  alpha05: SignificanceResult;
  alpha15: SignificanceResult;
  prevalence: number;
  interpretation: DiscrepancyInterpretation;
}): Discrepancy {
  return Object.freeze({
    par: params.par,
    formula: params.formula,
    difference: params.difference,
    alpha05: Object.freeze({ ...params.alpha05 }),
    alpha15: Object.freeze({ ...params.alpha15 }),
    prevalence: params.prevalence,
    interpretation: Object.freeze({ ...params.interpretation }),
  });
}

export function createPragmaticModule(params: {
  anomaliesObserved: number;
  threshold?: number;
  scaleMax?: number;
  status: PragmaticStatus;
  insight?: string;
  normativeLabel?: string;
}): PragmaticModuleData {
  return Object.freeze({
    anomaliesObserved: params.anomaliesObserved,
    threshold: params.threshold,
    scaleMax: params.scaleMax,
    status: params.status,
    insight: params.insight,
    normativeLabel: params.normativeLabel,
  });
}

export function createClinicalReport(params: {
  clinicalDiscrepancies: Discrepancy[];
  pragmaticModule: PragmaticModuleData;
}): ClinicalReport {
  return Object.freeze({
    clinicalDiscrepancies: Object.freeze([...params.clinicalDiscrepancies]),
    pragmaticModule: Object.freeze({ ...params.pragmaticModule }),
  });
}

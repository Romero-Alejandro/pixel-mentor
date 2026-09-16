import { z } from 'zod';

export const SignificanceResultSchema = z.object({
  isSignificant: z.boolean(),
  cv: z.number().int().positive(),
});

export type SignificanceResult = z.infer<typeof SignificanceResultSchema>;

export const DiscrepancyInterpretationSchema = z.object({
  isSignificant: z.boolean(),
  threshold: z.number().int().positive(),
  pLevel: z.enum(['.05', '.15']).optional(),
});

export type DiscrepancyInterpretation = z.infer<typeof DiscrepancyInterpretationSchema>;

export const DiscrepancySchema = z.object({
  par: z.string().min(3),
  formula: z.string().min(5),
  difference: z.number().int().min(0),
  alpha05: SignificanceResultSchema,
  alpha15: SignificanceResultSchema,
  prevalence: z.number().min(0).max(100),
  interpretation: DiscrepancyInterpretationSchema,
});

export type Discrepancy = z.infer<typeof DiscrepancySchema>;

export const PragmaticStatusSchema = z.enum(['meets', 'not-meets', 'borderline']);

export type PragmaticStatus = z.infer<typeof PragmaticStatusSchema>;

export const PragmaticModuleSchema = z.object({
  anomaliesObserved: z.number().int().min(0),
  threshold: z.number().int().positive().optional(),
  scaleMax: z.number().int().positive().optional(),
  status: PragmaticStatusSchema,
  insight: z.string().optional(),
  normativeLabel: z.string().optional(),
});

export type PragmaticModuleData = z.infer<typeof PragmaticModuleSchema>;

export const MissionReportClinicalSchema = z.object({
  clinicalDiscrepancies: z.array(DiscrepancySchema),
  pragmaticModule: PragmaticModuleSchema,
});

export type MissionReportClinical = z.infer<typeof MissionReportClinicalSchema>;

export const MissionReportSchema = z.object({
  xpEarned: z.number().int().min(0),
  totalXP: z.number().int().min(0),
  currentLevel: z.number().int().positive(),
  levelTitle: z.string().min(1),
  xpToNextLevel: z.number().int().min(0),
  newBadges: z.array(
    z.object({
      code: z.string().min(1),
      name: z.string().min(1),
      icon: z.string().min(1),
      xpReward: z.number().int().min(0),
    }),
  ),
  levelUp: z
    .object({
      from: z.number().int().min(0),
      to: z.number().int().positive(),
      title: z.string().min(1),
    })
    .nullable(),
  streakDays: z.number().int().min(0),
  conceptsMastered: z.array(z.string()),
  /**
   * ⚠️ `true` while the clinical section is produced by the placeholder
   * simulation (ClinicalCalculatorService). Must be absent/false once a real
   * calculation is implemented — UIs use it to show a disclosure notice.
   */
  clinicalReportSimulated: z.boolean().optional(),
  clinicalDiscrepancies: z.array(DiscrepancySchema),
  pragmaticModule: PragmaticModuleSchema,
});

export type MissionReport = z.infer<typeof MissionReportSchema>;

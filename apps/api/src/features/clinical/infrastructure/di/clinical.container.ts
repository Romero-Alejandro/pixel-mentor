import type pino from 'pino';

import { ClinicalCalculatorService } from '@/features/clinical/domain/services/clinical-calculator.service.js';
import { GetClinicalReportUseCase } from '@/features/clinical/application/use-cases/get-clinical-report.use-case.js';
import type { GetSessionUseCase } from '@/features/session/application/use-cases/get-session.use-case.js';
import type { GetRecipeUseCase } from '@/features/recipe/application/use-cases/get-recipe.use-case.js';

export interface ClinicalContainer {
  clinicalCalculatorService: ClinicalCalculatorService;
  getClinicalReportUseCase: GetClinicalReportUseCase;
}

export function buildClinicalContainer(
  _logger: pino.Logger,
  getSessionUseCase: GetSessionUseCase,
  getRecipeUseCase: GetRecipeUseCase,
): ClinicalContainer {
  const clinicalCalculatorService = new ClinicalCalculatorService();
  const getClinicalReportUseCase = new GetClinicalReportUseCase(
    getSessionUseCase,
    getRecipeUseCase,
    clinicalCalculatorService,
  );

  return {
    clinicalCalculatorService,
    getClinicalReportUseCase,
  };
}

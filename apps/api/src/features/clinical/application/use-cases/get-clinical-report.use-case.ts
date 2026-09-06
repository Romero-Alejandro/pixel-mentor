import type { GetSessionUseCase } from '@/features/session/application/use-cases/get-session.use-case.js';
import type { GetRecipeUseCase } from '@/features/recipe/application/use-cases/get-recipe.use-case.js';
import type { ClinicalCalculatorService } from '@/features/clinical/domain/services/clinical-calculator.service.js';
import type { ClinicalReport } from '@/features/clinical/domain/entities/clinical-report.entity.js';

export class GetClinicalReportUseCase {
  constructor(
    private readonly getSessionUseCase: GetSessionUseCase,
    private readonly getRecipeUseCase: GetRecipeUseCase,
    private readonly clinicalCalculator: ClinicalCalculatorService,
  ) {}

  async execute(sessionId: string, userId: string): Promise<ClinicalReport> {
    const session = await this.getSessionUseCase.execute(sessionId);

    if (session.studentId !== userId) {
      throw new Error('Session does not belong to user');
    }

    const recipe = await this.getRecipeUseCase.execute(session.recipeId);
    return this.clinicalCalculator.calculate(session, recipe, userId);
  }
}

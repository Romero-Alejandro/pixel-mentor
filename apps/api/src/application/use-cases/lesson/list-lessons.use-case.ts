import type { LessonRepository } from '@/domain/ports/lesson-repository';

export class ListLessonsUseCase {
  constructor(private lessonRepo: LessonRepository) {}

  async execute(activeOnly: boolean = true) {
    if (activeOnly) {
      return await this.lessonRepo.findActive();
    }
    return await this.lessonRepo.findAll();
  }
}

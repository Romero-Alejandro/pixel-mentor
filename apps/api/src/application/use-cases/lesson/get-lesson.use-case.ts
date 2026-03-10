import type { LessonRepository } from '@/domain/ports/lesson-repository';
import { LessonNotFoundError, LessonInactiveError } from '@/domain/ports/lesson-repository';

export class GetLessonUseCase {
  constructor(private lessonRepo: LessonRepository) {}

  async execute(lessonId: string, requireActive: boolean = false) {
    const lesson = await this.lessonRepo.findById(lessonId);
    if (!lesson) throw new LessonNotFoundError(lessonId);
    if (requireActive && !lesson.active) throw new LessonInactiveError(lessonId);
    return lesson;
  }
}

import { randomUUID } from 'node:crypto';

import { AttemptActivityUseCase } from '@/features/activity/application/use-cases/attempt-activity.use-case.js';
import type { ActivityAttemptRepository } from '@/features/activity/domain/ports/activity-attempt.repository.port.js';
import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port.js';
import { AtomType, type Atom } from '@/features/knowledge/domain/entities/atom.entity.js';

function createMockAttemptRepo(): ActivityAttemptRepository {
  return {
    findByUserIdAndAtomId: jest.fn(),
    findByUserIdAndAtomIds: jest.fn(),
    findLatestByUserIdAndAtomId: jest.fn(),
    getMaxAttemptNoByUserIdAndAtomId: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    countCorrectFirstAttempts: jest.fn(),
  };
}

function createMockAtomRepo(atom: Partial<Atom> | null): AtomRepository {
  return {
    findById: jest.fn().mockResolvedValue(atom ? (atom as unknown as Atom) : null),
    findByCanonicalId: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findOptionsByAtomId: jest.fn(),
    createOption: jest.fn(),
    findCompetenciesByAtomId: jest.fn(),
    linkCompetency: jest.fn(),
  } as unknown as AtomRepository;
}

const baseAtom: Partial<Atom> = {
  id: randomUUID(),
  canonicalId: 'canonical-1',
  title: 'Test atom',
  type: AtomType.MCQ,
  content: 'What is the capital of France?',
  locale: 'es',
  difficulty: 1,
  version: '1',
  published: true,
};

describe('AttemptActivityUseCase', () => {
  const userId = randomUUID();
  const atomId = baseAtom.id as string;

  function buildUseCase(attemptRepo: ActivityAttemptRepository, atomRepo: AtomRepository) {
    return new AttemptActivityUseCase(attemptRepo, atomRepo);
  }

  describe('attemptNo numbering', () => {
    it('assigns attemptNo 1 on the first attempt for an atom', async () => {
      const attemptRepo = createMockAttemptRepo();
      (attemptRepo.getMaxAttemptNoByUserIdAndAtomId as jest.Mock).mockResolvedValue(0);
      (attemptRepo.create as jest.Mock).mockImplementation(async (input) => input);

      const useCase = buildUseCase(attemptRepo, createMockAtomRepo(baseAtom));
      await useCase.execute(userId, atomId, 'any');

      expect(attemptRepo.getMaxAttemptNoByUserIdAndAtomId).toHaveBeenCalledWith(userId, atomId);
      expect(attemptRepo.create).toHaveBeenCalledTimes(1);
      expect((attemptRepo.create as jest.Mock).mock.calls[0][0]).toMatchObject({
        userId,
        atomId,
        attemptNo: 1,
      });
    });

    it('increments attemptNo based on the max stored for that user+atom', async () => {
      const attemptRepo = createMockAttemptRepo();
      (attemptRepo.getMaxAttemptNoByUserIdAndAtomId as jest.Mock).mockResolvedValue(3);
      (attemptRepo.create as jest.Mock).mockImplementation(async (input) => input);

      const useCase = buildUseCase(attemptRepo, createMockAtomRepo(baseAtom));
      await useCase.execute(userId, atomId, 'any');

      expect((attemptRepo.create as jest.Mock).mock.calls[0][0]).toMatchObject({
        attemptNo: 4,
      });
    });

    it('scopes numbering to the given atom, not the user globally', async () => {
      const attemptRepo = createMockAttemptRepo();
      const otherAtomId = randomUUID();
      (attemptRepo.getMaxAttemptNoByUserIdAndAtomId as jest.Mock).mockImplementation(
        async (_uid: string, aid: string) => (aid === otherAtomId ? 7 : 0),
      );
      (attemptRepo.create as jest.Mock).mockImplementation(async (input) => input);

      const useCase = buildUseCase(attemptRepo, createMockAtomRepo(baseAtom));

      await useCase.execute(userId, atomId, 'any');
      expect((attemptRepo.create as jest.Mock).mock.calls[0][0]).toMatchObject({
        atomId,
        attemptNo: 1,
      });

      await useCase.execute(userId, otherAtomId, 'any');
      expect((attemptRepo.create as jest.Mock).mock.calls[1][0]).toMatchObject({
        atomId: otherAtomId,
        attemptNo: 8,
      });
    });
  });

  describe('correctness evaluation', () => {
    it('marks MCQ attempts correct only when the response matches the correct option text', async () => {
      const attemptRepo = createMockAttemptRepo();
      (attemptRepo.getMaxAttemptNoByUserIdAndAtomId as jest.Mock).mockResolvedValue(0);
      (attemptRepo.create as jest.Mock).mockImplementation(async (input) => input);

      const atomWithOptions: Partial<Atom> = {
        ...baseAtom,
        options: [
          { id: randomUUID(), atomId, text: 'London', isCorrect: false, order: 0 },
          { id: randomUUID(), atomId, text: 'Paris', isCorrect: true, order: 1 },
        ],
      };
      const useCase = buildUseCase(attemptRepo, createMockAtomRepo(atomWithOptions));

      await useCase.execute(userId, atomId, 'Paris');
      expect((attemptRepo.create as jest.Mock).mock.calls[0][0]).toMatchObject({ correct: true });

      await useCase.execute(userId, atomId, 'London');
      expect((attemptRepo.create as jest.Mock).mock.calls[1][0]).toMatchObject({ correct: false });
    });

    it('grades open answers case-insensitively after trimming', async () => {
      const attemptRepo = createMockAttemptRepo();
      (attemptRepo.getMaxAttemptNoByUserIdAndAtomId as jest.Mock).mockResolvedValue(0);
      (attemptRepo.create as jest.Mock).mockImplementation(async (input) => input);

      const atomOpenAnswer: Partial<Atom> = {
        ...baseAtom,
        options: undefined,
        // For open-answer atoms the use case compares the response against
        // atom.content itself (content doubles as the expected answer).
        content: 'Paris',
      };
      const useCase = buildUseCase(attemptRepo, createMockAtomRepo(atomOpenAnswer));

      await useCase.execute(userId, atomId, '  paris ');
      expect((attemptRepo.create as jest.Mock).mock.calls[0][0]).toMatchObject({ correct: true });

      await useCase.execute(userId, atomId, 'Madrid');
      expect((attemptRepo.create as jest.Mock).mock.calls[1][0]).toMatchObject({ correct: false });
    });
  });

  describe('validation', () => {
    it('throws when the atom does not exist', async () => {
      const attemptRepo = createMockAttemptRepo();
      const useCase = buildUseCase(attemptRepo, createMockAtomRepo(null));

      await expect(useCase.execute(userId, randomUUID(), 'any')).rejects.toThrow(/not found/);
      expect(attemptRepo.create).not.toHaveBeenCalled();
    });
  });
});

/**
 * Unit Tests for CompetencyService
 *
 * Tests cover:
 * - getCompetenciesForAtom: retrieves competencies for an atom, empty results, error handling
 * - linkCompetency: links competency to atom, handles default weight, custom weight, error scenarios
 * - Edge cases: invalid IDs, duplicate linking, weight boundaries
 */

import { CompetencyService } from '@/features/progress/domain/services/competency.service';
import type { AtomRepository } from '@/features/knowledge/domain/ports/atom.repository.port';
import type { AtomCompetency } from '@/features/knowledge/domain/entities/atom-competency.entity';

// Mock factory for AtomCompetency
const createMockAtomCompetency = (overrides: Partial<AtomCompetency> = {}): AtomCompetency => ({
  id: 'atom-comp-1',
  atomId: 'atom-1',
  competencyId: 'competency-1',
  weight: 1.0,
  ...overrides,
});

// Mock repository factory
const createMockAtomRepo = (): jest.Mocked<AtomRepository> => ({
  findById: jest.fn(),
  findByCanonicalId: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findOptionsByAtomId: jest.fn(),
  createOption: jest.fn(),
  findCompetenciesByAtomId: jest.fn(),
  linkCompetency: jest.fn(),
});

describe('CompetencyService', () => {
  let atomRepo: jest.Mocked<AtomRepository>;
  let service: CompetencyService;

  beforeEach(() => {
    atomRepo = createMockAtomRepo();
    service = new CompetencyService(atomRepo);
  });

  describe('getCompetenciesForAtom', () => {
    it('should return competencies array for valid atomId', async () => {
      // Given
      const atomId = 'atom-1';
      const mockCompetencies = [
        createMockAtomCompetency({ id: 'ac-1', atomId, competencyId: 'comp-1' }),
        createMockAtomCompetency({ id: 'ac-2', atomId, competencyId: 'comp-2', weight: 2.5 }),
      ];
      atomRepo.findCompetenciesByAtomId.mockResolvedValue(mockCompetencies);

      // When
      const result = await service.getCompetenciesForAtom(atomId);

      // Then
      expect(atomRepo.findCompetenciesByAtomId).toHaveBeenCalledWith(atomId);
      expect(result).toHaveLength(2);
      expect(result[0].atomId).toBe(atomId);
    });

    it('should return empty array when atom has no competencies', async () => {
      // Given
      atomRepo.findCompetenciesByAtomId.mockResolvedValue([]);

      // When
      const result = await service.getCompetenciesForAtom('atom-1');

      // Then
      expect(result).toEqual([]);
    });

    it('should return single competency', async () => {
      // Given
      const mockCompetency = createMockAtomCompetency({
        id: 'ac-1',
        atomId: 'atom-1',
        competencyId: 'comp-1',
      });
      atomRepo.findCompetenciesByAtomId.mockResolvedValue([mockCompetency]);

      // When
      const result = await service.getCompetenciesForAtom('atom-1');

      // Then
      expect(result).toHaveLength(1);
      expect(result[0].competencyId).toBe('comp-1');
    });

    it('should return competencies with default weight 1.0', async () => {
      // Given
      const mockCompetency = createMockAtomCompetency({ weight: 1.0 });
      atomRepo.findCompetenciesByAtomId.mockResolvedValue([mockCompetency]);

      // When
      const result = await service.getCompetenciesForAtom('atom-1');

      // Then
      expect(result[0].weight).toBe(1.0);
    });

    it('should return competencies with custom weight', async () => {
      // Given
      const mockCompetency = createMockAtomCompetency({ weight: 3.7 });
      atomRepo.findCompetenciesByAtomId.mockResolvedValue([mockCompetency]);

      // When
      const result = await service.getCompetenciesForAtom('atom-1');

      // Then
      expect(result[0].weight).toBe(3.7);
    });

    it('should propagate repository errors', async () => {
      // Given
      const error = new Error('Failed to fetch competencies');
      atomRepo.findCompetenciesByAtomId.mockRejectedValue(error);

      // When/Then
      await expect(service.getCompetenciesForAtom('atom-1')).rejects.toThrow(
        'Failed to fetch competencies',
      );
    });

    it('should handle zero weight edge case', async () => {
      // Given
      const mockCompetency = createMockAtomCompetency({ weight: 0 });
      atomRepo.findCompetenciesByAtomId.mockResolvedValue([mockCompetency]);

      // When
      const result = await service.getCompetenciesForAtom('atom-1');

      // Then
      expect(result[0].weight).toBe(0);
    });

    it('should handle negative weight edge case', async () => {
      // Given
      const mockCompetency = createMockAtomCompetency({ weight: -1.0 });
      atomRepo.findCompetenciesByAtomId.mockResolvedValue([mockCompetency]);

      // When
      const result = await service.getCompetenciesForAtom('atom-1');

      // Then
      expect(result[0].weight).toBe(-1.0);
    });

    it('should handle large weight values', async () => {
      // Given
      const mockCompetency = createMockAtomCompetency({ weight: 999999.999 });
      atomRepo.findCompetenciesByAtomId.mockResolvedValue([mockCompetency]);

      // When
      const result = await service.getCompetenciesForAtom('atom-1');

      // Then
      expect(result[0].weight).toBe(999999.999);
    });

    it('should pass atomId exactly as provided', async () => {
      // Given
      atomRepo.findCompetenciesByAtomId.mockResolvedValue([]);

      // When
      await service.getCompetenciesForAtom('Atom-1-CaseSensitive');

      // Then
      expect(atomRepo.findCompetenciesByAtomId).toHaveBeenCalledWith('Atom-1-CaseSensitive');
    });

    it('should return competencies sorted in repository order', async () => {
      // Given
      const mockCompetencies = [
        createMockAtomCompetency({ id: 'ac-2', competencyId: 'comp-2' }),
        createMockAtomCompetency({ id: 'ac-1', competencyId: 'comp-1' }),
      ];
      atomRepo.findCompetenciesByAtomId.mockResolvedValue(mockCompetencies);

      // When
      const result = await service.getCompetenciesForAtom('atom-1');

      // Then
      expect(result[0].id).toBe('ac-2');
      expect(result[1].id).toBe('ac-1');
    });
  });

  describe('linkCompetency', () => {
    it('should link competency with default weight', async () => {
      // Given
      const atomId = 'atom-1';
      const competencyId = 'competency-1';
      atomRepo.linkCompetency.mockResolvedValue();

      // When
      await service.linkCompetency(atomId, competencyId);

      // Then
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith(atomId, competencyId, undefined);
    });

    it('should link competency with custom weight', async () => {
      // Given
      const atomId = 'atom-1';
      const competencyId = 'competency-1';
      const weight = 2.5;
      atomRepo.linkCompetency.mockResolvedValue();

      // When
      await service.linkCompetency(atomId, competencyId, weight);

      // Then
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith(atomId, competencyId, weight);
    });

    it('should link competency with weight 0', async () => {
      // Given
      atomRepo.linkCompetency.mockResolvedValue();

      // When
      await service.linkCompetency('atom-1', 'competency-1', 0);

      // Then
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith('atom-1', 'competency-1', 0);
    });

    it('should link competency with negative weight', async () => {
      // Given
      atomRepo.linkCompetency.mockResolvedValue();

      // When
      await service.linkCompetency('atom-1', 'competency-1', -0.5);

      // Then
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith('atom-1', 'competency-1', -0.5);
    });

    it('should propagate repository errors during link', async () => {
      // Given
      const error = new Error('Link failed');
      atomRepo.linkCompetency.mockRejectedValue(error);

      // When/Then
      await expect(service.linkCompetency('atom-1', 'comp-1')).rejects.toThrow('Link failed');
    });

    it('should call linkCompetency with exactly three arguments (atomId, competencyId, weight)', async () => {
      // Given
      atomRepo.linkCompetency.mockResolvedValue();

      // When
      await service.linkCompetency('atom-1', 'comp-1', 1.5);

      // Then
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith('atom-1', 'comp-1', 1.5);
    });

    it('should handle linking when weight is omitted (undefined)', async () => {
      // Given
      atomRepo.linkCompetency.mockResolvedValue();

      // When
      await service.linkCompetency('atom-1', 'comp-1');

      // Then
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith('atom-1', 'comp-1', undefined);
    });

    it('should accept various atomId formats', async () => {
      // Given
      atomRepo.linkCompetency.mockResolvedValue();

      // When/Then
      await service.linkCompetency('atom-uuid-1234', 'comp-1', 1.0);
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith('atom-uuid-1234', 'comp-1', 1.0);

      await service.linkCompetency('atom_with_underscore', 'comp-1', 1.0);
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith('atom_with_underscore', 'comp-1', 1.0);
    });

    it('should accept various competencyId formats', async () => {
      // Given
      atomRepo.linkCompetency.mockResolvedValue();

      // When/Then
      await service.linkCompetency('atom-1', 'comp-123', 1.0);
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith('atom-1', 'comp-123', 1.0);

      await service.linkCompetency('atom-1', 'comp_abc_def', 1.0);
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith('atom-1', 'comp_abc_def', 1.0);
    });

    it('should handle large weight values', async () => {
      // Given
      atomRepo.linkCompetency.mockResolvedValue();

      // When
      await service.linkCompetency('atom-1', 'comp-1', 1000000);

      // Then
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith('atom-1', 'comp-1', 1000000);
    });

    it('should handle precision weights', async () => {
      // Given
      atomRepo.linkCompetency.mockResolvedValue();

      // When
      await service.linkCompetency('atom-1', 'comp-1', 0.123456789);

      // Then
      expect(atomRepo.linkCompetency).toHaveBeenCalledWith('atom-1', 'comp-1', 0.123456789);
    });
  });
});

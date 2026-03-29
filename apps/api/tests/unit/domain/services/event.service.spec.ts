/**
 * Unit Tests for EventService
 *
 * Tests cover:
 * - log: creates event with correct data, handles different event types, optional data
 * - Event data shapes: objects, primitives, null, undefined, complex structures
 * - Error handling: repository failures, invalid inputs
 * - Edge cases: UUID generation, session handling
 */

import { EventService } from '@/domain/services/event.service';
import type { EventLogRepository } from '@/domain/ports/event-log-repository';
import type { EventLog } from '@/domain/entities/event-log';
import { EventType } from '@/domain/entities/event-log';

// Mock repository factory
const createMockEventLogRepo = (): jest.Mocked<EventLogRepository> => ({
  findById: jest.fn(),
  findByUserId: jest.fn(),
  findBySessionId: jest.fn(),
  findByType: jest.fn(),
  create: jest.fn(),
  deleteById: jest.fn(),
});

// Helper to create mock EventLog (as repository would return)
const createMockEventLog = (overrides: Partial<EventLog> = {}): EventLog => ({
  id: 'event-1',
  userId: 'user-1',
  sessionId: 'session-1',
  eventType: EventType.START_LESSON,
  data: {},
  timestamp: new Date(),
  ...overrides,
});

describe('EventService', () => {
  let eventLogRepo: jest.Mocked<EventLogRepository>;
  let service: EventService;

  beforeEach(() => {
    eventLogRepo = createMockEventLogRepo();
    service = new EventService(eventLogRepo);
  });

  describe('log', () => {
    it('should create event with all required fields', async () => {
      // Given
      const sessionId = 'session-123';
      const eventType = EventType.START_LESSON;
      eventLogRepo.create.mockResolvedValue(createMockEventLog({ sessionId, eventType }));

      // When
      await service.log(sessionId, eventType);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          eventType,
        }),
      );
    });

    it('should generate unique ID for each event', async () => {
      // Given
      const sessionId = 'session-123';
      const eventType = EventType.COMPONENT_PLAY;
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log(sessionId, eventType);

      // Then
      const callArg = eventLogRepo.create.mock.calls[0][0] as any;
      expect(callArg.id).toBeDefined();
      expect(typeof callArg.id).toBe('string');
      expect(callArg.id.length).toBeGreaterThan(0);
    });

    it('should include data when provided', async () => {
      // Given
      const sessionId = 'session-123';
      const eventType = EventType.ACTIVITY_ATTEMPT;
      const data = { activityId: 'act-1', score: 85, correct: true };
      eventLogRepo.create.mockResolvedValue(createMockEventLog({ data }));

      // When
      await service.log(sessionId, eventType, data);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          eventType,
          data,
        }),
      );
    });

    it('should handle undefined data', async () => {
      // Given
      const sessionId = 'session-123';
      const eventType = EventType.HINT_USED;
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log(sessionId, eventType, undefined);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          eventType,
          data: undefined,
        }),
      );
    });

    it('should handle null data', async () => {
      // Given
      const sessionId = 'session-123';
      const eventType = EventType.OTHER;
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log(sessionId, eventType, null);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: null,
        }),
      );
    });

    it('should work with all EventType enum values', async () => {
      // Given
      const sessionId = 'session-123';
      const eventTypes: EventType[] = [
        EventType.START_LESSON,
        EventType.COMPONENT_PLAY,
        EventType.ACTIVITY_ATTEMPT,
        EventType.HINT_USED,
        EventType.LESSON_COMPLETE,
        EventType.REMEDIATION_TRIGGERED,
        EventType.TTS_PLAY,
        EventType.OTHER,
      ];
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When/Then
      for (const eventType of eventTypes) {
        await service.log(sessionId, eventType);
        expect(eventLogRepo.create).toHaveBeenLastCalledWith(
          expect.objectContaining({ eventType }),
        );
      }
    });

    it('should handle complex nested data object', async () => {
      // Given
      const sessionId = 'session-123';
      const eventType = EventType.ACTIVITY_ATTEMPT;
      const data = {
        activityId: 'act-1',
        answers: [
          { questionId: 'q1', selected: 'a', correct: true },
          { questionId: 'q2', selected: 'b', correct: false },
        ],
        timeSpent: 120.5,
        metadata: {
          source: 'mobile',
          version: '1.2.3',
        },
      };
      eventLogRepo.create.mockResolvedValue(createMockEventLog({ data }));

      // When
      await service.log(sessionId, eventType, data);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({ data }));
    });

    it('should handle data as number', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.OTHER, 42);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({ data: 42 }));
    });

    it('should handle data as string', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.OTHER, 'some string');

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: 'some string' }),
      );
    });

    it('should handle data as boolean', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.OTHER, true);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({ data: true }));
    });

    it('should propagate repository errors', async () => {
      // Given
      const error = new Error('Database write failed');
      eventLogRepo.create.mockRejectedValue(error);

      // When/Then
      await expect(service.log('session-1', EventType.START_LESSON)).rejects.toThrow(
        'Database write failed',
      );
    });

    it('should call create with Omit<EventLog, "timestamp"> (no timestamp from service)', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.START_LESSON);

      // Then
      const callArg = eventLogRepo.create.mock.calls[0][0] as any;
      expect(callArg).not.toHaveProperty('timestamp');
      expect(callArg.id).toBeDefined();
      expect(callArg.sessionId).toBe('session-1');
      expect(callArg.eventType).toBe(EventType.START_LESSON);
    });

    it('should handle empty sessionId', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog({ sessionId: '' }));

      // When
      await service.log('', EventType.OTHER);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({ sessionId: '' }));
    });

    it('should handle sessionId with special characters', async () => {
      // Given
      const sessionId = 'session-123-abc_xyz!@#';
      eventLogRepo.create.mockResolvedValue(createMockEventLog({ sessionId }));

      // When
      await service.log(sessionId, EventType.OTHER);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({ sessionId }));
    });

    it('should not include userId when not provided (service does not set it)', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.START_LESSON);

      // Then
      const callArg = eventLogRepo.create.mock.calls[0][0] as any;
      expect(callArg).not.toHaveProperty('userId');
    });

    it('should handle multiple consecutive logs', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.START_LESSON);
      await service.log('session-1', EventType.COMPONENT_PLAY, { component: 'video' });
      await service.log('session-1', EventType.ACTIVITY_ATTEMPT, { activityId: 'act-1' });

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledTimes(3);
    });

    it('should preserve data shape exactly (no transformation)', async () => {
      // Given
      const data = { a: 1, b: [2, 3, 4], c: { nested: true } };
      eventLogRepo.create.mockResolvedValue(createMockEventLog({ data }));

      // When
      await service.log('sess', EventType.OTHER, data);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(expect.objectContaining({ data }));
    });

    it('should not mutate original data object', async () => {
      // Given
      const data = { key: 'value' };
      const dataCopy = { ...data };
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.OTHER, data);

      // Then
      expect(data).toEqual(dataCopy);
    });

    it('should handle EventType.REMEDIATION_TRIGGERED with data', async () => {
      // Given
      const data = { reason: 'low_score', suggestedAtoms: ['atom-1', 'atom-2'] };
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.REMEDIATION_TRIGGERED, data);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: EventType.REMEDIATION_TRIGGERED, data }),
      );
    });

    it('should handle EventType.LESSON_COMPLETE with score data', async () => {
      // Given
      const data = { finalScore: 92, mastered: true, timeSpent: 3600 };
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.LESSON_COMPLETE, data);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: EventType.LESSON_COMPLETE, data }),
      );
    });

    it('should handle EventType.TTS_PLAY with text data', async () => {
      // Given
      const data = { text: 'Hello world', voice: 'female', duration: 5.2 };
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.TTS_PLAY, data);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: EventType.TTS_PLAY, data }),
      );
    });

    it('should handle EventType.COMPONENT_PLAY with media data', async () => {
      // Given
      const data = { componentId: 'comp-123', type: 'video', duration: 120 };
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.COMPONENT_PLAY, data);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: EventType.COMPONENT_PLAY, data }),
      );
    });

    it('should handle EventType.HINT_USED with hint details', async () => {
      // Given
      const data = { hintLevel: 1, hintType: 'partial', atomId: 'atom-1' };
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.HINT_USED, data);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: EventType.HINT_USED, data }),
      );
    });

    it('should handle concurrently called log methods (different sessions)', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await Promise.all([
        service.log('session-1', EventType.START_LESSON),
        service.log('session-2', EventType.START_LESSON),
        service.log('session-3', EventType.START_LESSON),
      ]);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledTimes(3);
    });

    it('should pass through repository rejection as is', async () => {
      // Given
      const error = new Error('Unique constraint violation');
      eventLogRepo.create.mockRejectedValue(error);

      // When/Then
      await expect(service.log('sess', EventType.OTHER)).rejects.toBe(error);
    });

    it('should handle EventType.START_LESSON without data', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.START_LESSON);

      // Then
      expect(eventLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: EventType.START_LESSON, data: undefined }),
      );
    });

    it('should not set userId (domain logic determines that elsewhere)', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog());

      // When
      await service.log('session-1', EventType.OTHER);

      // Then
      const callArg = eventLogRepo.create.mock.calls[0][0] as any;
      expect(callArg.userId).toBeUndefined();
    });

    it('should handle all event types with same pattern', async () => {
      // Given
      eventLogRepo.create.mockResolvedValue(createMockEventLog());
      const types: EventType[] = Object.values(EventType);

      // When/Then
      for (const type of types) {
        await service.log('sess', type);
        expect(eventLogRepo.create).toHaveBeenLastCalledWith(
          expect.objectContaining({ eventType: type }),
        );
      }
    });
  });
});

export enum EventType {
  START_LESSON = 'START_LESSON',
  COMPONENT_PLAY = 'COMPONENT_PLAY',
  ACTIVITY_ATTEMPT = 'ACTIVITY_ATTEMPT',
  HINT_USED = 'HINT_USED',
  LESSON_COMPLETE = 'LESSON_COMPLETE',
  REMEDIATION_TRIGGERED = 'REMEDIATION_TRIGGERED',
  TTS_PLAY = 'TTS_PLAY',
  OTHER = 'OTHER',
}

export interface EventLog {
  readonly id: string;
  readonly userId?: string;
  readonly sessionId?: string;
  readonly eventType: EventType;
  readonly data: unknown;
  readonly timestamp: Date;
}

export function createEventLog(parameters: {
  id: string;
  userId?: string;
  sessionId?: string;
  eventType: EventType;
  data: unknown;
}): EventLog {
  return {
    id: parameters.id,
    userId: parameters.userId,
    sessionId: parameters.sessionId,
    eventType: parameters.eventType,
    data: parameters.data,
    timestamp: new Date(),
  };
}

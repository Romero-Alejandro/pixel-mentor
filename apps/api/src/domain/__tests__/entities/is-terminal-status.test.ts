import {
  isTerminalStatus,
  type SessionStatus,
} from '@/domain/entities/session';

describe('isTerminalStatus', () => {
  it('should return true for COMPLETED status', () => {
    expect(isTerminalStatus('COMPLETED' as SessionStatus)).toBe(true);
  });

  it('should return true for ESCALATED status', () => {
    expect(isTerminalStatus('ESCALATED' as SessionStatus)).toBe(true);
  });

  it('should return false for ACTIVE status', () => {
    expect(isTerminalStatus('ACTIVE' as SessionStatus)).toBe(false);
  });

  it('should return false for IDLE status', () => {
    expect(isTerminalStatus('IDLE' as SessionStatus)).toBe(false);
  });

  it('should return false for PAUSED_FOR_QUESTION status', () => {
    expect(isTerminalStatus('PAUSED_FOR_QUESTION' as SessionStatus)).toBe(false);
  });

  it('should return false for AWAITING_CONFIRMATION status', () => {
    expect(isTerminalStatus('AWAITING_CONFIRMATION' as SessionStatus)).toBe(false);
  });

  it('should return false for PAUSED_IDLE status', () => {
    expect(isTerminalStatus('PAUSED_IDLE' as SessionStatus)).toBe(false);
  });
});

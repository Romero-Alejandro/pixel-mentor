import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { EventSourceMessage } from '@microsoft/fetch-event-source';

import { useGamificationStore } from '@/features/gamification/stores/gamification.store';

interface CapturedOptions {
  onmessage: (event: EventSourceMessage) => void;
  onopen: () => Promise<void>;
}

const captured: { options: CapturedOptions | null } = { options: null };

vi.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: vi.fn((_url: string, options: CapturedOptions) => {
    captured.options = options;
    return Promise.resolve();
  }),
}));

vi.mock('@/services/api-client', () => ({
  getToken: () => 'test-token',
}));

vi.mock('@/features/gamification/services/gamification.api', () => ({
  gamificationApi: {
    getProfile: vi.fn().mockResolvedValue(null),
  },
}));

import { useGamificationSSE } from '@/features/gamification/hooks/use-gamification-sse';

function message(event: string, payload: object): EventSourceMessage {
  return { event, data: JSON.stringify(payload), id: '', retry: undefined };
}

describe('useGamificationSSE', () => {
  const onXPEarned = vi.fn();
  const onBadgeEarned = vi.fn();
  const onLevelUp = vi.fn();
  const onStreakUpdated = vi.fn();

  beforeEach(() => {
    captured.options = null;
    onXPEarned.mockReset();
    onBadgeEarned.mockReset();
    onLevelUp.mockReset();
    onStreakUpdated.mockReset();

    useGamificationStore.setState({
      onXPEarned,
      onBadgeEarned,
      onLevelUp,
      onStreakUpdated,
    });
  });

  function connect(): CapturedOptions {
    renderHook(() => useGamificationSSE(true));
    if (!captured.options) {
      throw new Error('SSE connection was not opened');
    }
    return captured.options;
  }

  it('updates the balance with the new total, not with the delta', () => {
    // Regression guard: the server sends `amount` (the delta) and `newTotal`
    // (the balance). The client used to store the delta as the balance.
    const { onmessage } = connect();

    onmessage(
      message('xp_earned', { type: 'xp_earned', amount: 70, newTotal: 150, reason: 'LESSON' }),
    );

    expect(onXPEarned).toHaveBeenCalledWith(150, 'LESSON');
  });

  it('dispatches the event name carried by the frame', () => {
    const { onmessage } = connect();
    const badge = { code: 'FIRST_LESSON', name: 'Primera lección', icon: '🏆', xpReward: 10 };

    onmessage(message('badge_earned', { type: 'badge_earned', badge }));

    expect(onBadgeEarned).toHaveBeenCalledWith(badge);
  });

  it('falls back to the type inside the payload when the frame is unnamed', () => {
    const { onmessage } = connect();

    onmessage(message('', { type: 'streak_updated', currentStreak: 7, longestStreak: 9 }));

    expect(onStreakUpdated).toHaveBeenCalledWith(7, 9);
  });

  it('maps a level up with the total that crossed the threshold', () => {
    const { onmessage } = connect();

    onmessage(
      message('level_up', {
        type: 'level_up',
        newLevel: 2,
        newLevelTitle: 'Brote',
        previousLevel: 1,
        totalXP: 150,
      }),
    );

    expect(onLevelUp).toHaveBeenCalledWith({
      newLevel: 2,
      newLevelTitle: 'Brote',
      previousLevel: 1,
      totalXP: 150,
    });
  });

  it('ignores an unknown event without throwing', () => {
    const { onmessage } = connect();

    expect(() => onmessage(message('mystery', { type: 'mystery' }))).not.toThrow();
    expect(onXPEarned).not.toHaveBeenCalled();
  });
});

import { formatSSEFrame } from '@/features/gamification/infrastructure/http/gamification-events.routes.js';

describe('formatSSEFrame', () => {
  it('names the event so the client can dispatch it', () => {
    // Regression guard: the route used to write only `data:`, so every frame
    // arrived unnamed and the client's switch fell through to `default`.
    const frame = formatSSEFrame({
      type: 'xp_earned',
      amount: 70,
      newTotal: 150,
      reason: 'LESSON',
    });

    expect(frame).toBe(
      'event: xp_earned\ndata: {"type":"xp_earned","amount":70,"newTotal":150,"reason":"LESSON"}\n\n',
    );
    expect(frame.startsWith('data:')).toBe(false);
  });

  it.each([
    ['xp_earned', { type: 'xp_earned' as const, amount: 1, newTotal: 1, reason: 'LESSON' }],
    [
      'badge_earned',
      {
        type: 'badge_earned' as const,
        badge: { code: 'B', name: 'B', icon: '🏆', xpReward: 10 },
      },
    ],
    [
      'level_up',
      {
        type: 'level_up' as const,
        newLevel: 2,
        newLevelTitle: 'Brote',
        previousLevel: 1,
        totalXP: 150,
      },
    ],
    ['streak_updated', { type: 'streak_updated' as const, currentStreak: 7, longestStreak: 7 }],
  ])('emits a %s frame that ends with a blank line', (name, event) => {
    const frame = formatSSEFrame(event);

    expect(frame.split('\n')[0]).toBe(`event: ${name}`);
    expect(frame.endsWith('\n\n')).toBe(true);
    expect(JSON.parse(frame.split('\n')[1].replace('data: ', ''))).toMatchObject({ type: name });
  });
});

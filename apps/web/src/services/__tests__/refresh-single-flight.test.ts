/**
 * refreshAccessToken single-flight tests.
 *
 * The server rotates the refresh token on every use: a second concurrent
 * rotation with the same cookie is treated as a replay attack and nukes the
 * whole session. All refresh callers (session restore + 401 interceptor)
 * must therefore share one in-flight rotation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockRefreshToken } = vi.hoisted(() => ({
  mockRefreshToken: vi.fn(),
}));

// Mock auth.api BEFORE importing the real api-client under test.
vi.mock('@/features/auth/services/auth.api', () => ({
  authApi: { refreshToken: mockRefreshToken },
}));

import { refreshAccessToken, getToken, clearToken } from '@/services/api-client';

describe('refreshAccessToken single-flight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearToken();
  });

  it('shares one rotation between concurrent callers', async () => {
    mockRefreshToken.mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve({ accessToken: 'rotated.token' }), 20)),
    );

    const [first, second] = await Promise.all([refreshAccessToken(), refreshAccessToken()]);

    expect(first).toBe('rotated.token');
    expect(second).toBe('rotated.token');
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(getToken()).toBe('rotated.token');
  });

  it('starts a new rotation after the previous one settles', async () => {
    mockRefreshToken
      .mockResolvedValueOnce({ accessToken: 'first.token' })
      .mockResolvedValueOnce({ accessToken: 'second.token' });

    await expect(refreshAccessToken()).resolves.toBe('first.token');
    await expect(refreshAccessToken()).resolves.toBe('second.token');
    expect(mockRefreshToken).toHaveBeenCalledTimes(2);
  });

  it('propagates rotation failures to all sharers with a single request', async () => {
    mockRefreshToken.mockRejectedValueOnce(new Error('invalid refresh token'));

    const results = await Promise.allSettled([refreshAccessToken(), refreshAccessToken()]);

    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
  });
});

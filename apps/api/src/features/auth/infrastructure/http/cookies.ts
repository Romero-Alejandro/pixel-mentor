import type { Request, Response } from 'express';

import { config } from '@/shared/config/index.js';
import { parseExpiresIn } from '@/shared/utils/index.js';

/**
 * The refresh token is delivered in an httpOnly cookie so it can never be
 * read (and exfiltrated) from JavaScript. Only the short-lived access token
 * is exposed to the client.
 */
export const REFRESH_TOKEN_COOKIE_NAME = 'pm_refresh_token';

/** Scope the cookie to the auth endpoints so it is never sent elsewhere. */
const REFRESH_COOKIE_PATH = '/api/auth';

interface RefreshCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: string;
}

function baseCookieOptions(): RefreshCookieOptions {
  return {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  };
}

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  // Keep the cookie lifetime aligned with the JWT expiry configured for refresh tokens.
  const expiresAt = parseExpiresIn(config.JWT_REFRESH_EXPIRES_IN);
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now());
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...baseCookieOptions(),
    maxAge,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, baseCookieOptions());
}

function readRefreshTokenFromBody(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const candidate = (body as Record<string, unknown>).refreshToken;
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined;
}

/**
 * Prefer the httpOnly cookie (primary transport). Falls back to the request
 * body for backwards compatibility with clients that still send it there.
 */
export function readRefreshToken(req: Request): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) continue;
      const name = part.slice(0, separatorIndex).trim();
      if (name === REFRESH_TOKEN_COOKIE_NAME) {
        try {
          return decodeURIComponent(part.slice(separatorIndex + 1).trim());
        } catch {
          return undefined;
        }
      }
    }
  }
  return readRefreshTokenFromBody(req.body);
}

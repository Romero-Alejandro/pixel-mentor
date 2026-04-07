import { test, expect } from '@playwright/test';

test('API health check', async ({ page }) => {
  // Not using page network because baseURL not set to API, use direct request
  const response = await page.context().request.get('http://localhost:3001/health');
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe('healthy');
});

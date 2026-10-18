import { randomUUID } from 'node:crypto';
import { expect, Page, Response } from '@playwright/test';
import { confirmDialog } from './ui-locators';

export const USER = {
  userId: process.env.E2E_USER_ID ?? 'e2etester',
  password: process.env.E2E_PASSWORD ?? 'Test1234!',
};
export const API = (process.env.E2E_API_URL ?? 'http://localhost:4000/v1').replace(/\/$/, '');

export async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('User ID').fill(USER.userId);
  await page.getByLabel(/^Password\s*\*?$/).fill(USER.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15000 });
}

export async function authHeaders(page: Page) {
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem('accessToken') || 'null'));
  expect(typeof token).toBe('string');
  return { Authorization: `Bearer ${token}` };
}

export async function confirmAction(page: Page) {
  // Shared alert dialog: accept through the named action, never through button order.
  await confirmDialog(page, true);
}

export function createResponse(page: Page, resource: string) {
  return page.waitForResponse(r => new URL(r.url()).pathname === `/v1/${resource}` && r.request().method() === 'POST', {
    timeout: 30000,
  });
}

export async function createdId(response: Response) {
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(201);
  expect(body.status).toBe('SUCCESS');
  expect(body.data.id).toEqual(expect.any(Number));
  expect(body.data.id).toBeGreaterThan(0);
  return body.data.id as number;
}

export async function removeOwned(page: Page, headers: Record<string, string>, resource: string, id?: number) {
  if (!id) return;
  let data: Record<string, unknown> | undefined;
  if (resource === 'dashboard') {
    const impact = await page.request.get(`${API}/dashboard/${id}/delete-impact`, { headers });
    expect(impact.ok(), 'Read owned test dashboard deletion impact').toBe(true);
    const result = await impact.json();
    expect(result.status).toBe('SUCCESS');
    expect(result.data.canDelete, JSON.stringify(result.data.dependencies)).toBe(true);
    data = {
      requestId: randomUUID(),
      expectedRevision: result.data.revision,
      expectedActorId: result.data.actorId,
      expectedOrganizationId: result.data.organizationId,
    };
  }
  const response = await page.request.delete(`${API}/${resource}/${id}`, { headers, ...(data ? { data } : {}) });
  expect(response.ok(), `DELETE ${resource}/${id}: ${await response.text()}`).toBe(true);
  // Dataset DELETE returns plain text; other owned resources return JSON.
  const text = await response.text();
  if (resource === 'dataset') expect(text).toBe(`This action removes a #${id} dataset`);
  else expect(JSON.parse(text).status).toBe('SUCCESS');
}

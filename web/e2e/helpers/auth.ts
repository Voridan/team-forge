import type { Page } from '@playwright/test';

/**
 * Logs in via the UI. Slower than calling the API directly but exercises the
 * full auth flow (form validation, token persistence, redirect). Use this in
 * place of `storageState` setup so each test starts from a known cookie state.
 */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  // Successful login redirects to /
  await page.waitForURL('/', { timeout: 10_000 });
}

/**
 * Navigates into the seed team's Chat tab and selects the first channel.
 * Assumes the seeded "Engineering" team has at least one channel — if the
 * test database has none, the caller must create one first.
 */
export async function openTeamChat(page: Page, teamName = 'Engineering'): Promise<void> {
  await page.goto('/teams');
  await page.getByRole('link', { name: new RegExp(teamName, 'i') }).first().click();
  await page.getByRole('tab', { name: /^chat/i }).click();
}

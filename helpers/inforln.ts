import { type Page, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Credentials & URLs – loaded from .env via playwright.config.ts
// ---------------------------------------------------------------------------
export const USERNAME = process.env.LN_USERNAME!;
export const PASSWORD = process.env.LN_PASSWORD!;
export const BASE_URL  = process.env.LN_BASE_URL!;

// ---------------------------------------------------------------------------
// InforLN iframe helper
// The main InforLN UI lives inside the second iframe on the page (index 1).
// ---------------------------------------------------------------------------
export function ln(page: Page) {
  return page.locator('iframe').nth(1).contentFrame();
}

// ---------------------------------------------------------------------------
// Login + dismiss startup dialog
// ---------------------------------------------------------------------------
export async function login(page: Page) {
  await page.goto(BASE_URL);

  // Dismiss the startup system-message dialog if it appears
  const startupDialog = ln(page).locator('#sysmesdialog-button-n0');
  if (await startupDialog.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await startupDialog.click();
  }

  // Confirm the main navigation tree is visible
  await expect(ln(page).getByText('Planning')).toBeVisible({ timeout: 30_000 });
}

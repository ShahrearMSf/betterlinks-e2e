const { test: setup, expect } = require('@playwright/test');
const { handleEmailVerification, safeGoto } = require('../helpers/utils');
require('dotenv').config();

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

async function attemptLogin(page) {
  await safeGoto(page, '/wp-login.php');

  const userField = page.locator('#user_login');
  const passField = page.locator('#user_pass');
  await userField.waitFor({ state: 'visible', timeout: 30000 });

  await userField.click();
  await userField.fill('');
  await userField.pressSequentially(ADMIN_USER, { delay: 25 });

  await passField.click();
  await passField.fill('');
  await passField.pressSequentially(ADMIN_PASS, { delay: 25 });

  await page.locator('#wp-submit').click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await handleEmailVerification(page);

  // Did it actually land in wp-admin?
  try {
    await page.waitForURL('**/wp-admin/**', { timeout: 20000 });
    return { ok: true, reason: '' };
  } catch (e) {
    const body = await page.locator('body').innerText().catch(() => '');
    return { ok: false, reason: body.slice(0, 200) };
  }
}

setup('authenticate as admin', async ({ page }) => {
  // Live WP with bot/security plugins can transiently respond with
  // "Unknown email address" or similar right after many failed probes.
  // Retry a couple of times with backoff before declaring real failure.
  let last = null;
  for (const backoff of [0, 15_000, 45_000]) {
    if (backoff) await page.waitForTimeout(backoff);
    last = await attemptLogin(page);
    if (last.ok) break;
    console.warn(`[auth.setup] login attempt failed: ${last.reason.replace(/\s+/g, ' ').slice(0, 150)}`);
  }
  expect(last?.ok, `login did not reach wp-admin — last body: ${last?.reason}`).toBe(true);

  await page.context().storageState({ path: 'playwright/.auth/admin.json' });
});

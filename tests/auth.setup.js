const { test: setup, expect } = require('@playwright/test');
const { handleEmailVerification, isOnEmailVerification, safeGoto } = require('../helpers/utils');
require('dotenv').config();

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin';

async function attemptLogin(page) {
  await safeGoto(page, '/wp-login.php');

  const userField = page.locator('#user_login');
  const passField = page.locator('#user_pass');
  await userField.waitFor({ state: 'visible', timeout: 30000 });

  // fill() sets the value in one step. Typing it key by key raced with the
  // page still settling and silently dropped characters — one CI run reported
  // `The username msf@ is not registered on this site`, i.e. the field kept
  // only the first few keystrokes. Verify what actually landed before submit.
  await userField.click();
  await userField.fill(ADMIN_USER);
  await passField.click();
  await passField.fill(ADMIN_PASS);

  const typedUser = await userField.inputValue().catch(() => '');
  if (typedUser !== ADMIN_USER) {
    await userField.fill(ADMIN_USER);
    const retyped = await userField.inputValue().catch(() => '');
    if (retyped !== ADMIN_USER) {
      return { ok: false, reason: `username field holds "${retyped}" instead of the configured user` };
    }
  }

  await page.locator('#wp-submit').click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  // WP can interpose the admin-email interstitial right after a correct login,
  // and it is served from wp-login.php — so waiting for a wp-admin URL without
  // clearing it first always times out.
  for (let i = 0; i < 2 && isOnEmailVerification(page); i++) {
    if (!(await handleEmailVerification(page))) break;
  }
  await handleEmailVerification(page);

  // Did it actually land in wp-admin?
  try {
    await page.waitForURL('**/wp-admin/**', { timeout: 20000 });
    return { ok: true, reason: '' };
  } catch (e) {
    const body = await page.locator('body').innerText().catch(() => '');
    return { ok: false, reason: `url=${page.url()} body=${body.slice(0, 200)}` };
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

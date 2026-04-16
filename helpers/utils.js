/**
 * Common utility functions for BetterLinks E2E tests.
 */

const DB_ERROR_TEXT = 'Error establishing a database connection';
const DB_RETRY_WAIT_MS = 2 * 60 * 1000;

/** Generate a unique slug for test links */
function uniqueSlug(prefix = 'test') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Dismiss WP's "Administration email verification" interstitial if it appears.
 * Ported from notificationx-e2e/helpers/utils.js.
 */
async function handleEmailVerification(page) {
  try {
    const correctEmailBtn = page.locator('a:has-text("correct")').first();
    if (await correctEmailBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await correctEmailBtn.click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
    }
  } catch (e) { /* not on email screen */ }
}

/**
 * Navigate with a retry on "Error establishing a database connection".
 * Waits 2 minutes and retries once — matches the behavior of the sibling
 * notificationx-e2e suite so transient live-site DB hiccups don't fail runs.
 */
async function safeGoto(page, url) {
  await page.goto(url, { timeout: 60000 }).catch(() => null);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await handleEmailVerification(page);

  const bodyText = await page.locator('body').innerText().catch(() => '');
  if (bodyText.toLowerCase().includes(DB_ERROR_TEXT.toLowerCase())) {
    console.warn(`[safeGoto] DB error at ${url}. Waiting 2 min before retry...`);
    await page.waitForTimeout(DB_RETRY_WAIT_MS);
    await page.goto(url, { timeout: 60000 }).catch(() => null);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await handleEmailVerification(page);
    const retryText = await page.locator('body').innerText().catch(() => '');
    if (retryText.toLowerCase().includes(DB_ERROR_TEXT.toLowerCase())) {
      throw new Error(`DB error persists at ${url} after retry`);
    }
  }
}

/** Wait for BetterLinks React app to fully load */
async function waitForAppReady(page) {
  await page.waitForSelector('#betterlinksbody', { state: 'attached', timeout: 30000 });
  // Small buffer for React to finish rendering
  await page.waitForTimeout(1000);
}

/** Navigate to a BetterLinks admin page */
async function navigateTo(page, slug) {
  await safeGoto(page, `/wp-admin/admin.php?page=${slug}`);
  await waitForAppReady(page);
}

/**
 * Wait for BetterLinks custom toast notification.
 * BetterLinks uses its own toast system with classes:
 *   .btl-toast-item .btl-toast-success / .btl-toast-error
 */
async function waitForToast(page, type = 'success') {
  const selector = `.btl-toast-${type}`;
  const toast = page.locator(selector).first();
  await toast.waitFor({ state: 'visible', timeout: 10000 });
  const text = await toast.locator('.btl-toast-message').textContent().catch(() => '');
  return text;
}

/** Dismiss any visible toast */
async function dismissToast(page) {
  const closeBtn = page.locator('.btl-toast-close').first();
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click();
  }
}

/** Click a WordPress admin submenu link */
async function clickSubMenu(page, menuText) {
  await page.locator('#toplevel_page_betterlinks .wp-submenu a', { hasText: menuText }).click();
  await waitForAppReady(page);
}

/** Get today's date in YYYY-MM-DD format */
function today() {
  return new Date().toISOString().split('T')[0];
}

/** Get a date N days ago in YYYY-MM-DD format */
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

module.exports = {
  uniqueSlug,
  waitForAppReady,
  navigateTo,
  safeGoto,
  handleEmailVerification,
  waitForToast,
  dismissToast,
  clickSubMenu,
  today,
  daysAgo,
};

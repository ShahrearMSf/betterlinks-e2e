/**
 * Common utility functions for BetterLinks E2E tests (BetterLinks 3.x UI).
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

/**
 * Wait for the BetterLinks React app to finish its first paint.
 * 3.x lazy-loads every page behind a Suspense fallback (`.betterlinks-loading`),
 * so waiting for the root node alone is not enough.
 */
async function waitForAppReady(page) {
  await page.waitForSelector('#betterlinksbody', { state: 'attached', timeout: 30000 });
  // The Suspense spinner is only mounted while a page chunk is downloading.
  await page.locator('.betterlinks-loading').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1200);
}

/** Navigate to a BetterLinks admin page */
async function navigateTo(page, slug) {
  await safeGoto(page, `/wp-admin/admin.php?page=${slug}`);
  await waitForAppReady(page);
}

/**
 * Wait for a BetterLinks toast notification.
 * Unchanged across 2.x → 3.x: `.btl-toast-item .btl-toast-success/.btl-toast-error`.
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

/**
 * Dismiss the "BetterLinks Pro 3.0 New UI is here!" admin notice, which
 * overlaps the top of every page and can intercept clicks.
 */
async function dismissAdminNotice(page) {
  const dismiss = page.locator('.btl-dashboard-notice .notice-dismiss').first();
  if (await dismiss.isVisible({ timeout: 1500 }).catch(() => false)) {
    await dismiss.click().catch(() => {});
    await page.waitForTimeout(300);
  }
}

/** Click a WordPress admin submenu link */
async function clickSubMenu(page, menuText) {
  await page.locator('#toplevel_page_betterlinks .wp-submenu a', { hasText: menuText }).click();
  await waitForAppReady(page);
}

/**
 * Pick an option in one of the react-select dropdowns used throughout the 3.x
 * UI (redirect type, category, tags, filters). `control` is a locator for the
 * `.btl-react-select__control` / `.bl-rs__control` element.
 */
async function selectReactOption(page, control, optionText) {
  await control.click();
  await page.waitForTimeout(400);
  const option = page
    .locator('[class*="-option"], .bl-opt__label, [id^="react-select"][id*="option"]')
    .filter({ hasText: new RegExp(optionText, 'i') })
    .first();
  if (await option.isVisible({ timeout: 4000 }).catch(() => false)) {
    await option.click();
    await page.waitForTimeout(300);
    return true;
  }
  // Fall back to typing + Enter for creatable selects (tags).
  await page.keyboard.type(optionText);
  await page.waitForTimeout(600);
  await page.keyboard.press('Enter');
  return false;
}

/**
 * Toggle one of the hidden `input.btl-check` checkboxes in the link drawer by
 * clicking its wrapping label (the input itself is visually hidden by CSS).
 */
async function setCheckbox(page, name, enabled, scope = '.bl-drawer') {
  const isChecked = await page.evaluate(
    ([name, scope]) => {
      const input = document.querySelector(`${scope} input.btl-check[name="${name}"]`);
      return input ? input.checked : null;
    },
    [name, scope]
  );
  if (isChecked === null) return false;
  if (isChecked !== enabled) {
    await page.evaluate(
      ([name, scope]) => {
        const input = document.querySelector(`${scope} input.btl-check[name="${name}"]`);
        if (input) (input.closest('label') || input).click();
      },
      [name, scope]
    );
    await page.waitForTimeout(250);
  }
  return true;
}

/** Read a hidden `input.btl-check` value inside a scope. */
async function isChecked(page, name, scope = '.bl-drawer') {
  return page.evaluate(
    ([name, scope]) => {
      const input = document.querySelector(`${scope} input.btl-check[name="${name}"]`);
      return input ? input.checked : false;
    },
    [name, scope]
  );
}

/** Expand a collapsible link-drawer panel ("Link Options" / "Advanced" / …). */
async function expandDrawerPanel(page, title) {
  const panel = page.locator('.link-options').filter({ hasText: new RegExp(title, 'i') }).first();
  if (!(await panel.isVisible({ timeout: 3000 }).catch(() => false))) return false;
  const isOpen = await panel.evaluate((el) => el.className.includes('link-options--open'));
  if (!isOpen) {
    await panel.locator('.link-options__head').first().click();
    await page.waitForTimeout(500);
  }
  return true;
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
  dismissAdminNotice,
  clickSubMenu,
  selectReactOption,
  setCheckbox,
  isChecked,
  expandDrawerPanel,
  today,
  daysAgo,
};

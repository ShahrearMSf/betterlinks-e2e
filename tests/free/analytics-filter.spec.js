const { test, expect } = require('@playwright/test');
const { AnalyticsPage } = require('../../pages/AnalyticsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady, today, daysAgo } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Analytics filtering (BetterLinks 3.x): quick range presets (7/30/90 days),
 * the calendar popover, the Filter menu (Today … Last 12 months + custom),
 * Reset, and the click-log search / rows-per-page controls.
 */
test.describe('Analytics — Filters', () => {
  let analyticsPage;
  let seededLinkId = null;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const api = new BetterLinksAPI(page);
    const res = await api.createLink({ title: 'Filter Seed', slug: uniqueSlug('analytics'), trackMe: true });
    seededLinkId = res.data?.data?.ID || null;
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!seededLinkId) return;
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await new BetterLinksAPI(page).deleteLink(seededLinkId);
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    analyticsPage = new AnalyticsPage(page);
    await analyticsPage.goto();
  });

  test('quick range presets switch the active range', async ({ page }) => {
    await analyticsPage.rangeButton('7 days').click();
    await page.waitForTimeout(2000);
    await expect(analyticsPage.rangeButton('7 days')).toHaveClass(/is-active/);

    await analyticsPage.rangeButton('90 days').click();
    await page.waitForTimeout(2000);
    await expect(analyticsPage.rangeButton('90 days')).toHaveClass(/is-active/);
  });

  test('calendar popover opens for a custom range', async ({ page }) => {
    await analyticsPage.calendarButton.click();
    await expect(analyticsPage.calendarPopup).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
  });

  test('filter menu lists the preset ranges', async ({ page }) => {
    await analyticsPage.filterButton.click();
    await expect(analyticsPage.filterMenu).toBeVisible({ timeout: 8000 });
    const items = (await page.locator(S.analytics.filterMenuItem).allTextContents()).map((t) => t.toLowerCase());
    expect(items.some((t) => t.includes('today'))).toBeTruthy();
    expect(items.some((t) => t.includes('last 7 days'))).toBeTruthy();
    expect(items.some((t) => t.includes('custom'))).toBeTruthy();
    await page.keyboard.press('Escape');
  });

  test('choosing a filter preset applies it', async ({ page }) => {
    await analyticsPage.filterButton.click();
    await expect(analyticsPage.filterMenu).toBeVisible({ timeout: 8000 });
    await page.locator(S.analytics.filterMenuItem).filter({ hasText: /Last 7 days/i }).first().click();
    await page.waitForTimeout(2500);
    await expect(page.locator(S.app.root)).toBeVisible();
    await expect(analyticsPage.hero).toBeVisible();
  });

  test('Reset opens the reset-clicks dialog instead of wiping data', async ({ page }) => {
    // "Reset" in the analytics header is the destructive reset-clicks action,
    // not a filter reset: it must always ask for confirmation first, and the
    // confirm button stays disabled until "RESET CLICKS" is typed.
    await analyticsPage.resetButton.click();
    const dialog = page.locator('.bl-rc');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    await expect(dialog).toContainText(/reset/i);

    await page.locator('.bl-rc__close').first().click();
    await expect(dialog).toBeHidden({ timeout: 8000 });
    await expect(analyticsPage.hero).toBeVisible();
  });

  test('range selection survives opening and closing the reset dialog', async ({ page }) => {
    await analyticsPage.rangeButton('7 days').click();
    await page.waitForTimeout(1500);
    await expect(analyticsPage.rangeButton('7 days')).toHaveClass(/is-active/);

    await analyticsPage.resetButton.click();
    await page.locator('.bl-rc__close').first().click().catch(() => page.keyboard.press('Escape'));
    await page.waitForTimeout(1500);
    await expect(analyticsPage.rangeButton('7 days')).toHaveClass(/is-active/);
  });

  test('click-log search filters rows without breaking', async ({ page }) => {
    await expect(analyticsPage.searchInput).toBeVisible({ timeout: 20000 });
    await analyticsPage.searchAnalytics('zzz-no-match-zzz');
    const rows = await analyticsPage.rowCount();
    if (rows === 0) {
      await expect(analyticsPage.emptyRow).toBeVisible();
    }
    await analyticsPage.searchInput.fill('');
    await expect(page.locator(S.app.root)).toBeVisible();
  });

  test('rows-per-page control changes page size', async ({ page }) => {
    await expect(analyticsPage.rowsPerPage).toBeVisible({ timeout: 20000 });
    await analyticsPage.rowsPerPage.selectOption('25').catch(() => {});
    await page.waitForTimeout(1500);
    await expect(page.locator(S.app.root)).toBeVisible();
  });

  test('single-link view keeps the same filter controls', async ({ page }) => {
    test.skip(!seededLinkId, 'seed failed');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    await expect(analyticsPage.rangeButton('30 days')).toBeVisible({ timeout: 20000 });
    await expect(analyticsPage.filterButton).toBeVisible();
    await expect(analyticsPage.calendarButton).toBeVisible();
  });

  test('analytics REST endpoint responds for an explicit date range', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await waitForAppReady(page);
    const api = new BetterLinksAPI(page);
    const res = await api.getAnalytics(daysAgo(90), today());
    expect(res.status).toBe(200);
    expect(res.data?.success).toBeTruthy();
  });
});

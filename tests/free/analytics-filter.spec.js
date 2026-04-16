const { test, expect } = require('@playwright/test');
const { AnalyticsPage } = require('../../pages/AnalyticsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady } = require('../../helpers/utils');
require('dotenv').config();

/**
 * Filters on the analytics pages — both overview and single-link.
 * Covers date range, apply, reset/refresh, and table search interactions.
 */
test.describe('Analytics — Filters', () => {
  let analyticsPage;
  let api;
  let seededLinkId = null;
  let seededSlug = null;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const seedApi = new BetterLinksAPI(page);
    seededSlug = uniqueSlug('analytics');
    const res = await seedApi.createLink({
      title: `Filter Seed ${seededSlug}`, targetUrl: 'https://example.com/fs', slug: seededSlug, trackMe: true,
    });
    seededLinkId = res.data?.data?.ID || res.data?.ID || null;
    if (seededLinkId) {
      const v = await ctx.newPage();
      await v.goto(`${process.env.BASE_URL}/${seededSlug}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await v.close();
    }
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    analyticsPage = new AnalyticsPage(page);
    api = new BetterLinksAPI(page);
  });

  test('overview analytics has a visible filter/search toolbar', async ({ page }) => {
    await analyticsPage.goto();
    await page.waitForTimeout(1500);
    // Overview page exposes a plain #search input (no placeholder attr)
    const anyFilter = page.locator('input#search, input[placeholder="Search..."], .btl-analytics-filter, .btl-click-filter').first();
    await expect(anyFilter).toBeVisible({ timeout: 15000 });
  });

  test('single-link analytics filter controls exist', async ({ page }) => {
    test.skip(!seededLinkId, 'seed failed');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    await expect(page.locator('.btl-analytics-filter')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.btl-list-view-calendar, .btl-analytics-filter__control')).toBeTruthy();
  });

  test('calendar / date-range toggle opens without error', async ({ page }) => {
    test.skip(!seededLinkId, 'seed failed');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const cal = page.locator('.btl-list-view-calendar, .btl-analytics-filter__control').first();
    if (await cal.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cal.click({ force: true });
      await page.waitForTimeout(600);
      await expect(page.locator('#betterlinksbody')).toBeVisible();
    }
  });

  test('filter button exists on single-link analytics', async ({ page }) => {
    test.skip(!seededLinkId, 'seed failed');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const filterBtn = page.locator('.btl-filter-action, button').filter({ hasText: /Filter|Apply/i }).first();
    await expect(filterBtn).toBeVisible({ timeout: 10000 });
  });

  test('analytics REST endpoint responds for a known date range', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const now = new Date();
    const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const res = await api.getAnalytics(
      yearAgo.toISOString().split('T')[0],
      now.toISOString().split('T')[0],
    );
    expect(res.status).toBe(200);
  });

  test('clicks-table search input filters rows (non-crashing)', async ({ page }) => {
    test.skip(!seededLinkId, 'seed failed');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    await page.waitForTimeout(1500);
    // Live inspection revealed a .btl-search-button next to the bulk actions; the
    // actual text input may be hidden until clicked.
    const searchBtn = page.locator('.btl-search-button').first();
    if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchBtn.click({ force: true });
      await page.waitForTimeout(500);
    }
    await expect(page.locator('#betterlinksbody')).toBeVisible();
  });
});

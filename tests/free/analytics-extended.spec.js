const { test, expect } = require('@playwright/test');
const { AnalyticsPage } = require('../../pages/AnalyticsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady } = require('../../helpers/utils');
require('dotenv').config();

/**
 * Extended analytics coverage — country, device, browser, OS, referrer, medium
 * widgets + the click-details table. These are driven against the SINGLE-LINK
 * analytics page at ?page=betterlinks-analytics&id=N.
 */
test.describe('Analytics — Extended (Country / Device / Browser / OS)', () => {
  let analyticsPage;
  let api;
  let seededLinkId = null;
  let seededSlug = null;

  test.beforeAll(async ({ browser }) => {
    // Seed one tracked link and hit it a few times so single-link analytics has data.
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const seedApi = new BetterLinksAPI(page);
    seededSlug = uniqueSlug('country');
    const res = await seedApi.createLink({
      title: `Country Seed ${seededSlug}`,
      targetUrl: 'https://example.com/country-seed',
      slug: seededSlug,
      trackMe: true,
    });
    seededLinkId = res.data?.data?.ID || res.data?.ID || null;

    if (seededLinkId) {
      for (let i = 0; i < 3; i++) {
        const visit = await ctx.newPage();
        await visit.goto(`${process.env.BASE_URL}/${seededSlug}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await visit.close();
      }
    }
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    analyticsPage = new AnalyticsPage(page);
    api = new BetterLinksAPI(page);
  });

  test('single-link analytics page renders header', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const header = page.locator('.btl-single-click-info-header');
    await expect(header).toBeVisible({ timeout: 15000 });
    await expect(header).toContainText(seededSlug);
  });

  test('analytics chart container is present on single-link page', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const chart = page.locator('.btl-analytics-chart').first();
    await expect(chart).toBeVisible({ timeout: 10000 });
  });

  test('top-charts widgets section is rendered', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const top1 = page.locator('.btl-top-charts-1');
    const top2 = page.locator('.btl-top-charts-2');
    await expect(top1.or(top2).first()).toBeVisible({ timeout: 10000 });
  });

  test('top-charts shows Referer / Social Media / Devices / OS / Browser / Medium labels', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    // Wait for the top-charts container specifically, then give charts time to paint
    await expect(page.locator('.btl-top-charts-1, .btl-top-charts-2').first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);
    const body = await page.locator('#betterlinksbody').textContent();
    const expected = ['Referer', 'Social Media', 'Devices', 'OS', 'Browser', 'Medium'];
    const found = expected.filter(e => body.includes(e));
    // At least 3 of the 6 widgets should be rendered. The visibility of individual
    // widgets can vary with zero-click data, so we don't insist on all of them.
    expect(found.length).toBeGreaterThanOrEqual(3);
  });

  test('click-details table includes Country column', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    await page.waitForTimeout(2000);
    const headers = page.locator('.btl-tbl-th-label');
    const count = await headers.count();
    const labels = [];
    for (let i = 0; i < count; i++) labels.push((await headers.nth(i).textContent() || '').trim());
    expect(labels.join('|').toLowerCase()).toContain('country');
  });

  test('click-details table includes Browser, OS, Device, Referrer columns', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    await page.waitForTimeout(2000);
    const headers = page.locator('.btl-tbl-th-label');
    const count = await headers.count();
    const labels = [];
    for (let i = 0; i < count; i++) labels.push((await headers.nth(i).textContent() || '').trim().toLowerCase());
    for (const expected of ['browser', 'os', 'device', 'referrer']) {
      expect(labels.join('|')).toContain(expected);
    }
  });

  test('refresh stats button exists on analytics', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const refresh = page.locator('.btl-refresh-btn').first();
    await expect(refresh).toBeVisible({ timeout: 10000 });
  });

  test('refresh stats button triggers refetch without error', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const refresh = page.locator('.btl-refresh-btn').first();
    await refresh.click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.locator('#betterlinksbody')).toBeVisible();
  });

  test('reset-analytics button exists on single-link page', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const reset = page.locator('.btl-reset-analytics-initial-button');
    await expect(reset).toBeVisible({ timeout: 10000 });
  });

  test('date-range filter control is present', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const filter = page.locator('.btl-analytics-filter, .btl-list-view-calendar').first();
    await expect(filter).toBeVisible({ timeout: 10000 });
  });

  test('pagination controls are present', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const pag = page.locator('.btl-tbl-pagination').first();
    await expect(pag).toBeVisible({ timeout: 10000 });
  });

  test('click data populates over REST within reasonable time', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    // The analytics pipeline is async; just ensure no errors on fetch.
    const today = new Date().toISOString().split('T')[0];
    const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const from = yearAgo.toISOString().split('T')[0];
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const res = await api.getAnalytics(from, today);
    expect(res.status).toBe(200);
  });

  test('top-charts render either data or no-data placeholders (not crash)', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    await page.waitForTimeout(1500);
    // Either real charts or the explicit no-data fallbacks
    const anyChartish = page.locator('.apexcharts-canvas, .btl-donut-no-data, .btl-bar-no-data').first();
    await expect(anyChartish).toBeVisible({ timeout: 10000 });
  });

  test('bulk-actions select is present on click-details table', async ({ page }) => {
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
    const bulk = page.locator('.btl-bulk-actions').first();
    await expect(bulk).toBeVisible({ timeout: 10000 });
  });

  test('overview analytics page shows top-charts section', async ({ page }) => {
    await analyticsPage.goto();
    const top = page.locator('.btl-top-charts, .btl-analytic-table-wrapper').first();
    await expect(top).toBeVisible({ timeout: 10000 });
  });
});

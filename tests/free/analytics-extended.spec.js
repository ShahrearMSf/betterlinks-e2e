const { test, expect } = require('@playwright/test');
const { AnalyticsPage } = require('../../pages/AnalyticsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady, today, daysAgo } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Single-link analytics (BetterLinks 3.x): `?page=betterlinks-analytics&id=N`.
 *
 * The view is `.bl-an--single` — an identity card (`.bl-slc`), a stat strip
 * (`.bl-sov`), the Geography / Sources / Technology / Timing sections and the
 * click log (`.bl-clog`) whose columns include Country, Browser, OS, Device,
 * Referrer, User agent and Parameters.
 */
test.describe('Analytics — single link view', () => {
  let analyticsPage;
  let seededLinkId = null;
  let seededSlug = null;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const seedApi = new BetterLinksAPI(page);
    seededSlug = uniqueSlug('country');
    const res = await seedApi.createLink({
      title: `Country Seed ${seededSlug}`,
      targetUrl: 'https://example.com/country-seed',
      slug: seededSlug,
      trackMe: true,
    });
    seededLinkId = res.data?.data?.ID || null;

    // Generate a few hits so the view has something to aggregate.
    if (seededLinkId) {
      const visitorCtx = await browser.newContext({
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      });
      for (let i = 0; i < 3; i++) {
        const visit = await visitorCtx.newPage();
        await visit.goto(`${process.env.BASE_URL}/${seededSlug}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await visit.close();
      }
      await visitorCtx.close();
    }
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
    test.skip(!seededLinkId, 'seed link not created');
    await analyticsPage.gotoLinkAnalytics(seededLinkId);
  });

  test('single-link view renders the link identity card', async ({ page }) => {
    await expect(page.locator('.bl-an--single')).toBeVisible({ timeout: 20000 });
    const card = analyticsPage.singleCard;
    await expect(card).toBeVisible();
    await expect(card).toContainText(seededSlug);
    await expect(card).toContainText('https://example.com/country-seed');
  });

  test('header offers Back, range presets, Reset, Refresh Stats and Export', async ({ page }) => {
    await expect(page.locator(S.analytics.backButton)).toBeVisible();
    await expect(analyticsPage.rangeButton('30 days')).toBeVisible();
    await expect(analyticsPage.resetButton).toBeVisible();
    await expect(analyticsPage.refreshButton).toBeVisible();
    await expect(analyticsPage.exportButton).toBeVisible();
  });

  test('stat strip shows total / unique clicks and top country / device', async ({ page }) => {
    const stats = page.locator('.bl-sov__stats');
    await expect(stats).toBeVisible({ timeout: 20000 });
    const text = ((await stats.textContent()) || '').toUpperCase();
    expect(text).toContain('TOTAL CLICKS');
    expect(text).toContain('UNIQUE CLICKS');
    expect(text.includes('TOP COUNTRY') || text.includes('TOP DEVICE')).toBeTruthy();
  });

  test('clicks-over-time chart is rendered', async ({ page }) => {
    await expect(page.locator('.bl-sov__chart')).toBeVisible({ timeout: 20000 });
    await expect(analyticsPage.chart).toBeVisible({ timeout: 20000 });
  });

  test('Geography / Sources / Technology / Timing sections are present', async () => {
    const titles = (await analyticsPage.sectionTitles()).map((t) => t.toUpperCase());
    for (const expected of ['GEOGRAPHY', 'TRAFFIC SOURCES', 'TECHNOLOGY', 'TIMING', 'CLICK LOG']) {
      expect(titles.some((t) => t.includes(expected))).toBeTruthy();
    }
  });

  test('breakdown widgets render data or an explicit no-data state', async ({ page }) => {
    // Referrers / social / channels / devices / OS / browser are `.bl-bars`.
    const bars = page.locator(S.analytics.bars);
    expect(await bars.count()).toBeGreaterThanOrEqual(3);
    const first = bars.first();
    await expect(first).toBeVisible();
    const hasState = await first.locator('.bl-bars__state').isVisible().catch(() => false);
    const hasRows = await first.locator('.bl-bars__row, .bl-bars__item').count();
    expect(hasState || hasRows > 0).toBeTruthy();
  });

  test('world map and timing heatmap render', async ({ page }) => {
    await expect(page.locator(S.analytics.geography)).toBeVisible({ timeout: 20000 });
    await expect(page.locator(S.analytics.heatmap)).toBeVisible({ timeout: 20000 });
  });

  test('click log includes Country, Browser, OS, Device and Referrer columns', async () => {
    const headers = (await analyticsPage.columnHeaders()).map((h) => h.toLowerCase());
    for (const expected of ['country', 'browser', 'os', 'device', 'referrer']) {
      expect(headers.join('|')).toContain(expected);
    }
  });

  test('click log exposes user agent and parameters columns', async () => {
    const headers = (await analyticsPage.columnHeaders()).map((h) => h.toLowerCase()).join('|');
    expect(headers).toContain('user agent');
    expect(headers).toContain('parameters');
  });

  test('bulk actions and column picker are available on the click log', async ({ page }) => {
    await expect(analyticsPage.bulkSelect).toBeVisible();
    await expect(analyticsPage.columnsButton).toBeVisible();
    await analyticsPage.columnsButton.click();
    await expect(page.locator(S.analytics.columnsMenu)).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
  });

  test('rows-per-page and pager controls are present', async () => {
    await expect(analyticsPage.rowsPerPage).toBeVisible();
    await expect(analyticsPage.pager).toBeVisible();
  });

  test('Refresh Stats re-runs without error', async ({ page }) => {
    await analyticsPage.refreshButton.click();
    await page.waitForTimeout(3000);
    await expect(page.locator(S.app.root)).toBeVisible();
    await expect(page.locator('.bl-an--single')).toBeVisible();
  });

  test('range presets re-query the single-link view', async ({ page }) => {
    await analyticsPage.rangeButton('7 days').click();
    await page.waitForTimeout(2500);
    await expect(analyticsPage.rangeButton('7 days')).toHaveClass(/is-active/);
    await expect(page.locator('.bl-an--single')).toBeVisible();
  });

  test('single-link analytics REST endpoint responds', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await waitForAppReady(page);
    const api = new BetterLinksAPI(page);
    const res = await api.getIndividualAnalytics(seededLinkId, daysAgo(30), today());
    // A 500 here means the Pro endpoint fataled — see Helper::sanitize_date().
    expect(res.status, 'clicks/individual/{id} should not return a server error').toBe(200);
  });

  test('country / medium REST endpoints respond', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await waitForAppReady(page);
    const api = new BetterLinksAPI(page);
    expect((await api.getCountries(daysAgo(30), today())).status).toBe(200);
    expect((await api.getMedium(daysAgo(30), today())).status).toBe(200);
  });
});

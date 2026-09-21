const { test, expect } = require('@playwright/test');
const { AnalyticsPage } = require('../../pages/AnalyticsPage');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, today, daysAgo, waitForAppReady } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Analytics dashboard — BetterLinks 3.x.
 *
 * 3.0 replaced the old top-bar + top-charts layout with one scrolling page of
 * seven sections (Overview / Geography / Sources / Technology / Timing /
 * Attention / Links) driven by `.bl-an__nav`.
 */
test.describe('Analytics Dashboard', () => {
  let analyticsPage;

  test.beforeEach(async ({ page }) => {
    analyticsPage = new AnalyticsPage(page);
    await analyticsPage.goto();
  });

  test('should load the Analytics page', async ({ page }) => {
    await expect(page.locator(S.app.root)).toBeVisible();
    await expect(page).toHaveURL(/betterlinks-analytics/);
    await expect(analyticsPage.heading).toContainText(/Analytics/i);
  });

  test('header exposes range presets, filter, reset, refresh and export', async () => {
    await expect(analyticsPage.rangeButton('7 days')).toBeVisible();
    await expect(analyticsPage.rangeButton('30 days')).toBeVisible();
    await expect(analyticsPage.rangeButton('90 days')).toBeVisible();
    await expect(analyticsPage.filterButton).toBeVisible();
    await expect(analyticsPage.resetButton).toBeVisible();
    await expect(analyticsPage.refreshButton).toBeVisible();
    await expect(analyticsPage.exportButton).toBeVisible();
  });

  test('section nav lists all seven analytics sections', async () => {
    const tabs = (await analyticsPage.tabs.allTextContents()).map((t) => t.trim());
    for (const section of AnalyticsPage.SECTIONS) {
      expect(tabs.some((t) => t.startsWith(section))).toBeTruthy();
    }
  });

  test('every section renders on the page', async () => {
    const titles = (await analyticsPage.sectionTitles()).map((t) => t.toUpperCase());
    for (const expected of ['OVERVIEW', 'GEOGRAPHY', 'SOURCES', 'TECHNOLOGY', 'TIMING', 'PER-LINK PERFORMANCE']) {
      expect(titles.some((t) => t.includes(expected))).toBeTruthy();
    }
  });

  test('should display the clicks-over-time chart', async ({ page }) => {
    await expect(analyticsPage.hero).toBeVisible({ timeout: 20000 });
    await expect(analyticsPage.chart).toBeVisible({ timeout: 20000 });
    await expect(page.locator(S.analytics.statCard).first()).toBeVisible();
  });

  test('clicking a section pill scrolls to that section', async ({ page }) => {
    await analyticsPage.openSection('Technology');
    await expect(page.locator(S.app.root)).toBeVisible();
    await expect(page.locator(`${S.analytics.tab}.is-active`)).toHaveCount(1);
  });

  test('per-link performance table renders with its toolbar', async () => {
    // The dashboard's "Links" section uses the generic `.bl-tbl` shell; the
    // full click log (`.bl-clog`) only exists on the single-link view.
    await expect(analyticsPage.table).toBeVisible({ timeout: 20000 });
    await expect(analyticsPage.dataTable).toBeVisible();
    await expect(analyticsPage.searchInput).toBeVisible();
    await expect(analyticsPage.bulkSelect).toBeVisible();
  });

  test('should show a no-data state when a range has no clicks', async ({ page }) => {
    await analyticsPage.rangeButton('7 days').click();
    // The section re-renders (skeleton first), so wait for the table shell to
    // settle before deciding whether it has rows.
    await expect(analyticsPage.table).toBeVisible({ timeout: 25000 });
    await expect(analyticsPage.dataTable).toBeVisible({ timeout: 25000 });
    await page.waitForTimeout(1500);

    const rows = await analyticsPage.rowCount();
    expect(rows, 'the table always renders at least one row — data or the empty row').toBeGreaterThan(0);

    if (await analyticsPage.emptyRow.isVisible().catch(() => false)) {
      await expect(analyticsPage.emptyRow).toContainText(/No link|No clicks/i);
    }
  });

  test('table search accepts input without breaking the page', async ({ page }) => {
    await analyticsPage.searchAnalytics('no-such-click-value');
    await expect(page.locator(S.app.root)).toBeVisible();
    await analyticsPage.searchInput.fill('');
  });

  test('navigating to a single link opens its analytics view', async ({ page }) => {
    const api = new BetterLinksAPI(page);
    const slug = uniqueSlug('analytics');
    const res = await api.createLink({ title: `Analytics Seed ${slug}`, slug, trackMe: true });
    const id = res.data?.data?.ID;
    expect(id, 'seed link should be created').toBeTruthy();

    await analyticsPage.gotoLinkAnalytics(id);
    await expect(page.locator('.bl-an--single')).toBeVisible({ timeout: 20000 });
    await expect(analyticsPage.singleCard).toContainText(slug);

    await api.deleteLink(id);
  });

  test('board card click counter links to the single-link view', async ({ page }) => {
    const api = new BetterLinksAPI(page);
    const slug = uniqueSlug('analytics');
    const title = `Analytics Link ${slug}`;
    const res = await api.createLink({ title, slug, trackMe: true });
    const id = res.data?.data?.ID;

    const linksPage = new ManageLinksPage(page);
    await linksPage.goto();
    await linksPage.searchLink(slug);
    const counter = linksPage.card(title).locator(S.manageLinks.cardClicks).first();
    await expect(counter).toBeVisible({ timeout: 15000 });
    await expect(counter).toHaveAttribute('href', new RegExp(`id=${id}`));

    await api.deleteLink(id);
  });

  test('overview analytics REST endpoint responds for a date range', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await waitForAppReady(page);
    const api = new BetterLinksAPI(page);
    const res = await api.getAnalytics(daysAgo(30), today());
    expect(res.status).toBe(200);
    expect(res.data?.success).toBeTruthy();
  });

  test('chart / audience / timing REST endpoints respond', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await waitForAppReady(page);
    const api = new BetterLinksAPI(page);
    for (const call of [api.getCharts(daysAgo(30), today()), api.getGraphs(daysAgo(30), today()), api.getAudience(daysAgo(30), today())]) {
      const res = await call;
      expect(res.status).toBe(200);
    }
  });
});

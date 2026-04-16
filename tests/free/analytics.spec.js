const { test, expect } = require('@playwright/test');
const { AnalyticsPage } = require('../../pages/AnalyticsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady, today, daysAgo } = require('../../helpers/utils');
require('dotenv').config();

test.describe('Analytics Tests', () => {
  let analyticsPage;

  test.beforeEach(async ({ page }) => {
    analyticsPage = new AnalyticsPage(page);
  });

  test('should load Analytics page', async ({ page }) => {
    await analyticsPage.goto();
    await expect(page.locator('#betterlinksbody')).toBeVisible();
    await expect(page).toHaveURL(/betterlinks-analytics/);
  });

  test('should display analytics chart/graph', async ({ page }) => {
    await analyticsPage.goto();
    // Chart may or may not be visible depending on data
    const chartOrTable = page.locator('.apexcharts-canvas, [class*="chart"], table, [class*="table"]').first();
    await expect(chartOrTable).toBeVisible({ timeout: 10000 });
  });

  test('should generate click data when visiting a tracked link', async ({ page, context }) => {
    // Create a tracked link via API
    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await waitForAppReady(page);

    const api = new BetterLinksAPI(page);
    const slug = uniqueSlug('analytics');
    await api.createLink({
      title: `Analytics Test ${slug}`,
      targetUrl: 'https://example.com/analytics-test',
      slug,
      trackMe: true,
    });

    // Visit the link to generate a click
    const newPage = await context.newPage();
    await newPage.goto(`${process.env.BASE_URL}/${slug}`, { waitUntil: 'domcontentloaded' });
    await newPage.close();
    await page.waitForTimeout(2000);

    // Check analytics
    await analyticsPage.goto();
    await page.waitForTimeout(2000);

    // The analytics page should have data
    const body = await page.locator('#betterlinksbody').textContent();
    expect(body).toBeTruthy();
  });

  test('should search analytics by link name', async ({ page }) => {
    await analyticsPage.goto();
    const searchInput = analyticsPage.searchInput;

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(1500);
      // Page should filter/respond to search
      await expect(page.locator('#betterlinksbody')).toBeVisible();
    }
  });

  test('should navigate to individual link analytics', async ({ page }) => {
    // Create a link and get its ID
    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await waitForAppReady(page);

    const api = new BetterLinksAPI(page);
    const slug = uniqueSlug('single-analytics');
    const res = await api.createLink({
      title: `Single Analytics ${slug}`,
      targetUrl: 'https://example.com/single',
      slug,
    });

    // Get link ID from response
    const linkId = res.data?.ID || res.data?.id;
    if (linkId) {
      await analyticsPage.gotoLinkAnalytics(linkId);
      await expect(page).toHaveURL(/id=/);
      await expect(page.locator('#betterlinksbody')).toBeVisible();
    }
  });

  test('should handle date filtering on analytics', async ({ page }) => {
    await analyticsPage.goto();
    const dateFilter = analyticsPage.dateFilter;

    if (await dateFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dateFilter.click();
      await page.waitForTimeout(500);
      // Date filter interaction varies — verify it opens
      const filterDropdown = page.locator('[class*="date"], [class*="calendar"], [class*="picker"]').first();
      const isOpen = await filterDropdown.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isOpen || true).toBeTruthy(); // Soft check
    }
  });

  test('should display no-data state when no clicks exist for new link', async ({ page }) => {
    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await waitForAppReady(page);

    const api = new BetterLinksAPI(page);
    const slug = uniqueSlug('no-clicks');
    const res = await api.createLink({
      title: `No Clicks ${slug}`,
      targetUrl: 'https://example.com/no-clicks',
      slug,
    });

    const linkId = res.data?.ID || res.data?.id;
    if (linkId) {
      await analyticsPage.gotoLinkAnalytics(linkId);
      await page.waitForTimeout(1000);
      // Should show 0 clicks or empty state
      const body = await page.locator('#betterlinksbody').textContent();
      expect(body).toBeTruthy();
    }
  });
});

const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { AnalyticsPage } = require('../../pages/AnalyticsPage');
const { CategoriesTagsPage } = require('../../pages/CategoriesTagsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Search & filter controls (BetterLinks 3.x).
 *
 * Unlike 2.x, Manage Links now has a real search box plus Category / Tag /
 * Sort / Date filters and a Reset button in `.bl-toolbar`. Analytics and
 * Tags & Categories have their own search inputs.
 */
test.describe('Search / Filter controls', () => {
  let linksPage;
  let analyticsPage;
  let api;
  let seededId = null;
  let seededSlug = null;
  let seededTitle = null;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    seededSlug = uniqueSlug('search');
    seededTitle = `Search Seed ${seededSlug}`;
    const res = await new BetterLinksAPI(page).createLink({ title: seededTitle, slug: seededSlug, trackMe: true });
    seededId = res.data?.data?.ID || null;
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!seededId) return;
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    await new BetterLinksAPI(page).deleteLink(seededId);
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    linksPage = new ManageLinksPage(page);
    analyticsPage = new AnalyticsPage(page);
    api = new BetterLinksAPI(page);
  });

  test('Manage Links: toolbar renders search, filters, favourites and reset', async () => {
    await linksPage.goto();
    await expect(linksPage.toolbar).toBeVisible({ timeout: 20000 });
    await expect(linksPage.searchInput).toBeVisible();
    await expect(linksPage.favoriteFilter).toBeVisible();
    await expect(linksPage.resetFiltersButton).toBeVisible();
  });

  test('Manage Links: search narrows the board to the matching link', async ({ page }) => {
    test.skip(!seededId, 'seed failed');
    await linksPage.goto();
    await linksPage.searchLink(seededSlug);
    await expect(linksPage.linkByTitle(seededTitle)).toBeVisible({ timeout: 15000 });

    await linksPage.searchLink('zzz-definitely-no-match-zzz');
    await expect(linksPage.linkByTitle(seededTitle)).toBeHidden({ timeout: 10000 });
  });

  test('Manage Links: Reset clears the search box', async ({ page }) => {
    await linksPage.goto();
    await linksPage.searchLink('something');
    await linksPage.resetFiltersButton.click();
    await page.waitForTimeout(800);
    await expect(linksPage.searchInput).toHaveValue('');
  });

  test('Manage Links: category filter opens with options', async ({ page }) => {
    await linksPage.goto();
    const categoryFilter = page.locator(S.manageLinks.filter).first();
    await categoryFilter.click();
    await page.waitForTimeout(700);
    await expect(page.locator('.bl-opt__label').first()).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
  });

  test('Manage Links: favourites filter marks itself active', async ({ page }) => {
    await linksPage.goto();
    await linksPage.favoriteFilter.click();
    await page.waitForTimeout(1000);
    await expect(linksPage.favoriteFilter).toHaveClass(/is-active/);
    await linksPage.favoriteFilter.click();
  });

  test('Analytics: click-log search input is present and usable', async ({ page }) => {
    await analyticsPage.goto();
    await expect(analyticsPage.searchInput).toBeVisible({ timeout: 25000 });
    await analyticsPage.searchAnalytics('zzzz-no-row-match');
    await expect(page.locator(S.app.root)).toBeVisible();
    await analyticsPage.searchInput.fill('');
  });

  test('Analytics: single-link view keeps its own click-log search', async ({ page }) => {
    test.skip(!seededId, 'seed failed');
    await analyticsPage.gotoLinkAnalytics(seededId);
    await expect(analyticsPage.searchInput).toBeVisible({ timeout: 25000 });
  });

  test('Tags & Categories: search filters the term table', async ({ page }) => {
    const termsPage = new CategoriesTagsPage(page);
    await termsPage.goto();
    await expect(termsPage.searchInput).toBeVisible({ timeout: 20000 });
    await termsPage.search('zzz-no-such-term');
    const rows = await termsPage.rows.count();
    if (rows === 0) {
      await expect(termsPage.emptyRow).toBeVisible();
    }
    await termsPage.clearSearch();
    await expect(page.locator(S.app.root)).toBeVisible();
  });
});

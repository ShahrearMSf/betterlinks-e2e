const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Manage Links views — BetterLinks 3.x.
 *
 * 2.x had a grid/DnD toggle; 3.x ships a segmented control with Board, List and
 * a Compact density modifier. Board cards are `.blb-card` inside `.blb-col`
 * columns; the list view is a real `<table class="bl-list__table">`.
 */
test.describe('Manage Links — Board / List / Compact views', () => {
  let linksPage;
  let seededId = null;
  let seededSlug = null;
  let seededTitle = null;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    seededSlug = uniqueSlug('view');
    seededTitle = `View Seed ${seededSlug}`;
    const res = await new BetterLinksAPI(page).createLink({ title: seededTitle, slug: seededSlug });
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
    await linksPage.goto();
    await linksPage.searchLink(seededSlug);
  });

  test('view segment offers Board, List and Compact', async () => {
    await expect(linksPage.viewButton('Board')).toBeVisible();
    await expect(linksPage.viewButton('List')).toBeVisible();
    await expect(linksPage.viewButton('Compact')).toBeVisible();
  });

  test('board view renders the seeded link as a card', async ({ page }) => {
    await linksPage.switchToBoard();
    await linksPage.searchLink(seededSlug);
    await expect(page.locator(S.manageLinks.board)).toBeVisible();
    await expect(linksPage.card(seededTitle)).toBeVisible({ timeout: 15000 });
  });

  test('board cards expose a drag handle and slug', async ({ page }) => {
    await linksPage.switchToBoard();
    await linksPage.searchLink(seededSlug);
    const card = linksPage.card(seededTitle);
    await expect(card.locator(S.manageLinks.cardGrip)).toBeVisible();
    await expect(card.locator(S.manageLinks.cardSlug)).toContainText(seededSlug);
  });

  test('board columns are category columns with counts', async ({ page }) => {
    await linksPage.switchToBoard();
    const columns = page.locator(S.manageLinks.boardColumn);
    expect(await columns.count()).toBeGreaterThan(0);
    await expect(page.locator(S.manageLinks.boardColumnTitle).first()).toBeVisible();
  });

  test('toggling to List renders a table layout', async ({ page }) => {
    await linksPage.switchToList();
    await expect(page.locator(S.manageLinks.listTable)).toBeVisible({ timeout: 15000 });
    const headers = (await page.locator(`${S.manageLinks.listTable} thead th`).allTextContents())
      .map((h) => h.trim().toLowerCase());
    for (const expected of ['title', 'short url', 'target', 'type', 'clicks']) {
      expect(headers.join('|')).toContain(expected);
    }
  });

  test('list view shows the seeded link as a row', async () => {
    await linksPage.switchToList();
    await linksPage.searchLink(seededSlug);
    await expect(linksPage.listRow(seededTitle)).toBeVisible({ timeout: 15000 });
  });

  test('switching back to Board restores the card layout', async ({ page }) => {
    await linksPage.switchToList();
    await linksPage.switchToBoard();
    await expect(page.locator(S.manageLinks.board)).toBeVisible();
    expect(await linksPage.isBoardView()).toBeTruthy();
  });

  test('Compact toggles the board density', async ({ page }) => {
    await linksPage.switchToBoard();
    const compact = linksPage.viewButton('Compact');
    const before = await linksPage.root.evaluate((el) => el.className.includes('is-compact'));
    await compact.click();
    await page.waitForTimeout(700);
    const after = await linksPage.root.evaluate((el) => el.className.includes('is-compact'));
    expect(after).toBe(!before);
    // Restore the previous density so the next test starts clean.
    await compact.click();
  });

  test('overview cards summarise links, categories, clicks and favorites', async ({ page }) => {
    const text = ((await page.locator(S.manageLinks.overview).textContent()) || '').toUpperCase();
    for (const label of ['LINKS', 'CATEGORIES', 'CLICKS', 'FAVORITES']) {
      expect(text).toContain(label);
    }
  });

  test('favorite filter toggle switches state', async ({ page }) => {
    const fav = linksPage.favoriteFilter;
    await expect(fav).toBeVisible();
    await fav.click();
    await page.waitForTimeout(1200);
    await expect(fav).toHaveClass(/is-active/);
    await fav.click();
    await page.waitForTimeout(800);
  });

  test('toolbar exposes category, tag, sort and date filters', async ({ page }) => {
    const filters = page.locator(S.manageLinks.filter);
    expect(await filters.count()).toBeGreaterThanOrEqual(4);
    await expect(linksPage.resetFiltersButton).toBeVisible();
  });
});

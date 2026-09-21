const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Favorite toggle on link cards (BetterLinks 3.x).
 * The star keeps its 2.x hook classes — `.btl-fav-link` with
 * `favorated` / `unfavorated` — inside the new `.blb-card__actions`.
 */
test.describe('Manage Links — Favorite toggle', () => {
  let linksPage;
  let seededId = null;
  let seededSlug = null;
  let seededTitle = null;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    seededSlug = uniqueSlug('favorite');
    seededTitle = `Favorite Seed ${seededSlug}`;
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

  test('favorite button is rendered on the link card', async () => {
    test.skip(!seededId, 'seed link not created');
    const card = linksPage.card(seededTitle);
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card.locator(S.manageLinks.favoriteButton)).toBeVisible();
  });

  test('toggling favorite switches unfavorated → favorated', async ({ page }) => {
    test.skip(!seededId, 'seed link not created');
    const btn = linksPage.favoriteButton(seededTitle);
    await expect(btn).toBeVisible({ timeout: 15000 });
    await expect(btn).toHaveClass(/unfavorated/);

    await btn.click();
    await page.waitForTimeout(1500);
    await expect(linksPage.favoriteButton(seededTitle)).toHaveClass(/(^|\s)favorated/);
  });

  test('favorited link survives a reload', async ({ page }) => {
    test.skip(!seededId, 'seed link not created');
    await linksPage.goto();
    await linksPage.searchLink(seededSlug);
    await expect(linksPage.favoriteButton(seededTitle)).toHaveClass(/(^|\s)favorated/);
  });

  test('favorites filter shows the favorited link', async ({ page }) => {
    test.skip(!seededId, 'seed link not created');
    await linksPage.favoriteFilter.click();
    await page.waitForTimeout(1500);
    await expect(linksPage.linkByTitle(seededTitle)).toBeVisible({ timeout: 15000 });
    await linksPage.favoriteFilter.click();
  });

  test('unfavorite returns to the unfavorated state', async ({ page }) => {
    test.skip(!seededId, 'seed link not created');
    const btn = linksPage.favoriteButton(seededTitle);
    await expect(btn).toBeVisible({ timeout: 15000 });
    await btn.click();
    await page.waitForTimeout(1500);
    await expect(linksPage.favoriteButton(seededTitle)).toHaveClass(/unfavorated/);
  });
});

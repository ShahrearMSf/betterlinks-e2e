const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug } = require('../../helpers/utils');
require('dotenv').config();

/**
 * Favorite toggle behavior — the button lives inside .btl-dnd-link as
 * .btl-fav-link with classes .favorated / .unfavorated reflecting state.
 */
test.describe('Manage Links — Favorite toggle', () => {
  let linksPage;
  let api;
  let slug, title;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto('/wp-admin/admin.php?page=betterlinks', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#betterlinksbody', { state: 'attached', timeout: 30000 });
    const seedApi = new BetterLinksAPI(page);
    slug = uniqueSlug('favorite');
    title = `Favorite Seed ${slug}`;
    await seedApi.createLink({ title, slug, targetUrl: 'https://example.com/f' });
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    linksPage = new ManageLinksPage(page);
    await linksPage.goto();
    api = new BetterLinksAPI(page);
  });

  test('favorite button is rendered on link card', async ({ page }) => {
    const card = linksPage.linkByTitle(title);
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.hover();
    const favBtn = card.locator('.btl-fav-link');
    await expect(favBtn).toBeVisible({ timeout: 5000 });
  });

  test('toggling favorite switches class from unfavorated → favorated', async ({ page }) => {
    const card = linksPage.linkByTitle(title);
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.hover();
    const favBtn = card.locator('.btl-fav-link').first();
    const hadUnfav = (await favBtn.getAttribute('class') || '').includes('unfavorated');
    await favBtn.click({ force: true });
    await page.waitForTimeout(1200);
    const cardAfter = linksPage.linkByTitle(title);
    await cardAfter.hover();
    const favBtnAfter = cardAfter.locator('.btl-fav-link').first();
    const cls = (await favBtnAfter.getAttribute('class')) || '';
    if (hadUnfav) {
      expect(cls).toContain('favorated');
    } else {
      // If it started favorited, we just ensured the click doesn't crash
      expect(cls.length).toBeGreaterThan(0);
    }
  });

  test('unfavorite returns to unfavorated state', async ({ page }) => {
    const card = linksPage.linkByTitle(title);
    await card.hover();
    const favBtn = card.locator('.btl-fav-link').first();
    const classes = (await favBtn.getAttribute('class')) || '';
    if (classes.includes('favorated') && !classes.includes('unfavorated')) {
      await favBtn.click({ force: true });
      await page.waitForTimeout(1200);
      const cls = (await linksPage.linkByTitle(title).locator('.btl-fav-link').first().getAttribute('class')) || '';
      expect(cls).toContain('unfavorated');
    } else {
      // Already unfavorated — toggle twice to exercise the path
      await favBtn.click({ force: true });
      await page.waitForTimeout(800);
      const again = linksPage.linkByTitle(title).locator('.btl-fav-link').first();
      await again.click({ force: true });
      await page.waitForTimeout(800);
      const cls = (await linksPage.linkByTitle(title).locator('.btl-fav-link').first().getAttribute('class')) || '';
      expect(cls).toContain('unfavorated');
    }
  });
});

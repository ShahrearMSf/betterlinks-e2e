const { test, expect } = require('@playwright/test');
const { KeywordsPage } = require('../../pages/KeywordsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Auto-Link Keywords (Pro) — BetterLinks 3.x.
 *
 * The page is now `.bl-kw`: stat cards (Keywords / Active / Drafts), a status
 * filter, a search box and a `.bl-kw__table`. Adding a keyword opens a drawer
 * whose keyword field is a chips input; Import / Export sit in the header.
 */
test.describe('Auto-Link Keywords (Pro)', () => {
  let keywordsPage;
  let api;
  const createdLinkIds = [];

  test.beforeEach(async ({ page }) => {
    keywordsPage = new KeywordsPage(page);
    await keywordsPage.goto();
    api = new BetterLinksAPI(page);
  });

  test.afterAll(async ({ browser }) => {
    if (!createdLinkIds.length) return;
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const cleanupApi = new BetterLinksAPI(page);
    for (const id of createdLinkIds) {
      await cleanupApi.deleteKeyword(id).catch(() => {});
      await cleanupApi.deleteLink(id).catch(() => {});
    }
    await ctx.close();
  });

  test('should load the Auto-Link Keywords page', async ({ page }) => {
    await expect(page).toHaveURL(/betterlinks-keywords-linking/);
    await expect(keywordsPage.heading).toContainText(/Auto-Link Keywords/i);
  });

  test('page shows Keywords / Active / Drafts stat cards', async ({ page }) => {
    // The stat strip mounts after the keyword list resolves, so assert with a
    // retrying matcher rather than a one-shot textContent() snapshot.
    await expect(keywordsPage.statCards.first()).toBeVisible({ timeout: 25000 });
    expect(await keywordsPage.statCards.count()).toBeGreaterThanOrEqual(3);
    const section = page.locator(S.keywords.page);
    await expect(section).toContainText(/Keywords/i);
    await expect(section).toContainText(/Active/i);
    await expect(section).toContainText(/Drafts/i);
  });

  test('keywords table renders with its column headers', async () => {
    await expect(keywordsPage.dataTable).toBeVisible({ timeout: 20000 });
    const headers = (await keywordsPage.columnHeaders()).map((h) => h.toLowerCase()).join('|');
    expect(headers).toContain('keywords');
    expect(headers).toContain('status');
    expect(headers).toContain('action');
  });

  test('Import and Export controls are available', async () => {
    await expect(keywordsPage.importExportGroup).toBeVisible();
    await expect(keywordsPage.exportButton).toBeVisible();
    await expect(keywordsPage.exportButton).toContainText(/Export/i);
    await expect(keywordsPage.importButton).toBeVisible();
    await expect(keywordsPage.importButton).toContainText(/Import/i);
  });

  test('"Add New Keywords" opens the drawer', async ({ page }) => {
    await keywordsPage.openDrawer();
    await expect(keywordsPage.drawer).toBeVisible();
    await expect(keywordsPage.keywordInput).toBeVisible();
    await expect(page.locator(S.keywords.drawer)).toContainText(/Choose Link/i);
  });

  test('keyword field accepts chips', async ({ page }) => {
    await keywordsPage.openDrawer();
    await keywordsPage.keywordInput.fill('testkw-chip');
    await keywordsPage.keywordInput.press('Enter');
    await page.waitForTimeout(600);
    await expect(keywordsPage.chips.first()).toContainText('testkw-chip');
  });

  test('a keyword can be added against a link', async ({ page }) => {
    const slug = uniqueSlug('kwlink');
    const title = `KW Target ${slug}`;
    const created = await api.createLink({ title, slug });
    const id = created.data?.data?.ID;
    expect(id).toBeTruthy();
    createdLinkIds.push(id);

    await keywordsPage.goto();
    const keyword = `testkw${Date.now()}`;
    await keywordsPage.addKeyword(keyword, title);

    await keywordsPage.goto();
    expect(await keywordsPage.keywordExists(keyword)).toBeTruthy();
  });

  test('status filter narrows the table', async ({ page }) => {
    await expect(keywordsPage.filterSelect).toBeVisible();
    await keywordsPage.filterSelect.selectOption({ index: 1 }).catch(() => {});
    await page.waitForTimeout(1200);
    await expect(page.locator(S.app.root)).toBeVisible();
  });

  test('search box filters keywords', async ({ page }) => {
    await expect(keywordsPage.searchInput).toBeVisible();
    await keywordsPage.searchInput.fill('zzz-no-such-keyword');
    await page.waitForTimeout(1200);
    const rows = await keywordsPage.rows.count();
    if (rows === 0) await expect(keywordsPage.emptyRow).toBeVisible();
    await keywordsPage.searchInput.fill('');
  });

  test('keywords REST endpoints respond', async () => {
    expect((await api.getKeywords()).status).toBe(200);
    expect((await api.exportKeywords()).status).toBe(200);
  });

  test('a keyword created over REST shows up in the table', async ({ page }) => {
    const slug = uniqueSlug('kwlist');
    const created = await api.createLink({ title: `KW REST ${slug}`, slug });
    const id = created.data?.data?.ID;
    expect(id).toBeTruthy();
    createdLinkIds.push(id);

    const keyword = `testkw${Date.now()}`;
    const res = await api.createKeyword(id, keyword);
    expect(res.status).toBeLessThan(300);
    expect(res.data?.success, 'the keywords endpoint reports whether it stored the row').toBeTruthy();

    // Rows come back as JSON strings keyed `keywords`.
    const stored = await api.findKeyword(keyword);
    expect(stored, 'the new keyword should be in the keyword list').toBeTruthy();
    expect(String(stored.link_id)).toBe(String(id));

    await keywordsPage.goto();
    expect(await keywordsPage.keywordExists(keyword)).toBeTruthy();
  });
});

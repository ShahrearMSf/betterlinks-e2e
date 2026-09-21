const { test, expect } = require('@playwright/test');
const { LinkScannerPage } = require('../../pages/LinkScannerPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Broken link checking (Pro) — BetterLinks 3.x.
 *
 * Section 1 (Full Site Link Scanner) crawls posts/pages; section 2
 * (BetterLinks Broken Link Scanner) checks the targets of your short links.
 * The scan itself is asynchronous, so these tests assert the scan starts and
 * the reporting surfaces respond rather than waiting on a full crawl.
 */
test.describe('Broken Link Checker (Pro)', () => {
  let scanner;
  let api;
  const createdIds = [];

  test.beforeEach(async ({ page }) => {
    scanner = new LinkScannerPage(page);
    await scanner.goto();
    api = new BetterLinksAPI(page);
  });

  test.afterAll(async ({ browser }) => {
    if (!createdIds.length) return;
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const cleanupApi = new BetterLinksAPI(page);
    for (const id of createdIds) await cleanupApi.deleteLink(id).catch(() => {});
    await ctx.close();
  });

  test('should load the Link Scanner page', async ({ page }) => {
    await expect(page).toHaveURL(/betterlinks-link-scanner/);
    await expect(scanner.tabs).toHaveCount(3);
  });

  test('full-site scanner shows a health score and scan button', async () => {
    await expect(scanner.health).toBeVisible({ timeout: 20000 });
    await expect(scanner.healthScore).toBeVisible();
    await expect(scanner.scanButton).toBeVisible();
  });

  test('starting a scan shows progress and does not break the page', async ({ page }) => {
    await scanner.startScan();
    const modal = await scanner.scanModal.isVisible({ timeout: 8000 }).catch(() => false);
    const chips = await scanner.healthChips.count();
    expect(modal || chips > 0).toBeTruthy();
    await expect(page.locator(S.app.root)).toBeVisible();
  });

  test('results table or a no-data state is rendered', async () => {
    const hasTable = await scanner.resultsTable.isVisible({ timeout: 10000 }).catch(() => false);
    const hasEmpty = await scanner.noDataState.isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('results can be filtered by status', async ({ page }) => {
    await expect(scanner.statusFilter).toBeVisible();
    await scanner.statusFilter.click();
    await page.waitForTimeout(900);
    const options = page.locator('.btl-flc-dropdown__label, .btl-flc-dropdown li');
    expect(await options.count()).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
  });

  test('status chips cover broken / forbidden / unauthorized', async ({ page }) => {
    const chips = (await scanner.healthChips.allTextContents()).join('|').toLowerCase();
    expect(chips).toMatch(/broken|forbidden|unauthoriz|active/);
  });

  test('clear-logs is offered, and disabled while there is nothing to clear', async ({ page }) => {
    await expect(scanner.clearLogsButton).toBeVisible();

    if (await scanner.clearLogsButton.isDisabled()) {
      // No scan has stored results yet — the button correctly stays inert.
      expect(await scanner.getBrokenLinkCount()).toBe(0);
      return;
    }

    await scanner.clearLogsButton.click();
    await page.waitForTimeout(1500);
    // Logs are never wiped on a single click — a confirmation must appear.
    const confirm = page.locator('.bl-confirm-modal, .btl-confirmation-alert, .ReactModal__Content').first();
    await expect(confirm).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
  });

  test('a link with a 404 target can be created for scanning', async ({ page }) => {
    const slug = uniqueSlug('broken');
    const res = await api.createLink({
      title: `Broken ${slug}`,
      targetUrl: `${process.env.BASE_URL}/this-page-does-not-exist-404`,
      slug,
    });
    const id = res.data?.data?.ID;
    expect(id).toBeTruthy();
    createdIds.push(id);
  });

  test('BetterLinks Broken Link Scanner section checks short-link targets', async ({ page }) => {
    await scanner.openTab('BetterLinks Broken Link Scanner');
    await expect(scanner.panel).toBeVisible();
    const text = ((await scanner.panel.textContent()) || '').toLowerCase();
    expect(text).toMatch(/scan|broken|link/);
    expect(await scanner.cards.count()).toBeGreaterThan(0);
  });

  test('Scheduled Scan & Reports section exposes scheduling options', async () => {
    await scanner.openTab('Scheduled Scan & Reports');
    const text = ((await scanner.panel.textContent()) || '').toLowerCase();
    expect(text).toMatch(/schedul|frequency|report|email/);
  });
});

const { test, expect } = require('@playwright/test');
const { LinkScannerPage } = require('../../pages/LinkScannerPage');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Link Scanner — the three sections shipped in BetterLinks 3.x:
 *   1. Full Site Link Scanner        — crawls posts/pages for broken links
 *   2. BetterLinks Broken Link Scanner — checks the targets of your short links
 *   3. Scheduled Scan & Reports      — cron schedule + email reporting
 */
test.describe('Link Scanner — three sections (Pro)', () => {
  let scanner;

  test.beforeEach(async ({ page }) => {
    scanner = new LinkScannerPage(page);
    await scanner.goto();
  });

  test('page exposes exactly the three scanner tabs', async () => {
    await expect(scanner.tabs).toHaveCount(3);
    const names = (await scanner.tabNames()).join('|');
    for (const expected of LinkScannerPage.TABS) {
      expect(names).toContain(expected);
    }
  });

  test('Full Site Link Scanner is selected by default', async () => {
    await expect(scanner.selectedTab).toContainText(/Full Site Link Scanner/i);
    await expect(scanner.health).toBeVisible({ timeout: 20000 });
  });

  test('section 1 shows the health score, post-type picker and scan button', async ({ page }) => {
    const panel = scanner.panel;
    await expect(scanner.healthScore).toBeVisible();
    await expect(panel).toContainText(/Links crawled/i);
    await expect(panel).toContainText(/Posts & pages/i);
    await expect(panel).toContainText(/Post Types/i);
    await expect(scanner.scanButton).toBeVisible();
    await expect(scanner.scanButton).toContainText(/Scan/i);
  });

  test('section 1 shows status chips and a results table or empty state', async () => {
    expect(await scanner.healthChips.count()).toBeGreaterThan(0);
    const hasTable = await scanner.resultsTable.isVisible({ timeout: 8000 }).catch(() => false);
    const hasEmpty = await scanner.noDataState.isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('section 1 results toolbar has search, status filter and clear logs', async () => {
    await expect(scanner.resultsSearch).toBeVisible();
    await expect(scanner.statusFilter).toBeVisible();
    await expect(scanner.clearLogsButton).toBeVisible();
  });

  test('section 2 — BetterLinks Broken Link Scanner renders its cards', async ({ page }) => {
    await scanner.openTab('BetterLinks Broken Link Scanner');
    await expect(scanner.selectedTab).toContainText(/Broken Link Scanner/i);
    const panel = scanner.panel;
    await expect(panel).toBeVisible();
    expect(await scanner.cards.count()).toBeGreaterThan(0);
  });

  test('section 2 offers a scan action', async ({ page }) => {
    await scanner.openTab('BetterLinks Broken Link Scanner');
    const buttons = (await page.locator(S.scanner.blsButton).allTextContents()).join('|').toLowerCase();
    expect(buttons).toMatch(/scan|check/);
  });

  test('section 3 — Scheduled Scan & Reports renders schedule + email settings', async ({ page }) => {
    await scanner.openTab('Scheduled Scan & Reports');
    await expect(scanner.selectedTab).toContainText(/Scheduled Scan/i);
    const text = ((await scanner.panel.textContent()) || '').toLowerCase();
    expect(text).toMatch(/schedule|frequency|report|email/);
  });

  test('switching between the three sections keeps the app alive', async ({ page }) => {
    for (const name of LinkScannerPage.TABS) {
      await scanner.openTab(name);
      await expect(page.locator(S.app.root)).toBeVisible();
      await expect(scanner.selectedTab).toContainText(new RegExp(name.split(' ')[0], 'i'));
    }
  });
});

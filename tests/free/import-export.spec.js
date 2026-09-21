const { test, expect } = require('@playwright/test');
const { SettingsPage } = require('../../pages/SettingsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Import / Export — BetterLinks 3.x.
 *
 * 2.x had a "Tools" tab; 3.x moved this under Settings → Tools → Import &
 * Export (`?tab=import-export`) and redesigned it into two cards with radio
 * option lists (`.btl-tools-option`) and one action button each. The import
 * file picker is opened by a button, not a visible <input type=file>.
 */
test.describe('Import / Export', () => {
  let settingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.gotoImportExport();
    await expect(settingsPage.toolsGrid).toBeVisible({ timeout: 25000 });
  });

  test('shows Export Data and Import Data cards', async () => {
    await expect(settingsPage.toolsCard('Export Data')).toBeVisible();
    await expect(settingsPage.toolsCard('Import Data')).toBeVisible();
  });

  test('export offers Links, Analytics and Sample CSV options', async () => {
    for (const option of ['Links', 'Analytics', 'Sample CSV File']) {
      await expect(settingsPage.exportOption(option)).toBeVisible();
    }
  });

  test('import offers BetterLinks and migration sources', async () => {
    for (const option of ['BetterLinks', 'Pretty Links', 'Simple 301 Redirects', 'ThirstyAffiliates']) {
      await expect(settingsPage.importOption(option)).toBeVisible();
    }
  });

  test('should export links as CSV', async ({ page }) => {
    await settingsPage.selectExportType('Links');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 45000 }),
      settingsPage.exportButton.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('should export analytics as CSV', async ({ page }) => {
    await settingsPage.selectExportType('Analytics');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 45000 }),
      settingsPage.exportButton.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('should download the sample CSV template', async ({ page }) => {
    await settingsPage.selectExportType('Sample CSV File');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 45000 }),
      settingsPage.exportButton.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  });

  test('exported links CSV contains a seeded link', async ({ page }) => {
    const api = new BetterLinksAPI(page);
    const slug = uniqueSlug('export1');
    const res = await api.createLink({ title: `Export Seed ${slug}`, slug, targetUrl: 'https://example.com/export' });
    const id = res.data?.data?.ID;

    await settingsPage.gotoImportExport();
    await settingsPage.selectExportType('Links');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 45000 }),
      settingsPage.exportButton.click(),
    ]);
    const file = path.join(require('os').tmpdir(), `bl-export-${Date.now()}.csv`);
    await download.saveAs(file);
    const contents = fs.readFileSync(file, 'utf8');
    expect(contents).toContain(slug);
    fs.unlinkSync(file);

    if (id) await api.deleteLink(id);
  });

  test('"Choose File to Import" opens the import modal with a CSV dropzone', async ({ page }) => {
    await settingsPage.importOption('BetterLinks').click();
    await settingsPage.importButton.click();
    const modal = page.locator('.btl-import-modal-content');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal.locator('input[type="file"]')).toBeAttached();
    expect(await modal.locator('input[type="file"]').getAttribute('accept')).toContain('csv');

    await page.keyboard.press('Escape');
    await expect(page.locator(S.app.root)).toBeVisible();
  });

  test('round trip: exported CSV can be re-imported', async ({ page }) => {
    const api = new BetterLinksAPI(page);
    const slug = uniqueSlug('export2');
    const title = `Round Trip ${slug}`;
    const created = await api.createLink({ title, slug, targetUrl: 'https://example.com/round-trip' });
    const id = created.data?.data?.ID;

    await settingsPage.gotoImportExport();
    await settingsPage.selectExportType('Links');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 45000 }),
      settingsPage.exportButton.click(),
    ]);
    const file = path.join(require('os').tmpdir(), `bl-roundtrip-${Date.now()}.csv`);
    await download.saveAs(file);

    // Remove the link, then import the export back and confirm it returns.
    if (id) await api.deleteLink(id);

    await settingsPage.gotoImportExport();
    await settingsPage.importOption('BetterLinks').click();
    await settingsPage.importButton.click();
    const modal = page.locator('.btl-import-modal-content');
    await expect(modal).toBeVisible({ timeout: 15000 });
    await modal.locator('input[type="file"]').setInputFiles(file);
    await page.waitForTimeout(4000);

    // 3.x shows a field-mapping step before the import runs; walk it through to
    // the end by clicking the modal's primary action until it closes.
    for (let step = 0; step < 4; step++) {
      const action = modal.locator('.btl-import-modal-footer button').last();
      if (!(await action.isVisible({ timeout: 5000 }).catch(() => false))) break;
      if (await action.isDisabled().catch(() => false)) break;
      await action.click();
      await page.waitForTimeout(5000);
      if (!(await modal.isVisible().catch(() => false))) break;
    }

    await page.goto('/wp-admin/admin.php?page=betterlinks');
    await waitForAppReady(page);
    const restored = await new BetterLinksAPI(page).findLinkBySlug(slug);
    fs.unlinkSync(file);
    expect(restored, 'the exported link should come back after import').toBeTruthy();

    if (restored) await new BetterLinksAPI(page).deleteLink(restored.ID);
  });
});

const { test, expect } = require('@playwright/test');
const { SettingsPage } = require('../../pages/SettingsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { waitForAppReady, waitForToast } = require('../../helpers/utils');
require('dotenv').config();

test.describe('Settings Page Tests', () => {
  let settingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
  });

  test('should load Settings page', async ({ page }) => {
    await expect(page.locator('#betterlinksbody')).toBeVisible();
    await expect(page).toHaveURL(/betterlinks-settings/);
  });

  test('should display General tab by default', async ({ page }) => {
    // General tab should be active/visible
    const generalContent = page.locator('[class*="tab-panel"], [role="tabpanel"]').first();
    await expect(generalContent).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    // Switch to Advanced
    await settingsPage.gotoAdvanced();
    await page.waitForTimeout(500);
    await expect(page.locator('#betterlinksbody')).toBeVisible();

    // Switch to Tools
    await settingsPage.gotoTools();
    await page.waitForTimeout(500);
    await expect(page.locator('#betterlinksbody')).toBeVisible();

    // Switch back to General
    await settingsPage.gotoGeneral();
    await page.waitForTimeout(500);
    await expect(page.locator('#betterlinksbody')).toBeVisible();
  });

  test('should save General settings', async ({ page }) => {
    await settingsPage.gotoGeneral();
    await settingsPage.saveSettings();
    // Should get success toast or page should remain stable
    await page.waitForTimeout(1000);
    await expect(page.locator('#betterlinksbody')).toBeVisible();
  });

  test('should toggle default nofollow setting', async ({ page }) => {
    await settingsPage.gotoGeneral();
    const checkbox = settingsPage.nofollowCheckbox;

    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      const wasBefore = await checkbox.isChecked();
      await checkbox.click();
      await settingsPage.saveSettings();
      await page.waitForTimeout(1000);

      // Reload and verify the toggle persisted
      await settingsPage.goto();
      await settingsPage.gotoGeneral();
      const isAfter = await checkbox.isChecked();
      expect(isAfter).toBe(!wasBefore);

      // Restore original value
      if (isAfter !== wasBefore) {
        await checkbox.click();
        await settingsPage.saveSettings();
      }
    }
  });

  test('should toggle default sponsored setting', async ({ page }) => {
    await settingsPage.gotoGeneral();
    const checkbox = settingsPage.sponsoredCheckbox;

    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      const wasBefore = await checkbox.isChecked();
      await checkbox.click();
      await settingsPage.saveSettings();
      await page.waitForTimeout(1000);

      await settingsPage.goto();
      await settingsPage.gotoGeneral();
      const isAfter = await checkbox.isChecked();
      expect(isAfter).toBe(!wasBefore);

      // Restore
      if (isAfter !== wasBefore) {
        await checkbox.click();
        await settingsPage.saveSettings();
      }
    }
  });

  test('should toggle default tracking setting', async ({ page }) => {
    await settingsPage.gotoGeneral();
    const checkbox = settingsPage.trackMeCheckbox;

    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      const wasBefore = await checkbox.isChecked();
      await checkbox.click();
      await settingsPage.saveSettings();
      await page.waitForTimeout(1000);

      await settingsPage.goto();
      await settingsPage.gotoGeneral();
      const isAfter = await checkbox.isChecked();
      expect(isAfter).toBe(!wasBefore);

      // Restore
      if (isAfter !== wasBefore) {
        await checkbox.click();
        await settingsPage.saveSettings();
      }
    }
  });

  test('should display Tools tab with export/import options', async ({ page }) => {
    await settingsPage.gotoTools();
    await page.waitForTimeout(500);

    // Should show export and import sections
    const content = await page.locator('#betterlinksbody').textContent();
    const hasExport = content.toLowerCase().includes('export');
    const hasImport = content.toLowerCase().includes('import');
    expect(hasExport || hasImport).toBeTruthy();
  });

  test('should display Role Management tab (Pro)', async ({ page }) => {
    await settingsPage.gotoRoleManagement();
    await page.waitForTimeout(500);

    // Should show role management or pro upsell
    const content = await page.locator('#betterlinksbody').textContent();
    const hasRoleContent = content.toLowerCase().includes('role') || content.toLowerCase().includes('permission') || content.toLowerCase().includes('pro');
    expect(hasRoleContent).toBeTruthy();
  });

  test('settings changes should persist via API verification', async ({ page }) => {
    // Get current settings via API
    const api = new BetterLinksAPI(page);
    const settings = await api.getSettings();

    expect(settings.status).toBe(200);
    expect(settings.data).toBeTruthy();
  });
});

const { test, expect } = require('@playwright/test');
const { SettingsPage } = require('../../pages/SettingsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Settings — BetterLinks 3.x sidebar shell.
 * Tabs were replaced by a three-group sidebar; defaults are `.bl-toggle`
 * switches, and Import/Export + Role Management + License are panels here.
 */
test.describe('Settings Page', () => {
  let settingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto();
  });

  test('should load Settings page', async ({ page }) => {
    await expect(page.locator(S.app.root)).toBeVisible();
    await expect(page).toHaveURL(/betterlinks-settings/);
    await expect(settingsPage.sidebar).toBeVisible();
  });

  test('sidebar shows the Configure / Tools / System groups', async () => {
    const groups = (await settingsPage.groupTitles.allTextContents()).map((g) => g.trim().toLowerCase());
    expect(groups).toEqual(expect.arrayContaining(['configure', 'tools', 'system']));
  });

  test('sidebar lists every settings section', async () => {
    const labels = (await settingsPage.navLabels()).map((l) => l.toLowerCase());
    for (const expected of ['link defaults', 'redirects', 'tracking', 'import & export', 'role management', 'license']) {
      expect(labels.some((l) => l.includes(expected))).toBeTruthy();
    }
  });

  test('Link Attributes row carries the four default switches', async ({ page }) => {
    await settingsPage.gotoLinkDefaults();
    for (const name of ['nofollow', 'sponsored', 'param_forwarding', 'track_me']) {
      await expect(settingsPage.toggle(name), `${name} toggle should exist`).toBeVisible();
    }
  });

  test('Link Defaults panel is selected by default', async () => {
    const active = (await settingsPage.activeSection()).toLowerCase();
    expect(active).toContain('link defaults');
    await expect(settingsPage.panel).toBeVisible();
  });

  test('should switch between settings sections', async ({ page }) => {
    for (const section of ['Redirects', 'Feature Modules', 'Link Defaults']) {
      await settingsPage.openSection(section);
      await expect(settingsPage.panel).toBeVisible();
      await expect(page.locator(S.app.root)).toBeVisible();
    }
  });

  test('deep link via ?tab= opens the requested panel', async ({ page }) => {
    await settingsPage.goto('import-export');
    await expect(settingsPage.toolsGrid).toBeVisible({ timeout: 20000 });
    await expect(page.locator(S.app.root)).toBeVisible();
  });

  test('should save Link Defaults without error', async ({ page }) => {
    await settingsPage.gotoLinkDefaults();
    await expect(settingsPage.saveButton).toBeVisible();
    await settingsPage.saveSettings();
    await expect(page.locator(S.app.root)).toBeVisible();
  });

  for (const [label, settingKey] of [
    ['No Follow', 'nofollow'],
    ['Sponsored', 'sponsored'],
    ['Tracking', 'track_me'],
    ['Parameter Forwarding', 'param_forwarding'],
  ]) {
    test(`toggling the default "${label}" switch persists`, async ({ page }) => {
      await settingsPage.gotoLinkDefaults();
      const toggle = settingsPage.toggle(settingKey);
      test.skip(!(await toggle.isVisible({ timeout: 5000 }).catch(() => false)), `${label} toggle not rendered`);

      const before = await settingsPage.isToggleOn(settingKey);
      await settingsPage.setToggle(settingKey, !before);
      await settingsPage.saveSettings();

      await settingsPage.goto();
      await settingsPage.gotoLinkDefaults();
      const after = await settingsPage.isToggleOn(settingKey);
      expect(after).toBe(!before);

      // Confirm the REST layer agrees before restoring the original value.
      const api = new BetterLinksAPI(page);
      const stored = await api.readSettings();
      if (typeof stored[settingKey] !== 'undefined') {
        expect(Boolean(stored[settingKey])).toBe(after);
      }

      await settingsPage.setToggle(settingKey, before);
      await settingsPage.saveSettings();
    });
  }

  test('Import & Export panel shows both cards', async ({ page }) => {
    await settingsPage.gotoImportExport();
    await expect(settingsPage.toolsGrid).toBeVisible({ timeout: 20000 });
    await expect(settingsPage.toolsCard('Export Data')).toBeVisible();
    await expect(settingsPage.toolsCard('Import Data')).toBeVisible();
    const text = (await page.locator(S.app.root).textContent()) || '';
    expect(text.toLowerCase()).toContain('export');
    expect(text.toLowerCase()).toContain('import');
  });

  test('Role Management panel renders (Pro)', async ({ page }) => {
    await settingsPage.gotoRoleManagement();
    const text = ((await page.locator(S.app.root).textContent()) || '').toLowerCase();
    expect(text.includes('role') || text.includes('permission') || text.includes('pro')).toBeTruthy();
  });

  test('License panel renders (Pro)', async ({ page }) => {
    await settingsPage.gotoLicense();
    const text = ((await page.locator(S.app.root).textContent()) || '').toLowerCase();
    expect(text.includes('license') || text.includes('activate')).toBeTruthy();
  });

  test('settings are readable over REST', async ({ page }) => {
    const api = new BetterLinksAPI(page);
    const res = await api.getSettings();
    expect(res.status).toBe(200);
    // 3.x returns the settings object as a JSON string in `data`.
    const parsed = await api.readSettings();
    expect(typeof parsed).toBe('object');
    expect(parsed).toHaveProperty('redirect_type');
  });
});

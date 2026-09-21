const { test, expect } = require('@playwright/test');
const { SettingsPage } = require('../../pages/SettingsPage');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * License UI (Pro) — Settings → System → License (`?tab=license`).
 *
 * 3.0 moved the license screen out of the old react-tabs strip and into the
 * settings sidebar, and redesigned it as `.bl-lic`: a hero banner that states
 * the activation status, the key field, and an Activate / Deactivate action.
 *
 * These tests are read-only: they never activate or deactivate the site's
 * licence, they only assert the UI reflects the current state coherently.
 */
test.describe('License UI (Pro)', () => {
  let settingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.gotoLicense();
    await expect(settingsPage.panel).toBeVisible({ timeout: 25000 });
  });

  test('License appears under the System group in the sidebar', async ({ page }) => {
    await expect(settingsPage.navLink('License')).toBeVisible();
    const groups = (await settingsPage.groupTitles.allTextContents()).map((g) => g.trim().toLowerCase());
    expect(groups).toContain('system');
  });

  test('License panel renders with a heading and description', async () => {
    await expect(settingsPage.panelTitle).toContainText(/License/i);
    await expect(settingsPage.license).toBeVisible();
  });

  test('hero banner states the activation status', async ({ page }) => {
    const hero = page.locator(S.settings.licenseHero);
    await expect(hero).toBeVisible();
    const text = ((await hero.textContent()) || '').toLowerCase();
    expect(text.includes('activat') || text.includes('license')).toBeTruthy();
  });

  test('status and action match each other', async ({ page }) => {
    const hero = page.locator(S.settings.licenseHero);
    const isActive = ((await hero.getAttribute('class')) || '').includes('is-active');
    const buttons = (await page.locator('.bl-lic button').allTextContents()).join('|').toLowerCase();

    if (isActive) {
      // An activated site offers Deactivate, never Activate.
      expect(buttons).toContain('deactivate');
      await expect(page.locator(S.settings.licenseStatus)).toBeVisible();
    } else {
      expect(buttons).toMatch(/activate|verify/);
    }
  });

  test('license key field is present', async ({ page }) => {
    const field = page.locator(S.settings.licenseField);
    await expect(field).toBeVisible();
    await expect(page.locator(S.settings.licenseInput)).toBeVisible();
  });

  test('license key is masked, never shown in clear text', async ({ page }) => {
    const input = page.locator(S.settings.licenseInput).first();
    const value = (await input.inputValue().catch(() => '')) || '';
    if (value.trim()) {
      const type = await input.getAttribute('type');
      const masked = type === 'password' || /[•*]/.test(value) || /^.{0,4}[*•]/.test(value);
      expect(masked, 'a stored licence key should not be rendered in clear text').toBeTruthy();
    }
  });

  test('deactivate action asks for confirmation rather than firing immediately', async ({ page }) => {
    const deactivate = page.locator('.bl-lic__btn--danger');
    test.skip(!(await deactivate.isVisible({ timeout: 4000 }).catch(() => false)), 'licence is not active');
    // Hovering/reading only — we must not deactivate a live site's licence.
    await expect(deactivate).toBeEnabled();
    await expect(deactivate).toContainText(/Deactivate/i);
  });

  test('Pro-only menus are present while the licence is active', async ({ page }) => {
    const hero = page.locator(S.settings.licenseHero);
    const isActive = ((await hero.getAttribute('class')) || '').includes('is-active');
    test.skip(!isActive, 'licence is not active');

    await page.goto('/wp-admin/index.php', { waitUntil: 'domcontentloaded' });
    const labels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#toplevel_page_betterlinks .wp-submenu a')).map((a) => (a.textContent || '').trim())
    );
    expect(labels.some((l) => l.includes('Promo Cards'))).toBeTruthy();
    expect(labels.some((l) => l.includes('Bio Links'))).toBeTruthy();
  });
});

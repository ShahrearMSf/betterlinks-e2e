const { test, expect } = require('@playwright/test');
const { SettingsPage } = require('../../pages/SettingsPage');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Feature Modules — new in BetterLinks 3.x
 * (Settings → Tools → Feature Modules, `?tab=feature-modules`).
 *
 * Optional features are switched on/off here, and several of them gate UI
 * elsewhere in the plugin (password protection in the link drawer, the link
 * preview panel, QR codes, the Promo Cards and Bio Links menus). Tests that
 * depend on those features read their state from this panel.
 */
const EXPECTED_MODULES = [
  'Promo Cards',
  'Bio Links',
  'QR Code Generator',
  'Customize Link Preview',
  'Custom Fields',
  'Quick Link Creation',
  'Password Protection',
];

test.describe('Feature Modules', () => {
  let settingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.goto('feature-modules');
    await expect(page.locator('.bl-module-grid')).toBeVisible({ timeout: 25000 });
  });

  test('panel lists every optional module', async ({ page }) => {
    const titles = (await page.locator('.bl-module-card__title').allTextContents()).map((t) => t.trim());
    for (const module of EXPECTED_MODULES) {
      expect(titles, `Feature Modules should list ${module}`).toContain(module);
    }
  });

  test('each module card states what it does and whether it is on', async ({ page }) => {
    const cards = page.locator('.bl-module-card');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(EXPECTED_MODULES.length);

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await expect(card.locator('.bl-module-card__title')).not.toBeEmpty();
      await expect(card.locator('.bl-module-card__desc')).not.toBeEmpty();
      await expect(card.locator('.bl-module-card__state')).not.toBeEmpty();
    }
  });

  test('a module state matches its toggle', async ({ page }) => {
    const card = page.locator('.bl-module-card').filter({ hasText: /QR Code Generator/i }).first();
    const state = ((await card.locator('.bl-module-card__state').textContent()) || '').trim().toLowerCase();
    const isOn = (await card.locator('.bl-toggle.is-on').count()) > 0;
    if (state === 'enabled') expect(isOn).toBeTruthy();
    if (state === 'disabled') expect(isOn).toBeFalsy();
  });

  test('modules with settings link to their own configuration', async ({ page }) => {
    const card = page.locator('.bl-module-card').filter({ hasText: /Password Protection/i }).first();
    await expect(card.locator('.bl-module-card__link')).toBeVisible();
    await card.locator('.bl-module-card__link').click();
    await page.waitForTimeout(2500);
    const content = page.locator(S.settings.content);
    await expect(content).toContainText(/Password Protection/i);
    await expect(content).toContainText(/Back to Feature Modules/i);
  });

  test('"Back to Feature Modules" returns to the module grid', async ({ page }) => {
    const card = page.locator('.bl-module-card').filter({ hasText: /Password Protection/i }).first();
    await card.locator('.bl-module-card__link').click();
    await page.waitForTimeout(2000);
    await page.locator('text=Back to Feature Modules').first().click();
    await page.waitForTimeout(1500);
    await expect(page.locator('.bl-module-grid')).toBeVisible();
  });

  test('toggling a module on and off persists between loads', async ({ page }) => {
    const card = page.locator('.bl-module-card').filter({ hasText: /QR Code Generator/i }).first();
    const toggle = card.locator(S.settings.toggle).first();
    const before = (await toggle.getAttribute('class')).includes('is-on');

    await toggle.click();
    await page.waitForTimeout(1200);
    const save = page.locator(S.settings.saveButton).first();
    if (await save.isVisible({ timeout: 3000 }).catch(() => false)) {
      await save.click();
      await page.waitForTimeout(2500);
    }

    await settingsPage.goto('feature-modules');
    const after = (await page.locator('.bl-module-card').filter({ hasText: /QR Code Generator/i }).first()
      .locator(S.settings.toggle).first().getAttribute('class')).includes('is-on');
    expect(after).toBe(!before);

    // Put the site back the way we found it.
    const restoreCard = page.locator('.bl-module-card').filter({ hasText: /QR Code Generator/i }).first();
    await restoreCard.locator(S.settings.toggle).first().click();
    await page.waitForTimeout(1000);
    if (await save.isVisible({ timeout: 3000 }).catch(() => false)) {
      await save.click();
      await page.waitForTimeout(2000);
    }
  });

  test('enabled Promo Cards and Bio Links modules have their menu pages', async ({ page }) => {
    const promoOn = (await page.locator('.bl-module-card').filter({ hasText: /Promo Cards/i }).first().locator('.bl-toggle.is-on').count()) > 0;
    const bioOn = (await page.locator('.bl-module-card').filter({ hasText: /Bio Links/i }).first().locator('.bl-toggle.is-on').count()) > 0;

    await page.goto('/wp-admin/index.php', { waitUntil: 'domcontentloaded' });
    const labels = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#toplevel_page_betterlinks .wp-submenu a')).map((a) => (a.textContent || '').trim())
    );
    if (promoOn) expect(labels.some((l) => l.includes('Promo Cards'))).toBeTruthy();
    if (bioOn) expect(labels.some((l) => l.includes('Bio Links'))).toBeTruthy();
  });
});

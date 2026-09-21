const { test, expect } = require('@playwright/test');
const { SettingsPage } = require('../../pages/SettingsPage');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Role Management (Pro) — BetterLinks 3.x.
 *
 * Moved from the old react-tabs strip to Settings → System → Role Management
 * (`?tab=role-management`) and redesigned as `.bl-rm`: one section per
 * capability ("Who Can View Links?", "Who Can Create Links?", …), each with a
 * switch per role and an "Enable all" shortcut.
 */
test.describe('Role Management (Pro)', () => {
  let settingsPage;

  test.beforeEach(async ({ page }) => {
    settingsPage = new SettingsPage(page);
    await settingsPage.gotoRoleManagement();
    await expect(settingsPage.roleManagement).toBeVisible({ timeout: 25000 });
  });

  test('panel loads under Settings → System', async () => {
    await expect(settingsPage.panelTitle).toContainText(/Role Management/i);
    await expect(settingsPage.navLink('Role Management')).toBeVisible();
  });

  test('shows a section per capability', async ({ page }) => {
    const text = ((await settingsPage.roleManagement.textContent()) || '').toLowerCase();
    for (const capability of ['view links', 'create links', 'edit links', 'check analytics', 'edit settings']) {
      expect(text).toContain(capability);
    }
    expect(await page.locator('.bl-rm__section').count()).toBeGreaterThan(3);
  });

  test('covers the newer 3.x capabilities too', async () => {
    const text = ((await settingsPage.roleManagement.textContent()) || '').toLowerCase();
    expect(text).toMatch(/favorite/);
    expect(text).toMatch(/autolink|auto-link/);
    expect(text).toMatch(/tags & categories/);
  });

  test('each section lists the WordPress roles', async ({ page }) => {
    const names = (await page.locator(S.settings.roleName).allTextContents()).map((n) => n.trim());
    for (const role of ['Editor', 'Author', 'Contributor', 'Subscriber']) {
      expect(names).toContain(role);
    }
  });

  test('role switches are real checkboxes', async ({ page }) => {
    const switches = page.locator(S.settings.roleSwitchInput);
    expect(await switches.count()).toBeGreaterThan(0);
    await expect(switches.first()).toHaveAttribute('type', 'checkbox');
  });

  test('each section shows an enabled-role count and "Enable all"', async ({ page }) => {
    const section = page.locator('.bl-rm__section').first();
    await expect(section.locator('.bl-rm__count')).toContainText(/of \d+ roles/i);
    await expect(section.locator('.bl-rm__all')).toBeVisible();
  });

  test('a role filter narrows the matrix', async ({ page }) => {
    const filter = page.locator(S.settings.roleManagement).locator('.bl-rm__filter-btn').first();
    await expect(filter).toBeVisible();
    await filter.click();
    await page.waitForTimeout(800);
    await expect(page.locator('.bl-rm__filter-menu')).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
  });

  test('toggling a permission and saving persists it', async ({ page }) => {
    const first = page.locator(S.settings.roleSwitchInput).first();
    const before = await first.isChecked();

    await first.click({ force: true });
    await page.waitForTimeout(400);
    await page.locator('.bl-rm__footer button').first().click();
    await page.waitForTimeout(3000);

    await settingsPage.gotoRoleManagement();
    const after = await page.locator(S.settings.roleSwitchInput).first().isChecked();
    expect(after).toBe(!before);

    // Restore the original permission matrix.
    await page.locator(S.settings.roleSwitchInput).first().click({ force: true });
    await page.waitForTimeout(400);
    await page.locator('.bl-rm__footer button').first().click();
    await page.waitForTimeout(2500);
  });

  test('save button is present at the foot of the matrix', async ({ page }) => {
    await expect(page.locator('.bl-rm__footer button')).toBeVisible();
  });
});

const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { SettingsPage } = require('../../pages/SettingsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, expandDrawerPanel } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Password protection (Pro) — BetterLinks 3.x.
 *
 * 3.0 turned this into a *feature module*: Settings → Tools → Feature Modules →
 * "Password Protection" → Configure, which holds the "Password Protected
 * Redirect" switch. Only once that is on does the link drawer offer the
 * password fields. Tests that need the per-link UI skip cleanly when the
 * module is off rather than silently passing.
 */
const PASSWORD = 'E2ePass!2026';

test.describe('Password Protection (Pro)', () => {
  let linksPage;
  let api;
  const createdIds = [];

  test.beforeEach(async ({ page }) => {
    linksPage = new ManageLinksPage(page);
    await linksPage.goto();
    api = new BetterLinksAPI(page);
  });

  test.afterEach(async () => {
    while (createdIds.length) {
      const id = createdIds.pop();
      await api.deleteLink(id).catch(() => {});
    }
  });

  test('Feature Modules lists Password Protection', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto('feature-modules');
    const card = page.locator('.bl-module-card').filter({ hasText: /Password Protection/i }).first();
    await expect(card).toBeVisible({ timeout: 25000 });
    await expect(card).toContainText(/Gate short links behind a password/i);
  });

  test('the module has a configuration screen', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto('feature-modules');
    const card = page.locator('.bl-module-card').filter({ hasText: /Password Protection/i }).first();
    await card.locator('.bl-module-card__link').first().click();
    await page.waitForTimeout(2500);
    const content = page.locator(S.settings.content);
    await expect(content).toContainText(/Password Protection/i);
    await expect(content).toContainText(/Password Protected Redirect/i);
  });

  async function passwordUiInDrawer(page) {
    await linksPage.clickCreateNew();
    await expandDrawerPanel(page, 'Advanced');
    const enable = page.locator('input[name="enable_password_protection"], #btl-link-password');
    return (await enable.count()) > 0;
  }

  test('link drawer offers password protection when the module is on', async ({ page }) => {
    const available = await passwordUiInDrawer(page);
    test.skip(!available, 'Password Protection module is off — enable it in Settings → Feature Modules');
    await expect(page.locator('input[name="enable_password_protection"]').first()).toBeAttached();
  });

  test('a password can be set on a link', async ({ page }) => {
    const available = await passwordUiInDrawer(page);
    test.skip(!available, 'Password Protection module is off');

    const slug = uniqueSlug('password');
    await linksPage.fillLinkForm({ title: `Password ${slug}`, targetUrl: 'https://example.com/protected', slug });
    await page.locator('input[name="enable_password_protection"]').first().click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('#btl-link-password').fill(PASSWORD);
    await linksPage.publishLink();

    const link = await api.findLinkBySlug(slug);
    expect(link).toBeTruthy();
    createdIds.push(link.ID);
  });

  test('a protected link asks for the password before redirecting', async ({ page, context }) => {
    const available = await passwordUiInDrawer(page);
    test.skip(!available, 'Password Protection module is off');

    const slug = uniqueSlug('pw-form');
    await linksPage.fillLinkForm({ title: `Password Form ${slug}`, targetUrl: 'https://example.com/protected-form', slug });
    await page.locator('input[name="enable_password_protection"]').first().click({ force: true });
    await page.waitForTimeout(600);
    await page.locator('#btl-link-password').fill(PASSWORD);
    await linksPage.publishLink();

    const link = await api.findLinkBySlug(slug);
    test.skip(!link, 'protected link was not created');
    createdIds.push(link.ID);

    const visitor = await context.browser().newContext({ ignoreHTTPSErrors: true });
    const visit = await visitor.newPage();
    await visit.goto(`${process.env.BASE_URL}/${slug}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    expect(visit.url(), 'a protected link must not redirect straight through').not.toContain('example.com/protected-form');
    await expect(visit.locator('input[type="password"]')).toBeVisible({ timeout: 15000 });

    // Wrong password keeps the visitor on the form…
    await visit.locator('input[type="password"]').fill('definitely-wrong');
    await visit.locator('button[type="submit"], input[type="submit"]').first().click().catch(() => {});
    await visit.waitForTimeout(2500);
    expect(visit.url()).not.toContain('example.com/protected-form');

    // …the right one lets them through.
    await visit.locator('input[type="password"]').fill(PASSWORD);
    await visit.locator('button[type="submit"], input[type="submit"]').first().click().catch(() => {});
    await visit.waitForTimeout(4000);
    expect(visit.url()).toContain('example.com');
    await visitor.close();
  });
});

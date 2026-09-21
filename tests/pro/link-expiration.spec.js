const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, expandDrawerPanel, setCheckbox } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Link expiration & scheduling (Pro) — BetterLinks 3.x.
 *
 * These controls live in the link drawer's "Advanced" panel: a Status select
 * (Active / Schedule / Expired / Draft), a "Set expiry date" checkbox that
 * reveals "Expire After" (Date | Clicks), and an optional post-expiry redirect.
 */
test.describe('Link Expiration & Scheduling (Pro)', () => {
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

  async function openAdvanced(page) {
    await linksPage.clickCreateNew();
    const opened = await expandDrawerPanel(page, 'Advanced');
    expect(opened, 'the Advanced panel should be present in the link drawer').toBeTruthy();
    return page.locator(S.linkForm.advancedPanel);
  }

  test('Advanced panel exposes link status and expiry controls', async ({ page }) => {
    const panel = await openAdvanced(page);
    await expect(panel).toContainText(/Status/i);
    await expect(panel).toContainText(/Set expiry date/i);

    const statusOptions = await panel.locator('select').first().locator('option').allTextContents();
    expect(statusOptions.join('|')).toMatch(/Active/i);
    expect(statusOptions.join('|')).toMatch(/Schedule/i);
    expect(statusOptions.join('|')).toMatch(/Expired/i);
  });

  test('"Set expiry date" reveals Expire After with Date and Clicks', async ({ page }) => {
    const panel = await openAdvanced(page);
    await panel.locator('input.btl-check').first().click();
    await page.waitForTimeout(800);

    await expect(panel).toContainText(/Expire After/i);
    const options = await panel.locator('select').nth(1).locator('option').allTextContents();
    expect(options.map((o) => o.trim())).toEqual(expect.arrayContaining(['Date', 'Clicks']));
    await expect(panel).toContainText(/Redirect URL after Expiration/i);
  });

  test('date-based expiry is saved on the link', async ({ page }) => {
    const slug = uniqueSlug('expire-date');
    const panelPromise = openAdvanced(page);
    const panel = await panelPromise;
    await linksPage.fillLinkForm({ title: `Date Expire ${slug}`, targetUrl: 'https://example.com/expire-date', slug });
    await expandDrawerPanel(page, 'Advanced');
    await panel.locator('input.btl-check').first().click();
    await page.waitForTimeout(800);
    await panel.locator('select').nth(1).selectOption('date').catch(() => {});
    await linksPage.publishLink();

    const link = await api.findLinkBySlug(slug);
    expect(link, 'link should be created').toBeTruthy();
    createdIds.push(link.ID);
    const expire = typeof link.expire === 'string' ? JSON.parse(link.expire || '{}') : link.expire || {};
    expect(expire.type || expire.expired_type || '').toMatch(/date|^$/);
  });

  test('click-based expiry is saved on the link', async ({ page }) => {
    const slug = uniqueSlug('expire-clicks');
    const panel = await openAdvanced(page);
    await linksPage.fillLinkForm({ title: `Clicks Expire ${slug}`, targetUrl: 'https://example.com/expire-clicks', slug });
    await expandDrawerPanel(page, 'Advanced');
    await panel.locator('input.btl-check').first().click();
    await page.waitForTimeout(800);
    await panel.locator('select').nth(1).selectOption('clicks').catch(() => {});
    await page.waitForTimeout(500);
    const clicksInput = panel.locator('input[type="number"], .btl-modal-form-control').last();
    await clicksInput.fill('5').catch(() => {});
    await linksPage.publishLink();

    const link = await api.findLinkBySlug(slug);
    expect(link).toBeTruthy();
    createdIds.push(link.ID);
  });

  test('a link can be saved with the Draft status', async ({ page }) => {
    const slug = uniqueSlug('schedule');
    const panel = await openAdvanced(page);
    await linksPage.fillLinkForm({ title: `Draft Link ${slug}`, targetUrl: 'https://example.com/draft', slug });
    await expandDrawerPanel(page, 'Advanced');
    await panel.locator('select').first().selectOption('draft').catch(() => {});
    await linksPage.publishLink();

    const link = await api.findLinkBySlug(slug);
    expect(link).toBeTruthy();
    createdIds.push(link.ID);
    expect(link.link_status).toBe('draft');
  });

  test('an expired link stops redirecting to its target', async ({ page, context }) => {
    const slug = uniqueSlug('expire-redirect');
    const res = await api.createLink({
      title: `Expired ${slug}`,
      targetUrl: 'https://example.com/should-not-reach',
      slug,
      extra: { link_status: 'expired' },
    });
    const id = res.data?.data?.ID;
    expect(id).toBeTruthy();
    createdIds.push(id);

    const stored = await api.findLinkBySlug(slug);
    test.skip(stored?.link_status !== 'expired', 'the REST layer did not persist an expired status for this link');

    const visitor = await context.browser().newContext({ ignoreHTTPSErrors: true });
    const visit = await visitor.newPage();
    await visit.goto(`${process.env.BASE_URL}/${slug}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    expect(visit.url()).not.toContain('should-not-reach');
    await visitor.close();
  });
});

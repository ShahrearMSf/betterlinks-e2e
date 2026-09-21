const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, expandDrawerPanel } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Dynamic Redirects / split testing (Pro) — BetterLinks 3.x.
 *
 * The drawer's "Dynamic Redirects" panel (`.bl-dr`) carries an enable switch;
 * turning it on reveals the rotation / split-test configuration. The rule is
 * stored on the link as `dynamic_redirect`, and the split-test report lives at
 * `betterlinks/v1/clicks/splittest/{id}`.
 */
test.describe('Dynamic Redirects / Split Testing (Pro)', () => {
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

  test('link drawer has a Dynamic Redirects panel', async ({ page }) => {
    await linksPage.clickCreateNew();
    const panel = page.locator(S.linkForm.dynamicRedirectPanel);
    await expect(panel).toBeVisible();
    await expect(panel.locator(S.linkForm.panelTitle)).toContainText(/Dynamic Redirects/i);
  });

  test('panel exposes the Enable Dynamic Redirect switch', async ({ page }) => {
    await linksPage.clickCreateNew();
    await expandDrawerPanel(page, 'Dynamic Redirects');
    const dr = page.locator('.bl-dr');
    await expect(dr).toBeVisible();
    await expect(dr.locator('.bl-dr__enable-title')).toContainText(/Enable Dynamic Redirect/i);
    await expect(dr.locator('.bl-dr__switch input')).toBeAttached();
  });

  test('enabling the switch reveals the rotation configuration', async ({ page }) => {
    await linksPage.clickCreateNew();
    await expandDrawerPanel(page, 'Dynamic Redirects');
    await page.locator('.bl-dr__switch').first().click();
    await page.waitForTimeout(1500);

    const panelText = ((await page.locator(S.linkForm.dynamicRedirectPanel).textContent()) || '').toLowerCase();
    const configurator = await page.locator('.bl-dr-full, .bl-dr__panel').first().isVisible({ timeout: 6000 }).catch(() => false);
    expect(configurator || /rotat|split|variant|geo|device/.test(panelText)).toBeTruthy();
  });

  test('a rotation rule saved over REST is stored on the link', async ({ page }) => {
    const slug = uniqueSlug('split');
    // Shape the Pro plugin actually persists: { type, value: [{ link, weight }], extra }.
    // Anything else is normalised away to an empty `value`.
    const rule = {
      type: 'rotation',
      value: [
        { link: 'https://example.com/variant-a', weight: 50 },
        { link: 'https://example.com/variant-b', weight: 50 },
      ],
      extra: { rotation_mode: 'weighted', split_test: '0' },
    };
    const res = await api.createLink({
      title: `Split ${slug}`,
      targetUrl: 'https://example.com/variant-a',
      slug,
      extra: { dynamic_redirect: rule },
    });
    const id = res.data?.data?.ID;
    expect(id).toBeTruthy();
    createdIds.push(id);

    const link = await api.findLinkBySlug(slug);
    expect(link).toBeTruthy();
    const stored = typeof link.dynamic_redirect === 'string' ? link.dynamic_redirect : JSON.stringify(link.dynamic_redirect || {});
    expect(stored).toContain('variant-a');
    expect(stored).toContain('variant-b');
    expect(stored).toContain('rotation');
  });

  test('a rotating link redirects to one of its variants', async ({ page, context }) => {
    const slug = uniqueSlug('split');
    const rule = {
      type: 'rotation',
      value: [
        { link: 'https://example.com/variant-a', weight: 50 },
        { link: 'https://example.com/variant-b', weight: 50 },
      ],
      extra: { rotation_mode: 'weighted', split_test: '0' },
    };
    const res = await api.createLink({
      title: `Split Visit ${slug}`,
      targetUrl: 'https://example.com/variant-a',
      slug,
      extra: { dynamic_redirect: rule },
    });
    const id = res.data?.data?.ID;
    expect(id).toBeTruthy();
    createdIds.push(id);

    const visitor = await context.browser().newContext({ ignoreHTTPSErrors: true });
    const landings = [];
    for (let i = 0; i < 3; i++) {
      const visit = await visitor.newPage();
      await visit.goto(`${process.env.BASE_URL}/${slug}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
      landings.push(visit.url());
      await visit.close();
    }
    await visitor.close();

    for (const url of landings) {
      expect(url, `rotation sent a visitor to ${url}`).toMatch(/variant-(a|b)/);
    }
  });

  test('split-test analytics endpoint responds for a link', async ({ page }) => {
    const slug = uniqueSlug('split');
    const res = await api.createLink({ title: `Split Report ${slug}`, slug, trackMe: true });
    const id = res.data?.data?.ID;
    createdIds.push(id);

    const report = await api.request('GET', `betterlinks/v1/clicks/splittest/${id}`);
    expect(report.status).toBe(200);
  });

  test('geolocation endpoints backing geo redirects respond', async () => {
    const detect = await api.request('GET', 'betterlinks/v1/geolocation/detect');
    expect(detect.status).toBeLessThan(500);
  });
});

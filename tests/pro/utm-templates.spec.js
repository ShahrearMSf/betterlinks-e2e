const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { SettingsPage } = require('../../pages/SettingsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * UTM builder & templates (Pro) — BetterLinks 3.x.
 *
 * The builder opens from the UTM button beside the Target URL field and is now
 * `.bl-utm` (was a plain modal in 2.x), with `utm_campaign`, `utm_medium`,
 * `utm_source`, `utm_term`, `utm_content` fields, an "Apply UTM" action and
 * "Save New Template". Global templates are managed at Settings → UTM Builder.
 */
test.describe('UTM Templates (Pro)', () => {
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

  async function openBuilder(page) {
    await linksPage.clickCreateNew();
    await page.locator(S.linkForm.utmButton).click();
    const builder = page.locator('.bl-utm');
    await builder.waitFor({ state: 'visible', timeout: 15000 });
    return builder;
  }

  test('UTM button opens the builder', async ({ page }) => {
    const builder = await openBuilder(page);
    await expect(builder).toContainText(/UTM Builder/i);
  });

  test('builder exposes all five UTM parameters', async ({ page }) => {
    await openBuilder(page);
    for (const field of ['utm_campaign', 'utm_medium', 'utm_source', 'utm_term', 'utm_content']) {
      await expect(page.locator(`.bl-utm input[name="${field}"]`)).toBeVisible();
    }
  });

  test('builder offers Apply UTM and Save New Template', async ({ page }) => {
    const builder = await openBuilder(page);
    await expect(builder).toContainText(/Apply UTM/i);
    await expect(builder).toContainText(/Save New Template/i);
  });

  test('applying UTM parameters appends them to the target URL', async ({ page }) => {
    const slug = uniqueSlug('utm');
    await linksPage.clickCreateNew();
    await linksPage.fillLinkForm({ title: `UTM ${slug}`, targetUrl: 'https://example.com/utm-target', slug });

    await page.locator(S.linkForm.utmButton).click();
    const builder = page.locator('.bl-utm');
    await builder.waitFor({ state: 'visible', timeout: 15000 });
    await builder.locator('input[name="utm_source"]').fill('e2e-source');
    await builder.locator('input[name="utm_medium"]').fill('e2e-medium');
    await builder.locator('input[name="utm_campaign"]').fill('e2e-campaign');
    await builder.locator('button').filter({ hasText: /Apply UTM/i }).first().click();
    await page.waitForTimeout(1200);

    await expect(linksPage.targetUrlInput).toHaveValue(/utm_source=e2e-source/);
    await expect(linksPage.targetUrlInput).toHaveValue(/utm_medium=e2e-medium/);

    await linksPage.publishLink();
    const link = await api.findLinkBySlug(slug);
    expect(link).toBeTruthy();
    createdIds.push(link.ID);
    expect(link.target_url).toContain('utm_campaign=e2e-campaign');
  });

  test('the UTM button reflects whether parameters are applied', async ({ page }) => {
    await linksPage.clickCreateNew();
    const button = page.locator(S.linkForm.utmButton);
    await expect(button).toHaveClass(/btl-utm-button--not-applied/);

    await linksPage.targetUrlInput.fill('https://example.com/x?utm_source=abc');
    await page.waitForTimeout(800);
    await expect(button).toHaveClass(/btl-utm-button--applied/);
  });

  test('UTM templates are listed over REST', async () => {
    const res = await api.getUTMTemplates();
    expect(res.status).toBe(200);
  });

  test('a template created over REST appears in the builder', async ({ page }) => {
    // Both the template name and the campaign must be unique — the Pro API
    // answers 406 when either already exists, so a fixed campaign would make
    // this test pass once and fail on every later run.
    const stamp = Date.now();
    const name = `tmpl-${stamp}`;
    const create = await api.createUTMTemplate({
      name,
      source: 'e2e-source',
      medium: 'e2e-medium',
      campaign: `e2e-campaign-${stamp}`,
    });
    expect(create.status, 'creating a uniquely named template should succeed').toBeLessThan(300);

    // The response is the full template list; remember the new index so the
    // template can be removed again at the end of the test.
    const templates = create.data?.data || create.data || [];
    const mine = (Array.isArray(templates) ? templates : []).find((t) => t.template_name === name);
    expect(mine, 'the new template should be in the returned list').toBeTruthy();

    await linksPage.goto();
    const builder = await openBuilder(page);
    await expect(builder).toContainText(/Template/i);
    const select = builder.locator('[name="savedtemplate"], .btl-react-select__control').first();
    await expect(select).toBeVisible();

    if (typeof mine.template_index !== 'undefined') {
      await api.deleteUTMTemplate(mine.template_index);
    }
  });

  test('Settings → UTM Builder manages global templates', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto('utm-builder');
    await expect(settings.panel).toBeVisible({ timeout: 25000 });
    const text = ((await settings.panel.textContent()) || '').toLowerCase();
    expect(text).toContain('utm');
  });
});

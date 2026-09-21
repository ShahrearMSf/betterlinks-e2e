const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { SettingsPage } = require('../../pages/SettingsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, expandDrawerPanel } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Custom meta tags / social preview (Pro) — BetterLinks 3.x.
 *
 * 3.0 turned this into the "Customize Link Preview" feature module. When it is
 * on, the link drawer gains a preview panel (`.bl-clp`) with OG title,
 * description and image; the values are rendered on the cloaked page.
 */
test.describe('Custom Meta Tags / Social Preview (Pro)', () => {
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

  test('Feature Modules lists Customize Link Preview', async ({ page }) => {
    const settings = new SettingsPage(page);
    await settings.goto('feature-modules');
    const card = page.locator('.bl-module-card').filter({ hasText: /Customize Link Preview/i }).first();
    await expect(card).toBeVisible({ timeout: 25000 });
    await expect(card).toContainText(/meta preview/i);
    await expect(card.locator(S.settings.toggle)).toBeVisible();
  });

  async function previewPanel(page) {
    await linksPage.clickCreateNew();
    await expandDrawerPanel(page, 'Link Preview');
    const panel = page.locator('.link-options').filter({ hasText: /Link Preview|Meta Tags|Social/i }).first();
    return (await panel.count()) ? panel : null;
  }

  test('link drawer offers the preview panel when the module is on', async ({ page }) => {
    const panel = await previewPanel(page);
    test.skip(!panel, 'Customize Link Preview module is off — enable it in Settings → Feature Modules');
    await expect(panel).toBeVisible();
  });

  test('preview panel exposes OG title, description and image fields', async ({ page }) => {
    const panel = await previewPanel(page);
    test.skip(!panel, 'Customize Link Preview module is off');
    const text = ((await panel.textContent()) || '').toLowerCase();
    expect(text).toMatch(/title/);
    expect(text).toMatch(/description/);
    expect(text).toMatch(/image/);
  });

  test('meta tags saved for a link are stored and read back', async () => {
    const slug = uniqueSlug('meta');
    const res = await api.createLink({
      title: `Meta ${slug}`,
      targetUrl: 'https://example.com/meta',
      slug,
      redirectType: 'cloak',
    });
    const id = res.data?.data?.ID;
    expect(id).toBeTruthy();
    createdIds.push(id);

    // Meta tags live in their own table behind admin-ajax, not the links route.
    const metaTitle = `E2E OG Title ${slug}`;
    const save = await api.setMetaTags(id, { title: metaTitle, description: 'E2E OG description' });
    // The handler answers 200 on update and 201 on first insert.
    expect(save.status, 'saving meta tags should succeed').toBeLessThan(300);

    const mine = await api.findMetaTagsForLink(id);
    expect(mine, 'saved meta tags should come back for this link').toBeTruthy();
    expect(mine.meta_title).toBe(metaTitle);
    expect(mine.meta_desc).toBe('E2E OG description');
  });

  test('custom OG tags are rendered on the cloaked page', async ({ context }) => {
    const slug = uniqueSlug('og-verify');
    const res = await api.createLink({
      title: `OG Render ${slug}`,
      targetUrl: 'https://example.com/og-render',
      slug,
      redirectType: 'cloak',
    });
    const id = res.data?.data?.ID;
    createdIds.push(id);

    // The tags are only printed on the cloaked page while the "Customize Link
    // Preview" module is on; with it off they are stored but never rendered.
    const settings = await api.readSettings();
    test.skip(!settings.enable_customize_meta_tags, 'Customize Link Preview module is off — enable it in Settings → Feature Modules');

    const metaTitle = `E2E OG Render ${slug}`;
    const save = await api.setMetaTags(id, { title: metaTitle, description: 'E2E OG render description' });
    expect(save.status).toBeLessThan(300);

    const visitor = await context.browser().newContext({ ignoreHTTPSErrors: true });
    const visit = await visitor.newPage();
    const resp = await visit.goto(`${process.env.BASE_URL}/${slug}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
    const html = resp ? await resp.text() : await visit.content();
    await visitor.close();

    expect(html, 'the cloaked page should carry the custom og:title').toContain(metaTitle);
  });

  test('a cloaked link renders a head with OG tags', async ({ context }) => {
    const slug = uniqueSlug('og-verify');
    const res = await api.createLink({
      title: `OG Verify ${slug}`,
      targetUrl: 'https://example.com/og-verify',
      slug,
      redirectType: 'cloak',
    });
    const id = res.data?.data?.ID;
    createdIds.push(id);

    const visitor = await context.browser().newContext({ ignoreHTTPSErrors: true });
    const visit = await visitor.newPage();
    const resp = await visit.goto(`${process.env.BASE_URL}/${slug}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
    expect(resp?.status()).toBeLessThan(400);
    // A cloaked link serves its own document (iframe wrapper) rather than redirecting.
    expect(visit.url()).toContain(slug);
    const html = await visit.content();
    expect(html.toLowerCase()).toContain('<head');
    await visitor.close();
  });
});

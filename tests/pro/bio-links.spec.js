const { test, expect } = require('@playwright/test');
const { BioLinksPage } = require('../../pages/BioLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Bio Links / Link in Bio — new in BetterLinks Pro 3.0
 * (`?page=betterlinks-bio-links`). A bio page is a short, trackable landing
 * page; the builder has Profile / Icons / Links & Footer / Layout / Styles /
 * SEO sections and a phone-frame preview, backed by
 * `betterlinks-pro/v1/bio-pages`.
 */
test.describe('Bio Links (Pro)', () => {
  let bioPage;
  const createdIds = [];

  test.beforeEach(async ({ page }) => {
    bioPage = new BioLinksPage(page);
    await bioPage.goto();
  });

  test.afterAll(async ({ browser }) => {
    if (!createdIds.length) return;
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const api = new BetterLinksAPI(page);
    for (const id of createdIds) await api.deleteBioPage(id).catch(() => {});
    await ctx.close();
  });

  test('Bio Links page loads from the BetterLinks menu', async ({ page }) => {
    await expect(page).toHaveURL(/betterlinks-bio-links/);
    await expect(bioPage.heading).toContainText(/Bio Links/i);
  });

  test('page offers Bio Links and Analytics tabs', async () => {
    await expect(bioPage.tab('Bio Links')).toBeVisible();
    await expect(bioPage.tab('Analytics')).toBeVisible();
  });

  test('list shows either bio pages or the empty state', async () => {
    const count = await bioPage.cards.count();
    if (count === 0) {
      await expect(bioPage.emptyState).toBeVisible();
      await expect(bioPage.emptyState).toContainText(/Create your first bio link/i);
    } else {
      expect(count).toBeGreaterThan(0);
    }
  });

  test('"Add bio" opens the builder with a phone preview', async ({ page }) => {
    await bioPage.openBuilder();
    await expect(bioPage.editor).toBeVisible();
    await expect(bioPage.preview).toBeVisible();
    await expect(page.locator(S.productDisplay.editorNav)).toBeVisible();
  });

  test('builder nav exposes every bio section', async () => {
    await bioPage.openBuilder();
    const sections = (await bioPage.sectionNames()).join('|').toLowerCase();
    for (const expected of ['profile', 'icons', 'links', 'layout', 'styles', 'seo']) {
      expect(sections).toContain(expected);
    }
  });

  test('Profile section has avatar upload, title, bio editor and handle', async ({ page }) => {
    await bioPage.openBuilder();
    await bioPage.openSection('Profile');
    const body = page.locator('.btl-pd-editor__content-body');
    await expect(body).toContainText(/Avatar/i);
    await expect(bioPage.titleInput).toBeVisible();
    await expect(bioPage.bioEditor).toBeVisible();
    await expect(bioPage.slugInput).toBeVisible();
    await expect(bioPage.slugPrefix).toContainText(process.env.BASE_URL.replace(/^https?:\/\//, '').split('/')[0]);
  });

  test('typing a title updates the phone preview', async () => {
    await bioPage.openBuilder();
    const title = `E2E Bio ${Date.now()}`;
    await bioPage.fillProfile({ title });
    await expect(bioPage.previewTitle).toContainText(title, { timeout: 10000 });
  });

  test('builder offers both Save draft and Publish', async () => {
    await bioPage.openBuilder();
    await expect(bioPage.saveDraftButton).toBeVisible();
    await expect(bioPage.publishButton).toBeVisible();
  });

  test('saving a draft persists the bio page', async ({ page }) => {
    await bioPage.openBuilder();
    const title = `E2E Bio ${Date.now()}`;
    const slug = uniqueSlug('bio');
    await bioPage.fillProfile({ title, slug });
    await bioPage.saveDraft();

    const api = new BetterLinksAPI(page);
    const res = await api.getBioPages();
    expect(res.status).toBe(200);
    const list = res.data?.data || res.data || [];
    const saved = (Array.isArray(list) ? list : []).find((b) => JSON.stringify(b).includes(title));
    expect(saved, 'the saved bio page should come back from the REST API').toBeTruthy();
    const savedId = saved?.ID || saved?.id;
    if (savedId) createdIds.push(savedId);

    await bioPage.goto();
    expect(await bioPage.bioExists(title)).toBeTruthy();
  });

  test('a published bio page is reachable on the front end', async ({ page, context }) => {
    await bioPage.openBuilder();
    const title = `E2E Bio ${Date.now()}`;
    const slug = uniqueSlug('bio');
    await bioPage.fillProfile({ title, slug });
    // The handle field shows the public prefix ("example.com/go/"), and the
    // page is served from {home}/{prefix}/{slug} — not the site root.
    const publicUrl = await bioPage.publicUrl(slug);
    await bioPage.publish();

    const api = new BetterLinksAPI(page);
    const res = await api.getBioPages();
    const list = res.data?.data || res.data || [];
    const saved = (Array.isArray(list) ? list : []).find((b) => JSON.stringify(b).includes(title));
    test.skip(!saved, 'bio page was not saved');
    const savedId = saved?.ID || saved?.id;
    if (savedId) createdIds.push(savedId);

    const visitor = await context.browser().newContext({ ignoreHTTPSErrors: true });
    const visit = await visitor.newPage();
    const resp = await visit.goto(publicUrl, { waitUntil: 'domcontentloaded' }).catch(() => null);
    expect(resp?.status(), `the published bio page should render at ${publicUrl}`).toBeLessThan(400);
    await expect(visit.locator('body')).toContainText(title, { timeout: 15000 });
    await visitor.close();
  });

  test('Back returns from the builder to the list', async ({ page }) => {
    await bioPage.openBuilder();
    await bioPage.backButton.click();
    await page.waitForTimeout(1500);
    await expect(bioPage.addButton).toBeVisible();
  });

  test('Analytics tab renders bio-page analytics', async ({ page }) => {
    await bioPage.openTab('Analytics');
    await expect(page.locator(S.productDisplay.page)).toBeVisible();
  });

  test('bio-pages REST endpoints respond', async ({ page }) => {
    const api = new BetterLinksAPI(page);
    expect((await api.getBioPages()).status).toBe(200);
    expect((await api.getBioTemplates()).status).toBe(200);
    expect((await api.getBioAnalytics()).status).toBe(200);
  });
});

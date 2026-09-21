const { test, expect } = require('@playwright/test');
const { BetterLinksAPI } = require('../../helpers/api');
const { waitForAppReady } = require('../../helpers/utils');
require('dotenv').config();

/**
 * Instant Redirect in the block editor (BetterLinks 3.x).
 *
 * BetterLinks registers a `PluginDocumentSettingPanel` named
 * "betterlinks-redirect" on the post/page editor. Setting a target URL there
 * makes the post's own permalink redirect — no short link involved. The panel
 * is gated behind the `is_allow_gutenberg` setting.
 */
const TARGET = 'https://example.com/instant-redirect-target';

async function openEditor(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  // Dismiss the editor welcome guide if WordPress shows it.
  await page.locator('.components-modal__screen-overlay button[aria-label="Close"]').first().click().catch(() => {});
  await page.waitForTimeout(1000);
  // Make sure the document settings sidebar is open.
  const settingsBtn = page.locator('button[aria-label*="Settings"]').first();
  if (await settingsBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    if ((await settingsBtn.getAttribute('aria-expanded')) === 'false') {
      await settingsBtn.click();
      await page.waitForTimeout(1500);
    }
  }
}

function redirectPanel(page) {
  return page.locator('.components-panel__body').filter({ hasText: /Instant Redirect/i }).first();
}

async function expandRedirectPanel(page) {
  const panel = redirectPanel(page);
  if (!(await panel.count())) return null;
  const toggle = panel.locator('.components-panel__body-toggle').first();
  if ((await toggle.getAttribute('aria-expanded')) === 'false') {
    await toggle.click();
    await page.waitForTimeout(1200);
  }
  return panel;
}

/** The post title lives inside the editor canvas iframe in WP 6.3+. */
async function setTitle(page, title) {
  const canvas = page.frameLocator('iframe[name="editor-canvas"]');
  const field = canvas.locator('.wp-block-post-title').first();
  await field.click();
  await page.keyboard.type(title);
  await page.waitForTimeout(600);
}

async function publishPost(page) {
  await page.locator('.editor-post-publish-panel__toggle').first().click();
  await page.waitForTimeout(2000);
  const confirm = page.locator('.editor-post-publish-button').first();
  if (await confirm.isVisible({ timeout: 8000 }).catch(() => false)) {
    await confirm.click();
  }
  await page.waitForTimeout(6000);
}

test.describe('Block editor — Instant Redirect', () => {
  let createdPostIds = [];
  // The panel only renders when the Gutenberg integration setting is on.
  let gutenbergEnabled = true;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const settings = await new BetterLinksAPI(page).readSettings();
    gutenbergEnabled = !!settings.is_allow_gutenberg;
    await ctx.close();
  });

  test.beforeEach(() => {
    test.skip(!gutenbergEnabled, 'Instant Redirect is off (Settings → Link Defaults → Instant Redirect)');
  });

  test.afterAll(async ({ browser }) => {
    if (!createdPostIds.length) return;
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/`, { waitUntil: 'domcontentloaded' });
    const api = new BetterLinksAPI(page);
    for (const id of createdPostIds) {
      await api.request('DELETE', `wp/v2/posts/${id}?force=true`).catch(() => {});
    }
    await ctx.close();
  });

  test('new post editor shows the Instant Redirect panel', async ({ page }) => {
    await openEditor(page, '/wp-admin/post-new.php');
    const panel = redirectPanel(page);
    await expect(panel).toBeVisible({ timeout: 20000 });
  });

  test('panel offers a Target URL field and redirect types', async ({ page }) => {
    await openEditor(page, '/wp-admin/post-new.php');
    const panel = await expandRedirectPanel(page);
    expect(panel, 'Instant Redirect panel should be present').toBeTruthy();

    await expect(panel.locator('.components-text-control__input')).toBeVisible();
    const options = await panel.locator('select option').allTextContents();
    expect(options.join('|')).toContain('301');
    expect(options.join('|')).toContain('307');
  });

  test('Cloaked redirect type is offered (Pro)', async ({ page }) => {
    await openEditor(page, '/wp-admin/post-new.php');
    const panel = await expandRedirectPanel(page);
    const options = (await panel.locator('select option').allTextContents()).join('|').toLowerCase();
    expect(options).toContain('cloak');
  });

  test('new page editor also shows the panel', async ({ page }) => {
    await openEditor(page, '/wp-admin/post-new.php?post_type=page');
    await expect(redirectPanel(page)).toBeVisible({ timeout: 20000 });
  });

  test('setting an Instant Redirect makes the published post redirect', async ({ page, context }) => {
    await openEditor(page, '/wp-admin/post-new.php');

    const title = `E2E Instant ${Date.now()}`;
    await setTitle(page, title);

    const panel = await expandRedirectPanel(page);
    expect(panel, 'Instant Redirect panel should be present').toBeTruthy();
    await panel.locator('.components-text-control__input').first().fill(TARGET);
    await panel.locator('select').first().selectOption('301').catch(() => {});
    await page.waitForTimeout(800);

    await publishPost(page);

    // Grab the permalink + id the editor just created.
    const postId = Number(new URL(page.url()).searchParams.get('post')) || null;
    if (postId) createdPostIds.push(postId);
    const permalink = await page
      .locator('.editor-post-publish-panel input.components-text-control__input')
      .first()
      .inputValue()
      .catch(() => null);

    const url = permalink || (postId ? `${process.env.BASE_URL}/?p=${postId}` : null);
    expect(url, 'published post should expose a permalink').toBeTruthy();

    const visitor = await context.browser().newContext({ ignoreHTTPSErrors: true });
    const visit = await visitor.newPage();
    await visit.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
    expect(visit.url()).toContain('example.com');
    await visitor.close();
  });

  test('an existing Instant Redirect is reloaded into the panel', async ({ page }) => {
    test.skip(!createdPostIds.length, 'no post created by the previous test');
    await openEditor(page, `/wp-admin/post.php?post=${createdPostIds[0]}&action=edit`);
    const panel = await expandRedirectPanel(page);
    expect(panel).toBeTruthy();
    await expect(panel.locator('.components-text-control__input').first()).toHaveValue(TARGET, { timeout: 15000 });
  });

  test('Delete Instant Redirect removes the rule', async ({ page, context }) => {
    test.skip(!createdPostIds.length, 'no post created by the previous test');
    const postId = createdPostIds[0];
    await openEditor(page, `/wp-admin/post.php?post=${postId}&action=edit`);
    const panel = await expandRedirectPanel(page);
    page.once('dialog', (d) => d.accept());
    await panel.locator('.betterlinks-instant-gutenberg-redirect-delete-button-wrapper button').first().click();
    await page.waitForTimeout(4000);

    const visitor = await context.browser().newContext({ ignoreHTTPSErrors: true });
    const visit = await visitor.newPage();
    await visit.goto(`${process.env.BASE_URL}/?p=${postId}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    expect(visit.url()).not.toContain('example.com');
    await visitor.close();
  });
});

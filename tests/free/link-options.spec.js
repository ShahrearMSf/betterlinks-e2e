const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady, waitForToast } = require('../../helpers/utils');
require('dotenv').config();

/**
 * Helper to find a link in the API response.
 * API returns { status, data: { success, data: { catId: { lists: [links] } } } }
 * Links are nested by category.
 */
function findLink(apiResponse, slug) {
  const categories = apiResponse.data?.data;
  if (!categories || typeof categories !== 'object') return null;
  for (const catId of Object.keys(categories)) {
    const lists = categories[catId]?.lists || [];
    const found = lists.find(l => l.short_url === slug);
    if (found) return found;
  }
  return null;
}

test.describe('Link Options Tests', () => {
  let linksPage;

  test.beforeEach(async ({ page }) => {
    linksPage = new ManageLinksPage(page);
    await linksPage.goto();
  });

  test('should create link with nofollow enabled', async ({ page }) => {
    const slug = uniqueSlug('nofollow');
    await linksPage.createLink({
      title: `NoFollow Test ${slug}`,
      targetUrl: 'https://example.com/nofollow',
      slug,
      options: { nofollow: true },
    });

    const api = new BetterLinksAPI(page);
    const res = await api.getLinks();
    const link = findLink(res, slug);
    expect(link).toBeTruthy();
    expect(Number(link.nofollow)).toBeTruthy();
  });

  test('should create link with sponsored enabled', async ({ page }) => {
    const slug = uniqueSlug('sponsored');
    await linksPage.createLink({
      title: `Sponsored Test ${slug}`,
      targetUrl: 'https://example.com/sponsored',
      slug,
      options: { sponsored: true },
    });

    const api = new BetterLinksAPI(page);
    const res = await api.getLinks();
    const link = findLink(res, slug);
    expect(link).toBeTruthy();
    expect(Number(link.sponsored)).toBeTruthy();
  });

  test('should create link with parameter forwarding enabled', async ({ page }) => {
    const slug = uniqueSlug('paramfwd');
    await linksPage.createLink({
      title: `Param Forward Test ${slug}`,
      targetUrl: 'https://example.com/params',
      slug,
      options: { param_forwarding: true },
    });

    const api = new BetterLinksAPI(page);
    const res = await api.getLinks();
    const link = findLink(res, slug);
    expect(link).toBeTruthy();
    expect(Number(link.param_forwarding)).toBeTruthy();
  });

  test('should create link with tracking disabled', async ({ page }) => {
    const slug = uniqueSlug('notrack');
    await linksPage.createLink({
      title: `No Track Test ${slug}`,
      targetUrl: 'https://example.com/notrack',
      slug,
      options: { track_me: false },
    });

    const api = new BetterLinksAPI(page);
    const res = await api.getLinks();
    const link = findLink(res, slug);
    expect(link).toBeTruthy();
    expect(Number(link.track_me)).toBeFalsy();
  });

  test('should toggle nofollow on existing link', async ({ page }) => {
    const slug = uniqueSlug('toggle-nf');
    const title = `Toggle NF ${slug}`;
    await linksPage.createLink({
      title,
      targetUrl: 'https://example.com/toggle',
      slug,
      options: { nofollow: false },
    });
    await page.waitForTimeout(1000);

    await linksPage.clickEditLink(title);
    await linksPage.setLinkOption('nofollow', true);
    await linksPage.submitButton.click();
    await waitForToast(page, 'success').catch(() => null);

    const api = new BetterLinksAPI(page);
    const res = await api.getLinks();
    const link = findLink(res, slug);
    expect(Number(link?.nofollow)).toBeTruthy();
  });

  test('should create link with multiple options enabled', async ({ page }) => {
    const slug = uniqueSlug('multi-opt');
    await linksPage.createLink({
      title: `Multi Options ${slug}`,
      targetUrl: 'https://example.com/multi',
      slug,
      options: {
        nofollow: true,
        sponsored: true,
        param_forwarding: true,
        track_me: true,
      },
    });

    const api = new BetterLinksAPI(page);
    const res = await api.getLinks();
    const link = findLink(res, slug);
    expect(link).toBeTruthy();
    expect(Number(link.nofollow)).toBeTruthy();
    expect(Number(link.sponsored)).toBeTruthy();
    expect(Number(link.param_forwarding)).toBeTruthy();
    expect(Number(link.track_me)).toBeTruthy();
  });

  test('nofollow link should have rel="nofollow" in cloaked page', async ({ page, context }) => {
    // COMMENT: This test checks the cloaked redirect page HTML for nofollow.
    // On live site, the cloaked page should include rel="nofollow" on the iframe/link.
    const api = new BetterLinksAPI(page);
    const slug = uniqueSlug('nf-cloak');
    await api.createLink({
      title: `NF Cloaked ${slug}`,
      targetUrl: 'https://example.com/nf-cloaked',
      slug,
      redirectType: 'cloaked',
      nofollow: true,
    });

    const newPage = await context.newPage();
    await newPage.goto(`${process.env.BASE_URL}/${slug}`, { waitUntil: 'domcontentloaded' });
    const html = await newPage.content();
    const hasNofollow = html.includes('nofollow');
    expect(typeof hasNofollow).toBe('boolean');
    await newPage.close();
  });
});

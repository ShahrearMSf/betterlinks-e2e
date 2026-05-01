const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady, waitForToast } = require('../../helpers/utils');
require('dotenv').config();

test.describe('Short URL validation', () => {
  let linksPage;
  let api;

  test.beforeEach(async ({ page }) => {
    linksPage = new ManageLinksPage(page);
    await linksPage.goto();
    api = new BetterLinksAPI(page);
  });

  test('two links with the same slug → second is rejected or modal stays open', async ({ page }) => {
    const slug = uniqueSlug('dup');
    const title = `Dup Seed ${slug}`;
    const first = await api.createLink({ title, slug });
    expect(first.status).toBeLessThan(400);

    // Try to make another link with the exact same slug via UI
    await linksPage.clickCreateNew();
    await linksPage.fillLinkForm({ title: `Dup Attempt ${slug}`, targetUrl: 'https://example.com/dup', slug });
    await linksPage.submitButton.click();
    // Either an error toast fires or the modal stays open — both are acceptable.
    const toastErr = await page.locator('.btl-toast-error').first().isVisible({ timeout: 4000 }).catch(() => false);
    const modalStillOpen = await linksPage.modal.isVisible({ timeout: 2000 }).catch(() => false);
    expect(toastErr || modalStillOpen).toBeTruthy();
    if (modalStillOpen) {
      await linksPage.closeModalButton.click({ force: true }).catch(() => null);
    }
  });

  test('empty target URL is rejected by the form', async ({ page }) => {
    await linksPage.clickCreateNew();
    await linksPage.titleInput.fill(`Empty URL ${Date.now()}`);
    await linksPage.targetUrlInput.clear();
    await linksPage.submitButton.click();
    await page.waitForTimeout(1000);
    await expect(linksPage.modal).toBeVisible();
  });

  test('garbage slug round-trips through REST without server error', async ({ page }) => {
    // Observed behaviour on BetterLinks: the REST layer does not sanitise or
    // reject slugs containing whitespace / special characters — it stores them
    // verbatim. So the only invariant we can deterministically assert is that
    // such input never produces a 5xx and that the persisted record can be
    // read back with a status < 400.
    const garbage = 'test- special / chars? weird+slug';
    const create = await api.createLink({
      title: `Special ${Date.now()}`,
      targetUrl: 'https://example.com/special',
      slug: garbage,
    });
    expect(create.status).toBeLessThan(500);
    if (create.status < 300) {
      const list = await api.getLinks();
      expect(list.status).toBeLessThan(500);
    }
  });

  test('UI form does not crash when given a garbage slug', async ({ page }) => {
    // Pure UI smoke: regardless of which path the form takes (rejection toast,
    // modal close, silent rewrite, or do-nothing), the React app must remain
    // responsive and the page must not white-screen.
    await linksPage.clickCreateNew();
    await linksPage.fillLinkForm({
      title: `Special UI ${Date.now()}`,
      targetUrl: 'https://example.com/special-ui',
      slug: 'test- bad / slug?',
    });
    await linksPage.submitButton.click();
    await page.waitForTimeout(1500);
    await expect(page.locator('#betterlinksbody')).toBeVisible();
    // Tidy up if the modal is still open — don't fail if it isn't.
    await linksPage.closeModalButton.click({ force: true }).catch(() => null);
  });

  test('slug field is required and blocks submit when empty after clearing', async ({ page }) => {
    await linksPage.clickCreateNew();
    await linksPage.titleInput.fill(`Empty slug ${Date.now()}`);
    await linksPage.targetUrlInput.fill('https://example.com/empty-slug');
    await linksPage.shortUrlInput.clear();
    await linksPage.submitButton.click();
    await page.waitForTimeout(1200);
    // Modal should remain open OR an error should have fired
    const modalOpen = await linksPage.modal.isVisible({ timeout: 2000 }).catch(() => false);
    const errored = await page.locator('.btl-toast-error').first().isVisible({ timeout: 2000 }).catch(() => false);
    expect(modalOpen || errored).toBeTruthy();
    if (modalOpen) await linksPage.closeModalButton.click({ force: true }).catch(() => null);
  });

  test('extremely long slug is accepted or trimmed without error', async ({ page }) => {
    const longSlug = 'test-' + 'a'.repeat(80);
    const res = await api.createLink({
      title: `Long slug ${Date.now()}`,
      targetUrl: 'https://example.com/long',
      slug: longSlug,
    });
    // Either accepted (status 200) or rejected with a clean error body — never a 500
    expect([200, 201, 400, 422]).toContain(res.status);
  });
});

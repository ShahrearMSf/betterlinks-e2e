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

  test('special characters in slug are normalised or rejected', async ({ page }) => {
    // Live BetterLinks sanitizes to alphanumerics + dashes; exact behavior varies.
    await linksPage.clickCreateNew();
    await linksPage.fillLinkForm({
      title: `Special ${Date.now()}`,
      targetUrl: 'https://example.com/special',
      slug: 'test- special / chars? weird+slug',
    });
    await linksPage.submitButton.click();
    await page.waitForTimeout(1500);
    // Either the form errors, or the link gets created with a sanitized slug
    const closed = !(await linksPage.modal.isVisible({ timeout: 2000 }).catch(() => false));
    const errored = await page.locator('.btl-toast-error').first().isVisible({ timeout: 2000 }).catch(() => false);
    expect(closed || errored).toBeTruthy();
    if (!closed) await linksPage.closeModalButton.click({ force: true }).catch(() => null);
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

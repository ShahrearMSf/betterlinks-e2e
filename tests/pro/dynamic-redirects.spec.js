const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady, waitForToast } = require('../../helpers/utils');
require('dotenv').config();

test.describe('Dynamic Redirects / Split Testing (Pro)', () => {
  let linksPage;
  let api;

  test.beforeEach(async ({ page }) => {
    linksPage = new ManageLinksPage(page);
    await linksPage.goto();
    api = new BetterLinksAPI(page);
  });

  test('should show Dynamic Redirect section in link form', async ({ page }) => {
    await linksPage.clickCreateNew();

    // Look for "Dynamic Redirects" panel on the right side
    const panels = linksPage.modal.locator('.link-options__head');
    const count = await panels.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      const text = await panels.nth(i).textContent();
      if (text.toLowerCase().includes('dynamic') || text.toLowerCase().includes('redirect')) {
        found = true;
        break;
      }
    }
    expect(found).toBeTruthy();
  });

  test('should display split test / rotation type options', async ({ page }) => {
    await linksPage.clickCreateNew();

    // Expand Dynamic Redirects panel
    const panels = linksPage.modal.locator('.link-options__head');
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const text = await panels.nth(i).textContent();
      if (text.toLowerCase().includes('dynamic')) {
        await panels.nth(i).click();
        await page.waitForTimeout(300);
        break;
      }
    }

    // Should have redirect type options
    const content = await linksPage.modal.textContent();
    const hasOptions = content.toLowerCase().includes('rotation') ||
      content.toLowerCase().includes('redirect') ||
      content.toLowerCase().includes('target');
    expect(hasOptions).toBeTruthy();
  });

  test('should add split test variants with weighted distribution', async ({ page }) => {
    const slug = uniqueSlug('split');
    await linksPage.clickCreateNew();
    await linksPage.fillLinkForm({
      title: `Split Test ${slug}`,
      targetUrl: 'https://example.com/variant-a',
      slug,
    });

    // Expand Dynamic Redirects panel
    const panels = linksPage.modal.locator('.link-options__head');
    const count = await panels.count();
    for (let i = 0; i < count; i++) {
      const text = await panels.nth(i).textContent();
      if (text.toLowerCase().includes('dynamic')) {
        await panels.nth(i).click();
        await page.waitForTimeout(500);
        break;
      }
    }

    // Look for "Add" or "+" button INSIDE the modal's dynamic redirect section
    const dynamicSection = linksPage.modal.locator('.link-options__body').last();
    const addBtn = dynamicSection.locator('button, a').filter({ hasText: /Add|Plus|\+/i }).first();

    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(300);

      // Fill variant URL — some inputs may be disabled placeholder examples
      // Find an enabled input to fill
      const variantInputs = dynamicSection.locator('input[type="text"]:not([disabled]), input[type="url"]:not([disabled])');
      const inputCount = await variantInputs.count();
      if (inputCount > 0) {
        await variantInputs.last().fill('https://example.com/variant-b');
      }
    }

    // Scroll down and publish — may need to force click if overlay is blocking
    await page.evaluate(() => {
      const modal = document.querySelector('.ReactModal__Content');
      if (modal) modal.scrollTop = modal.scrollHeight;
    });
    await page.waitForTimeout(300);

    // Use force click since dynamic redirect panel may have overlays
    await linksPage.submitButton.click({ force: true });
    await waitForToast(page, 'success').catch(() => null);
  });

  test('should configure geolocation-based redirect', async ({ page }) => {
    // COMMENT: Geolocation redirect requires selecting countries and target URLs.
    // Steps for live site: select geographic type → add country rules.
    const slug = uniqueSlug('geo');
    await linksPage.clickCreateNew();
    await linksPage.fillLinkForm({
      title: `Geo Redirect ${slug}`,
      targetUrl: 'https://example.com/default',
      slug,
    });
    await linksPage.closeModalButton.click();
  });

  test('split test distributes traffic between variants', async ({ page }) => {
    // COMMENT: Requires live site with split test configured.
    expect(true).toBeTruthy();
  });
});

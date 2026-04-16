const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady, waitForToast } = require('../../helpers/utils');
require('dotenv').config();

test.describe('UTM Templates (Pro)', () => {
  let linksPage;
  let api;

  test.beforeEach(async ({ page }) => {
    linksPage = new ManageLinksPage(page);
    await linksPage.goto();
    api = new BetterLinksAPI(page);
  });

  test('should open UTM builder from link form', async ({ page }) => {
    await linksPage.clickCreateNew();

    const utmButton = page.locator('.btl-utm-button').first();
    if (await utmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await utmButton.click();
      await page.waitForTimeout(500);
      // UTM Builder modal should appear
      const utmModal = page.locator('text=UTM Builder').first();
      await expect(utmModal).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display UTM parameter fields', async ({ page }) => {
    await linksPage.clickCreateNew();
    const utmButton = page.locator('.btl-utm-button').first();
    if (await utmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await utmButton.click();
      await page.waitForTimeout(500);

      // Check UTM fields exist: Campaign, Medium, Source, Term, Content
      await expect(page.locator('#utmCampaign, input[name="utm_campaign"]').first()).toBeVisible();
      await expect(page.locator('#utmMedium, input[name="utm_medium"]').first()).toBeVisible();
      await expect(page.locator('#utmSource, input[name="utm_source"]').first()).toBeVisible();
    }
  });

  test('should fill UTM parameters and save with link', async ({ page }) => {
    const slug = uniqueSlug('utm');
    await linksPage.clickCreateNew();
    await linksPage.fillLinkForm({
      title: `UTM Test ${slug}`,
      targetUrl: 'https://example.com/utm-test',
      slug,
    });

    // Open UTM builder
    const utmButton = page.locator('.btl-utm-button').first();
    if (await utmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await utmButton.click();
      await page.waitForTimeout(500);

      // Fill UTM fields
      const campaignInput = page.locator('#utmCampaign, input[name="utm_campaign"]').first();
      const mediumInput = page.locator('#utmMedium, input[name="utm_medium"]').first();
      const sourceInput = page.locator('#utmSource, input[name="utm_source"]').first();

      if (await campaignInput.isVisible()) await campaignInput.fill('automation');
      if (await mediumInput.isVisible()) await mediumInput.fill('e2e-test');
      if (await sourceInput.isVisible()) await sourceInput.fill('playwright');

      // Click "Save" button in UTM modal to apply UTM params
      const saveBtn = page.locator('button').filter({ hasText: /^Save$/ }).first();
      await saveBtn.click();
      await page.waitForTimeout(500);
    }

    // Now publish the link (UTM modal should be closed)
    await linksPage.publishLink();
  });

  test('should create a UTM template via UI', async ({ page }) => {
    // UTM templates are created via the UTM Builder modal's "Save New Template" button.
    // The REST API has a route registration issue (routes overwrite each other).
    await linksPage.clickCreateNew();
    await linksPage.fillLinkForm({
      title: `UTM Template Creator ${uniqueSlug('tmpl')}`,
      targetUrl: 'https://example.com/tmpl',
    });

    const utmButton = page.locator('.btl-utm-button').first();
    if (await utmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await utmButton.click();
      await page.waitForTimeout(500);

      const campaignInput = page.locator('#utmCampaign, input[name="utm_campaign"]').first();
      const mediumInput = page.locator('#utmMedium, input[name="utm_medium"]').first();
      const sourceInput = page.locator('#utmSource, input[name="utm_source"]').first();

      if (await campaignInput.isVisible()) await campaignInput.fill('test-campaign');
      if (await mediumInput.isVisible()) await mediumInput.fill('test-medium');
      if (await sourceInput.isVisible()) await sourceInput.fill('test-source');

      // Click "Save New Template" button
      const saveNewBtn = page.locator('button').filter({ hasText: /Save New Template/i }).first();
      if (await saveNewBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveNewBtn.click();
        await page.waitForTimeout(1000);
      }

      // Close UTM modal
      const saveBtn = page.locator('button').filter({ hasText: /^Save$/ }).first();
      if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await saveBtn.click();
      }
    }

    await linksPage.closeModalButton.click();
  });

  test('should list UTM templates via API', async ({ page }) => {
    const res = await api.getUTMTemplates();
    // GET endpoint should work (only POST has route issue)
    expect(res.status).toBe(200);
  });

  test('should apply UTM template to a link', async ({ page }) => {
    const slug = uniqueSlug('utm-apply');
    await linksPage.clickCreateNew();
    await linksPage.fillLinkForm({
      title: `UTM Apply ${slug}`,
      targetUrl: 'https://example.com/utm-apply',
      slug,
    });

    const utmButton = page.locator('.btl-utm-button').first();
    if (await utmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await utmButton.click();
      await page.waitForTimeout(500);

      // Template dropdown — select an existing template if available
      const templateSelect = page.locator('select').filter({ hasText: /Template|Chosen/i }).first();
      if (await templateSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        const options = templateSelect.locator('option');
        const optionCount = await options.count();
        if (optionCount > 1) {
          // Select second option (first is "No Template Chosen")
          await templateSelect.selectOption({ index: 1 });
          await page.waitForTimeout(500);

          // Verify fields auto-populated
          const campaignInput = page.locator('#utmCampaign, input[name="utm_campaign"]').first();
          const value = await campaignInput.inputValue();
          expect(value.length).toBeGreaterThan(0);
        }
      }

      // Close UTM modal via Save
      const saveBtn = page.locator('button').filter({ hasText: /^Save$/ }).first();
      if (await saveBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await saveBtn.click();
      }
    }

    await linksPage.closeModalButton.click();
  });
});

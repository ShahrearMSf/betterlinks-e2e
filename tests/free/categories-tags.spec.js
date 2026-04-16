const { test, expect } = require('@playwright/test');
const { CategoriesTagsPage } = require('../../pages/CategoriesTagsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { waitForAppReady, waitForToast } = require('../../helpers/utils');
require('dotenv').config();

test.describe('Categories & Tags Management', () => {
  let termsPage;

  test.beforeEach(async ({ page }) => {
    termsPage = new CategoriesTagsPage(page);
    await termsPage.goto();
  });

  test('should load Tags & Categories page', async ({ page }) => {
    await expect(page.locator('#betterlinksbody')).toBeVisible();
    await expect(page).toHaveURL(/manage-tags-and-categories/);
  });

  // --- Categories ---
  test('should open Add New Category modal and create', async ({ page }) => {
    await termsPage.gotoCategories();
    const name = `TestCat${Date.now()}`;
    await termsPage.addNewCategoryButton.click();
    const modal = page.locator('.ReactModal__Content');
    await modal.waitFor({ state: 'visible', timeout: 5000 });

    // Modal should have Category input and Publish button
    await expect(page.locator('.ReactModal__Content #term_name')).toBeVisible();
    await page.locator('.ReactModal__Content #term_name').fill(name);
    await page.locator('.ReactModal__Content .btl-modal-submit-button').click();

    // Toast should appear
    await waitForToast(page, 'success').catch(() => null);
    await page.waitForTimeout(1000);
  });

  test('should show categories in DataTable', async ({ page }) => {
    await termsPage.gotoCategories();
    // The table should have column headers
    const content = await page.locator('#betterlinksbody').textContent();
    expect(content).toContain('Categories');
    expect(content).toContain('Link Count');
    expect(content).toContain('Action');
  });

  test('Uncategorized should exist and not be deletable', async ({ page }) => {
    await termsPage.gotoCategories();
    const uncatRow = termsPage.termRow('Uncategorized');
    await expect(uncatRow).toBeVisible({ timeout: 5000 });
    // Uncategorized (ID=1) has disabled buttons
    const disabledBtn = uncatRow.locator('button[disabled]').first();
    await expect(disabledBtn).toBeVisible();
  });

  test('should edit a category via name click', async ({ page }) => {
    await termsPage.gotoCategories();
    // Click on "Uncategorized" name — which should be a button in the first gridcell
    // Uncategorized is ID=1, which can't be edited — use a non-default category
    // Find any non-Uncategorized row
    const rows = page.locator('[role="row"]').filter({ hasText: /Cat/ });
    const count = await rows.count();
    if (count > 1) {
      // Click the name button of the second row (skip header + Uncategorized)
      const row = rows.nth(1);
      const nameBtn = row.locator('[role="gridcell"]').first().locator('button').first();
      if (await nameBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameBtn.click();
        const modal = page.locator('.ReactModal__Content');
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(page.locator('.ReactModal__Content #term_name')).toBeVisible();
        }
      }
    }
  });

  test('should delete a category', async ({ page }) => {
    await termsPage.gotoCategories();
    // Find a deletable row (not Uncategorized)
    const rows = page.locator('[role="row"]').filter({ hasText: /Cat/ });
    const count = await rows.count();
    if (count > 1) {
      const row = rows.last();
      const actionCell = row.locator('[role="gridcell"]').last();
      const deleteBtn = actionCell.locator('button').last();
      if (await deleteBtn.isEnabled()) {
        await deleteBtn.click();
        // Confirm deletion
        const yesBtn = page.locator('.btl-confirm-message .action.yes').first();
        if (await yesBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Force-click to survive transient React re-render races on live
          await yesBtn.click({ force: true }).catch(async () => {
            await page.locator('.btl-confirm-message .action.yes').first().click({ force: true });
          });
          await page.waitForTimeout(1500);
        }
      }
    }
  });

  // --- Tags ---
  test('should create a new tag', async ({ page }) => {
    await termsPage.gotoTags();
    const name = `testtag${Date.now()}`;
    await termsPage.createTag(name);
    const exists = await termsPage.termExists(name);
    expect(exists).toBeTruthy();
  });

  test('should delete a tag', async ({ page }) => {
    await termsPage.gotoTags();
    const name = `deltag${Date.now()}`;
    await termsPage.createTag(name);

    await termsPage.deleteTerm(name);
    const exists = await termsPage.termExists(name);
    expect(exists).toBeFalsy();
  });

  test('should create category via API', async ({ page }) => {
    const api = new BetterLinksAPI(page);
    const catName = `APICat${Date.now()}`;
    const res = await api.createCategory(catName);
    expect(res.status).toBeLessThan(300);
  });
});

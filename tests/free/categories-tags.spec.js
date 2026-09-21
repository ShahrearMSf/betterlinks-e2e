const { test, expect } = require('@playwright/test');
const { CategoriesTagsPage } = require('../../pages/CategoriesTagsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Tags & Categories — BetterLinks 3.x.
 * One `.bl-tc__table` with a Tags/Categories pill toggle and a shared
 * `.bl-term-modal` (name only — 3.x derives the slug from the name).
 */
test.describe('Categories & Tags Management', () => {
  let termsPage;

  test.beforeEach(async ({ page }) => {
    termsPage = new CategoriesTagsPage(page);
    await termsPage.goto();
  });

  test('should load Tags & Categories page', async ({ page }) => {
    await expect(page.locator(S.app.root)).toBeVisible();
    await expect(page).toHaveURL(/manage-tags-and-categories/);
    await expect(termsPage.heading).toContainText(/Tags/i);
  });

  test('page shows Tags / Categories tabs with counts and stat cards', async () => {
    await expect(termsPage.tab('Tags')).toBeVisible();
    await expect(termsPage.tab('Categories')).toBeVisible();
    expect(await termsPage.statCards.count()).toBeGreaterThan(0);
  });

  test('table renders the expected column headers', async () => {
    await termsPage.gotoCategories();
    const headers = (await termsPage.columnHeaders()).map((h) => h.toLowerCase());
    expect(headers.some((h) => h.includes('category'))).toBeTruthy();
    expect(headers.some((h) => h.includes('links'))).toBeTruthy();
    expect(headers.some((h) => h.includes('clicks'))).toBeTruthy();
    expect(headers.some((h) => h.includes('action'))).toBeTruthy();
  });

  test('should open the Add New modal and create a category', async ({ page }) => {
    await termsPage.gotoCategories();
    const name = `TestCat${Date.now()}`;

    await termsPage.openCreateModal('category');
    await expect(termsPage.modal).toBeVisible();
    await expect(termsPage.nameInput).toBeVisible();
    await termsPage.nameInput.fill(name);
    await termsPage.submitButton.click();
    await page.waitForTimeout(1500);

    expect(await termsPage.termExists(name)).toBeTruthy();
  });

  test('Uncategorized exists and cannot be deleted', async () => {
    await termsPage.gotoCategories();
    const row = await termsPage.search('Uncategorized');
    await expect(row).toBeVisible({ timeout: 8000 });
    expect(await termsPage.canDelete('Uncategorized')).toBeFalsy();
  });

  test('clicking a category row action opens the edit modal', async ({ page }) => {
    await termsPage.gotoCategories();
    const name = `TestCat${Date.now()}`;
    await termsPage.createTerm(name, 'category');

    await termsPage.editTerm(name, null);
    await expect(termsPage.modal).toBeVisible();
    await expect(termsPage.modalTitle).toContainText(/Edit/i);
    await expect(termsPage.nameInput).toHaveValue(name);
    await page.locator(S.terms.modalCancel).first().click();
  });

  test('should rename a category', async () => {
    await termsPage.gotoCategories();
    const name = `TestCat${Date.now()}`;
    const renamed = `${name}Renamed`;
    await termsPage.createTerm(name, 'category');

    await termsPage.editTerm(name, renamed);
    expect(await termsPage.termExists(renamed)).toBeTruthy();
  });

  test('should delete a category', async () => {
    await termsPage.gotoCategories();
    const name = `TestCat${Date.now()}`;
    await termsPage.createTerm(name, 'category');
    expect(await termsPage.termExists(name)).toBeTruthy();

    await termsPage.deleteTerm(name);
    expect(await termsPage.termExists(name)).toBeFalsy();
  });

  test('should create a new tag', async () => {
    await termsPage.gotoTags();
    const name = `testtag${Date.now()}`;
    await termsPage.createTerm(name, 'tag');
    expect(await termsPage.termExists(name)).toBeTruthy();
  });

  test('should delete a tag', async () => {
    await termsPage.gotoTags();
    const name = `deltag${Date.now()}`;
    await termsPage.createTerm(name, 'tag');
    await termsPage.deleteTerm(name);
    expect(await termsPage.termExists(name)).toBeFalsy();
  });

  test('should create a category via REST', async ({ page }) => {
    const api = new BetterLinksAPI(page);
    const catName = `APICat${Date.now()}`;
    const res = await api.createCategory(catName);
    expect(res.status).toBeLessThan(300);

    // 3.x returns a flat term list — the new category must be in it.
    const cats = await api.listTerms('category');
    expect(cats.some((c) => c.term_name === catName)).toBeTruthy();

    const created = res.data?.data || {};
    const id = created.ID || created.term_id;
    if (id) await api.deleteTerm(id, 'category');
  });
});

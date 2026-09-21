const { test, expect } = require('@playwright/test');
const { CategoriesTagsPage } = require('../../pages/CategoriesTagsPage');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Extended CRUD for tags & categories (BetterLinks 3.x) — creation,
 * duplicate-prevention, search, deletion via both UI and REST. Uses
 * test-prefixed names so the global cleanup hook removes any leftovers.
 */
test.describe('Tags & Categories — Extended CRUD', () => {
  let termsPage;
  let api;

  test.beforeEach(async ({ page }) => {
    termsPage = new CategoriesTagsPage(page);
    await termsPage.goto();
    api = new BetterLinksAPI(page);
  });

  test('create category via UI and confirm it appears in list', async () => {
    await termsPage.gotoCategories();
    const name = `E2ECat${Date.now()}`;
    await termsPage.createTerm(name, 'category');
    expect(await termsPage.termExists(name)).toBeTruthy();
  });

  test('create category via REST, then delete it via REST', async () => {
    const name = `E2ECat${Date.now()}`;
    const create = await api.createCategory(name);
    expect(create.status).toBeLessThan(300);
    const term = create.data?.data || create.data;
    const id = term?.ID || term?.term_id || term?.id;
    expect(id, 'create response should carry the new term id').toBeTruthy();

    const del = await api.deleteTerm(id, 'category');
    expect(del.status).toBeLessThan(300);

    const cats = await api.listTerms('category');
    expect(cats.some((c) => String(c.ID) === String(id))).toBeFalsy();
  });

  test('create tag via UI, verify exists, delete, verify gone', async () => {
    await termsPage.gotoTags();
    const name = `e2etag${Date.now()}`;
    await termsPage.createTerm(name, 'tag');
    expect(await termsPage.termExists(name)).toBeTruthy();

    await termsPage.deleteTerm(name);
    expect(await termsPage.termExists(name)).toBeFalsy();
  });

  test('creating a category with an existing name is rejected or de-duped', async () => {
    const name = `E2ECat${Date.now()}`;
    const a = await api.createCategory(name);
    expect(a.status).toBeLessThan(300);
    await api.createCategory(name);

    // 3.x terms come back as a flat array; there must be at most one match.
    const cats = await api.listTerms('category');
    const matches = cats.filter((t) => t.term_name === name);
    expect(matches.length).toBeLessThanOrEqual(1);

    for (const m of matches) await api.deleteTerm(m.ID, 'category');
  });

  test('duplicate name is blocked in the term modal', async ({ page }) => {
    await termsPage.gotoCategories();
    const name = `E2ECat${Date.now()}`;
    await termsPage.createTerm(name, 'category');

    await termsPage.openCreateModal('category');
    await termsPage.nameInput.fill(name);
    await page.waitForTimeout(600);
    // The modal shows an inline error and disables submit for a duplicate.
    const errorVisible = await termsPage.modalError.isVisible({ timeout: 3000 }).catch(() => false);
    const submitDisabled = await termsPage.submitButton.isDisabled().catch(() => false);
    expect(errorVisible || submitDisabled).toBeTruthy();
    await page.locator(S.terms.modalCancel).first().click();
  });

  test('Uncategorized category cannot be deleted (default)', async () => {
    await termsPage.gotoCategories();
    await expect(await termsPage.search('Uncategorized')).toBeVisible({ timeout: 8000 });
    expect(await termsPage.canDelete('Uncategorized')).toBeFalsy();
  });

  test('search filters the term table', async () => {
    await termsPage.gotoCategories();
    const name = `E2ECat${Date.now()}`;
    await termsPage.createTerm(name, 'category');

    await termsPage.search(name);
    const rows = await termsPage.rows.count();
    expect(rows).toBeGreaterThan(0);
    await expect(termsPage.termRow(name)).toBeVisible();
    await termsPage.clearSearch();
  });

  test('category appears in the link drawer category dropdown', async ({ page }) => {
    const name = `E2ECat${Date.now()}`;
    await api.createCategory(name);

    const linksPage = new ManageLinksPage(page);
    await linksPage.goto();
    await linksPage.clickCreateNew();
    await page.locator(S.linkForm.categorySelect).first().click();
    await page.waitForTimeout(700);
    const option = page.locator('[class*="-option"]').filter({ hasText: name }).first();
    await expect(option).toBeVisible({ timeout: 8000 });
    await page.keyboard.press('Escape');
    await linksPage.closeDrawer();
  });

  test('tags table shows its column headers', async () => {
    await termsPage.gotoTags();
    const headers = (await termsPage.columnHeaders()).map((h) => h.toLowerCase());
    expect(headers.some((h) => h.includes('tag'))).toBeTruthy();
    expect(headers.some((h) => h.includes('action'))).toBeTruthy();
  });
});

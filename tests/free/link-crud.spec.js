const { test, expect } = require('@playwright/test');
const { ManageLinksPage } = require('../../pages/ManageLinksPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { uniqueSlug, waitForAppReady, waitForToast } = require('../../helpers/utils');
require('dotenv').config();

test.describe('Link CRUD Operations', () => {
  let linksPage;

  test.beforeEach(async ({ page }) => {
    linksPage = new ManageLinksPage(page);
    await linksPage.goto();
  });

  test('should load Manage Links page', async ({ page }) => {
    await expect(page.locator('#betterlinksbody')).toBeVisible();
    await expect(page).toHaveURL(/page=betterlinks/);
  });

  test('should open create link modal', async ({ page }) => {
    await linksPage.clickCreateNew();
    await expect(linksPage.modal).toBeVisible();
    await expect(linksPage.titleInput).toBeVisible();
    await expect(linksPage.targetUrlInput).toBeVisible();
    await expect(linksPage.shortUrlInput).toBeVisible();
  });

  test('should create a new link with required fields', async ({ page }) => {
    const slug = uniqueSlug('crud');
    const title = `CRUD Test ${slug}`;

    const { toast } = await linksPage.createLink({
      title,
      targetUrl: 'https://example.com/crud-test',
      slug,
    });

    // Verify link appears in the list
    await page.waitForTimeout(1000);
    const linkVisible = await linksPage.linkByTitle(title).isVisible({ timeout: 5000 }).catch(() => false);
    expect(linkVisible).toBeTruthy();
  });

  test('should create a link with description/note', async ({ page }) => {
    const slug = uniqueSlug('note');
    const title = `Note Test ${slug}`;

    await linksPage.createLink({
      title,
      targetUrl: 'https://example.com/note-test',
      slug,
      note: 'This is a test description',
    });

    const linkVisible = await linksPage.linkByTitle(title).isVisible({ timeout: 5000 }).catch(() => false);
    expect(linkVisible).toBeTruthy();
  });

  test('should validate required fields — empty title', async ({ page }) => {
    await linksPage.clickCreateNew();
    await linksPage.targetUrlInput.fill('https://example.com');
    // Leave title empty, try to submit
    await linksPage.submitButton.click();
    await page.waitForTimeout(1000);
    // Modal should remain open
    await expect(linksPage.modal).toBeVisible();
  });

  test('should validate required fields — empty target URL', async ({ page }) => {
    await linksPage.clickCreateNew();
    await linksPage.titleInput.fill('No URL Link');
    await linksPage.targetUrlInput.clear();
    await linksPage.submitButton.click();
    await page.waitForTimeout(1000);
    await expect(linksPage.modal).toBeVisible();
  });

  test('should edit an existing link', async ({ page }) => {
    const slug = uniqueSlug('edit');
    const title = `Edit Test ${slug}`;
    await linksPage.createLink({ title, slug });
    await page.waitForTimeout(1000);

    await linksPage.clickEditLink(title);
    const updatedTitle = `Updated ${title}`;
    await linksPage.titleInput.clear();
    await linksPage.titleInput.fill(updatedTitle);
    await linksPage.submitButton.click();
    await waitForToast(page, 'success').catch(() => null);
    await page.waitForTimeout(1000);

    const visible = await linksPage.linkByTitle(updatedTitle).isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();
  });

  test('should delete a link', async ({ page }) => {
    const slug = uniqueSlug('delete');
    const title = `Delete Test ${slug}`;
    await linksPage.createLink({ title, slug });
    await page.waitForTimeout(1000);

    await linksPage.clickDeleteLink(title);
    await linksPage.confirmDelete();
    await page.waitForTimeout(1000);

    const visible = await linksPage.linkByTitle(title).isVisible({ timeout: 3000 }).catch(() => false);
    expect(visible).toBeFalsy();
  });

  test('should duplicate a link', async ({ page }) => {
    const slug = uniqueSlug('dup');
    const title = `Duplicate Test ${slug}`;
    await linksPage.createLink({ title, slug });
    await page.waitForTimeout(1000);

    await linksPage.duplicateLink(title);
    // Duplicate opens modal with copy — verify title is pre-filled
    const value = await linksPage.titleInput.inputValue();
    expect(value).toContain(title);
    await linksPage.closeModalButton.click();
  });

  test('should close modal without saving', async ({ page }) => {
    await linksPage.clickCreateNew();
    await expect(linksPage.modal).toBeVisible();
    await linksPage.closeModalButton.click();
    await page.waitForTimeout(500);
    await expect(linksPage.modal).not.toBeVisible();
  });

  test('should create link via API and verify in UI', async ({ page }) => {
    const api = new BetterLinksAPI(page);
    const slug = uniqueSlug('api');
    const title = `API Created ${slug}`;

    const res = await api.createLink({ title, targetUrl: 'https://example.com/api', slug });
    // API should return success
    expect(res.status).toBeLessThan(300);

    // Hard reload to clear React cache
    await page.goto(linksPage.url, { waitUntil: 'networkidle' });
    await waitForAppReady(page);
    await page.waitForTimeout(2000);

    const visible = await linksPage.linkByTitle(title).isVisible({ timeout: 5000 }).catch(() => false);
    expect(visible).toBeTruthy();
  });
});

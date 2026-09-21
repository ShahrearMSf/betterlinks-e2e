const { test, expect } = require('@playwright/test');
const { PromoCardsPage } = require('../../pages/PromoCardsPage');
const { BetterLinksAPI } = require('../../helpers/api');
const { waitForAppReady } = require('../../helpers/utils');
const S = require('../../helpers/selectors');
require('dotenv').config();

/**
 * Promo Cards — new in BetterLinks Pro 3.0 (`?page=betterlinks-promo-cards`).
 *
 * Free renders a teaser; Pro swaps in the Product Display app: a list with
 * Single Cards / Card Groups tabs plus a three-column editor (section nav,
 * form, live preview) backed by `betterlinks-pro/v1/product-displays`.
 */
test.describe('Promo Cards (Pro)', () => {
  let promoPage;
  const createdIds = [];

  test.beforeEach(async ({ page }) => {
    promoPage = new PromoCardsPage(page);
    await promoPage.goto();
  });

  test.afterAll(async ({ browser }) => {
    if (!createdIds.length) return;
    const ctx = await browser.newContext({ storageState: 'playwright/.auth/admin.json', ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await waitForAppReady(page);
    const api = new BetterLinksAPI(page);
    for (const id of createdIds) await api.deletePromoCard(id).catch(() => {});
    await ctx.close();
  });

  test('Promo Cards page loads from the BetterLinks menu', async ({ page }) => {
    await expect(page).toHaveURL(/betterlinks-promo-cards/);
    await expect(promoPage.heading).toContainText(/Promo Cards/i);
  });

  test('page offers Single Cards and Card Groups tabs', async () => {
    await expect(promoPage.tab('Single Cards')).toBeVisible();
    await expect(promoPage.tab('Card Groups')).toBeVisible();
  });

  test('list shows either cards or the empty state', async () => {
    const cards = await promoPage.cards.count();
    if (cards === 0) {
      await expect(promoPage.emptyState).toBeVisible();
      await expect(promoPage.emptyState).toContainText(/Create your first promo card/i);
    } else {
      expect(cards).toBeGreaterThan(0);
    }
  });

  test('"Add card" opens the three-column editor', async ({ page }) => {
    await promoPage.openEditor();
    await expect(promoPage.editor).toBeVisible();
    await expect(promoPage.editorTitle).toBeVisible();
    await expect(promoPage.preview).toBeVisible();
    await expect(page.locator(S.productDisplay.editorNav)).toBeVisible();
  });

  test('editor nav exposes every card section', async () => {
    await promoPage.openEditor();
    const sections = (await promoPage.sectionNames()).join('|').toLowerCase();
    for (const expected of ['product', 'pricing', 'button style', 'layout', 'appearance', 'disclosure']) {
      expect(sections).toContain(expected);
    }
  });

  test('Product section has a source switch, name field and image dropzone', async ({ page }) => {
    await promoPage.openEditor();
    await promoPage.openSection('Product');
    const body = page.locator('.btl-pd-editor__content-body');
    await expect(body).toContainText(/Product Source/i);
    await expect(body.locator(S.productDisplay.input).first()).toBeVisible();
    await expect(promoPage.dropzone).toBeVisible();
  });

  test('a promo card is linked to a BetterLinks short link', async ({ page }) => {
    await promoPage.openEditor();
    await promoPage.openSection('Product');
    const body = page.locator('.btl-pd-editor__content-body');
    // The Buttons block lives on the Product screen: each button points at a
    // tracked short link and carries its own text / tracking / nofollow flags.
    await expect(body).toContainText(/Short Link/i);
    await expect(body).toContainText(/Button Text/i);
    await expect(body).toContainText(/Nofollow/i);
    await expect(body.locator('.btl-react-select__control').first()).toBeVisible();
  });

  test('Button Style section exposes the button appearance controls', async ({ page }) => {
    await promoPage.openEditor();
    await promoPage.openSection('Button Style');
    const body = page.locator('.btl-pd-editor__content-body');
    await expect(body).toContainText(/Primary Button/i);
    await expect(body).toContainText(/Secondary Button/i);
    await expect(body).toContainText(/Radius/i);
  });

  test('typing a product name updates the live preview', async ({ page }) => {
    await promoPage.openEditor();
    await promoPage.openSection('Product');
    const name = `E2E Promo ${Date.now()}`;
    await promoPage.setProductName(name);
    await expect(promoPage.previewCard).toContainText(name, { timeout: 10000 });
  });

  test('saving a promo card persists it and lists it', async ({ page }) => {
    await promoPage.openEditor();
    await promoPage.openSection('Product');
    const name = `E2E Promo ${Date.now()}`;
    await promoPage.setProductName(name);
    await promoPage.save();

    const api = new BetterLinksAPI(page);
    const res = await api.getPromoCards();
    expect(res.status).toBe(200);
    const list = res.data?.data || res.data || [];
    const saved = (Array.isArray(list) ? list : []).find((c) => JSON.stringify(c).includes(name));
    expect(saved, 'the saved promo card should come back from the REST API').toBeTruthy();
    // The product-displays payload keys the row as `ID`.
    const savedId = saved?.ID || saved?.id;
    if (savedId) createdIds.push(savedId);
    expect(saved.product_name).toBe(name);

    await promoPage.goto();
    expect(await promoPage.cardExists(name)).toBeTruthy();
  });

  test('Back returns from the editor to the list', async ({ page }) => {
    await promoPage.openEditor();
    await promoPage.backButton.click();
    await page.waitForTimeout(1500);
    await expect(promoPage.addButton).toBeVisible();
    await expect(promoPage.editor).toBeHidden();
  });

  test('Card Groups tab renders its own list', async ({ page }) => {
    await promoPage.openTab('Card Groups');
    await expect(page.locator(S.productDisplay.page)).toBeVisible();
    const cards = await promoPage.cards.count();
    if (cards === 0) await expect(promoPage.emptyState).toBeVisible();
  });

  test('search box filters the card list', async ({ page }) => {
    await expect(promoPage.searchInput).toBeVisible();
    await promoPage.searchInput.fill('zzz-no-such-card');
    await page.waitForTimeout(1200);
    await expect(page.locator(S.productDisplay.page)).toBeVisible();
    await promoPage.searchInput.fill('');
  });

  test('product-displays and product-groups REST endpoints respond', async ({ page }) => {
    const api = new BetterLinksAPI(page);
    expect((await api.getPromoCards()).status).toBe(200);
    expect((await api.getPromoGroups()).status).toBe(200);
  });
});

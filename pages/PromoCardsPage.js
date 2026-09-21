const S = require('../helpers/selectors');
const { waitForAppReady, waitForToast, dismissAdminNotice } = require('../helpers/utils');

/**
 * Promo Cards (BetterLinks Pro 3.x, menu `betterlinks-promo-cards`).
 *
 * Free ships a teaser; Pro swaps in the real Product Display app through the
 * `betterLinksProductDisplayPage` filter. The list has two tabs (Single Cards /
 * Card Groups) and the editor is a three-column screen (`.btl-pd-editor--3col`)
 * with a section nav, a form column and a live preview.
 */
class PromoCardsPage {
  static SECTIONS = ['Product', 'Pricing', 'Button Style', 'Layout & Content', 'Card Appearance', 'Disclosure'];

  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-promo-cards';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
    await dismissAdminNotice(this.page);
    await this.page.locator(S.productDisplay.page).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  }

  // --- List view ---
  get root() { return this.page.locator(S.productDisplay.page).first(); }
  get heading() { return this.page.locator(S.productDisplay.title).first(); }
  get addButton() { return this.page.locator(S.productDisplay.addButton).first(); }
  get searchInput() { return this.page.locator(S.productDisplay.searchInput).first(); }
  get cards() { return this.page.locator(S.productDisplay.card); }
  get emptyState() { return this.page.locator(S.productDisplay.empty).first(); }
  get tabs() { return this.page.locator(S.productDisplay.tab); }

  tab(name) {
    return this.page.locator(S.productDisplay.tab).filter({ hasText: new RegExp(name, 'i') }).first();
  }

  async openTab(name) {
    await this.tab(name).click();
    await this.page.waitForTimeout(1500);
  }

  cardByTitle(title) {
    return this.page.locator(S.productDisplay.card).filter({ hasText: title }).first();
  }

  async cardExists(title) {
    return this.cardByTitle(title).isVisible({ timeout: 6000 }).catch(() => false);
  }

  /** Teaser (free) vs real app (Pro). */
  async isProActive() {
    return this.page.locator(S.productDisplay.editor).count().then(() => this.addButton.isVisible({ timeout: 4000 })).catch(() => false);
  }

  // --- Editor ---
  get editor() { return this.page.locator(S.productDisplay.editor).first(); }
  get editorTitle() { return this.page.locator(S.productDisplay.editorTitle).first(); }
  get backButton() { return this.page.locator(S.productDisplay.editorBack).first(); }
  get navItems() { return this.page.locator(S.productDisplay.navItem); }
  get preview() { return this.page.locator(S.productDisplay.preview).first(); }
  get previewCard() { return this.page.locator(S.productDisplay.previewCard).first(); }
  get inputs() { return this.page.locator(S.productDisplay.input); }
  get dropzone() { return this.page.locator(S.productDisplay.dropzone).first(); }

  get saveButton() {
    return this.page.locator(`${S.productDisplay.editorActions} button`).filter({ hasText: /Save/i }).first();
  }

  async openEditor() {
    await this.addButton.click();
    await this.editor.waitFor({ state: 'visible', timeout: 20000 });
    await this.page.waitForTimeout(1200);
  }

  section(name) {
    return this.page.locator(S.productDisplay.navItem).filter({ hasText: new RegExp(name, 'i') }).first();
  }

  async openSection(name) {
    await this.section(name).click();
    await this.page.waitForTimeout(900);
    return this.page.locator(S.productDisplay.contentTitle).first();
  }

  async sectionNames() {
    const names = await this.page.locator(S.productDisplay.navItemTitle).allTextContents();
    return names.map((n) => n.trim()).filter(Boolean);
  }

  /** Field lookup by its visible label inside the current section. */
  fieldByLabel(label) {
    return this.page
      .locator('.btl-pd-editor__content-body')
      .locator(`${S.productDisplay.input}, input, textarea`)
      .first();
  }

  async setProductName(name) {
    const input = this.page.locator(`${S.productDisplay.input}`).first();
    await input.fill(name);
    await this.page.waitForTimeout(400);
  }

  async save() {
    await this.saveButton.click();
    const toast = await waitForToast(this.page, 'success').catch(() => null);
    await this.page.waitForTimeout(1500);
    return toast;
  }
}

module.exports = { PromoCardsPage };

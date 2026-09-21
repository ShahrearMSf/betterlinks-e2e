const S = require('../helpers/selectors');
const { waitForAppReady, waitForToast, dismissAdminNotice } = require('../helpers/utils');

/**
 * Bio Links / Link in Bio (BetterLinks Pro 3.x, menu `betterlinks-bio-links`).
 *
 * Shares the promo-card shell (`.btl-pd-*`) with a bio-specific body
 * (`.btl-lib-*`): Profile / Icons / Links & Footer / Layout / Styles / SEO
 * sections, a Quill rich-text bio field, a slug field under the site prefix
 * and a phone-frame live preview.
 */
class BioLinksPage {
  static SECTIONS = ['Profile', 'Icons', 'Links & Footer', 'Layout', 'Styles', 'SEO'];

  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-bio-links';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
    await dismissAdminNotice(this.page);
    await this.page.locator(S.productDisplay.page).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  }

  // --- List view ---
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

  bioByTitle(title) {
    return this.page.locator(S.productDisplay.card).filter({ hasText: title }).first();
  }

  async bioExists(title) {
    return this.bioByTitle(title).isVisible({ timeout: 6000 }).catch(() => false);
  }

  // --- Builder ---
  get editor() { return this.page.locator(S.productDisplay.editor).first(); }
  get editorTitle() { return this.page.locator(S.productDisplay.editorTitle).first(); }
  get backButton() { return this.page.locator(S.productDisplay.editorBack).first(); }
  get navItems() { return this.page.locator(S.productDisplay.navItem); }
  get preview() { return this.page.locator(S.bioLinks.phonePreview).first(); }
  get previewTitle() { return this.page.locator(S.bioLinks.phoneTitle).first(); }
  get titleInput() { return this.page.locator(S.bioLinks.input).first(); }
  get bioEditor() { return this.page.locator(S.bioLinks.editor).first(); }
  get slugInput() { return this.page.locator(S.bioLinks.slugInput).first(); }
  get slugPrefix() { return this.page.locator(S.bioLinks.slugPrefix).first(); }

  actionButton(label) {
    return this.page.locator(`${S.productDisplay.editorActions} button`).filter({ hasText: new RegExp(label, 'i') }).first();
  }

  get saveDraftButton() { return this.actionButton('Save draft'); }
  get publishButton() { return this.actionButton('Publish'); }

  async openBuilder() {
    await this.addButton.click();
    await this.editor.waitFor({ state: 'visible', timeout: 20000 });
    await this.page.waitForTimeout(1500);
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

  async fillProfile({ title, bio, slug } = {}) {
    if (title) {
      await this.titleInput.fill(title);
      await this.page.waitForTimeout(400);
    }
    if (bio && (await this.bioEditor.isVisible({ timeout: 2000 }).catch(() => false))) {
      await this.bioEditor.click();
      await this.bioEditor.fill(bio).catch(async () => {
        await this.page.keyboard.type(bio);
      });
    }
    if (slug && (await this.slugInput.isVisible({ timeout: 2000 }).catch(() => false))) {
      await this.slugInput.fill(slug);
      await this.page.waitForTimeout(800); // debounce + slug availability check
    }
  }

  async saveDraft() {
    await this.saveDraftButton.click();
    const toast = await waitForToast(this.page, 'success').catch(() => null);
    await this.page.waitForTimeout(1500);
    return toast;
  }

  /**
   * Public URL of a bio page: `{home}/{prefix}/{slug}` — the same prefix the
   * builder shows above the handle field (e.g. "example.com/go/"), not the bare
   * site root.
   */
  async publicUrl(slug) {
    const shown = await this.slugPrefix.textContent().catch(() => '');
    const cleaned = (shown || '').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (cleaned.includes('/')) {
      const prefix = cleaned.slice(cleaned.indexOf('/') + 1);
      return `${process.env.BASE_URL}/${prefix}/${slug}`.replace(/([^:])\/\//g, '$1/');
    }
    return `${process.env.BASE_URL}/${slug}`;
  }

  async publish() {
    await this.publishButton.click();
    const toast = await waitForToast(this.page, 'success').catch(() => null);
    await this.page.waitForTimeout(2000);
    return toast;
  }
}

module.exports = { BioLinksPage };

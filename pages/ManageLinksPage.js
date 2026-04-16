const { waitForAppReady, waitForToast, uniqueSlug } = require('../helpers/utils');

class ManageLinksPage {
  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
  }

  // --- Locators (based on actual BetterLinks React source) ---

  /** "Add New Link" button: .btl-create-link-button */
  get createNewButton() {
    return this.page.locator('.btl-create-link-button').first();
  }

  /** React Modal content */
  get modal() {
    return this.page.locator('.ReactModal__Content').first();
  }

  get titleInput() {
    return this.page.locator('#link_title');
  }

  get targetUrlInput() {
    return this.page.locator('#target_url');
  }

  get shortUrlInput() {
    return this.page.locator('#short_url');
  }

  get noteInput() {
    return this.page.locator('#link_note');
  }

  /** Submit button: .btl-modal-submit-button */
  get submitButton() {
    return this.page.locator('.btl-modal-submit-button').first();
  }

  /** Close modal: .btl-close-modal */
  get closeModalButton() {
    return this.page.locator('.btl-close-modal').first();
  }

  // --- Actions ---
  async clickCreateNew() {
    await this.createNewButton.click();
    await this.modal.waitFor({ state: 'visible', timeout: 10000 });
    await this.page.waitForTimeout(500);
  }

  async fillLinkForm({ title = 'Test Link', targetUrl = 'https://example.com', slug = null, note = '' } = {}) {
    await this.titleInput.fill(title);
    await this.targetUrlInput.fill(targetUrl);
    if (slug) {
      await this.shortUrlInput.clear();
      await this.shortUrlInput.fill(slug);
    }
    if (note) {
      await this.noteInput.fill(note);
    }
  }

  async setLinkOption(optionName, enabled) {
    // Expand "Link Options" panel if collapsed
    const optionsHead = this.modal.locator('.link-options__head').first();
    if (await optionsHead.isVisible({ timeout: 2000 }).catch(() => false)) {
      const body = this.modal.locator('.link-options__body').first();
      if (!await body.isVisible().catch(() => false)) {
        await optionsHead.click();
        await this.page.waitForTimeout(300);
      }
    }

    // Each option: <label class="btl-checkbox-field"><input class="btl-check" name="nofollow" /><span class="text">No Follow</span></label>
    // Use evaluate to check/toggle since the input is hidden by CSS
    const isChecked = await this.page.evaluate((name) => {
      const input = document.querySelector(`.ReactModal__Content input.btl-check[name="${name}"]`);
      return input ? input.checked : false;
    }, optionName);

    if (isChecked !== enabled) {
      // Click the label to toggle — find by the input name's parent label
      await this.page.evaluate((name) => {
        const input = document.querySelector(`.ReactModal__Content input.btl-check[name="${name}"]`);
        if (input) input.closest('label').click();
      }, optionName);
      await this.page.waitForTimeout(200);
    }
  }

  async publishLink() {
    await this.submitButton.click();
    return waitForToast(this.page, 'success').catch(() => null);
  }

  async createLink({ title = 'Test Link', targetUrl = 'https://example.com', slug = null, note = '', options = {} } = {}) {
    const finalSlug = slug || uniqueSlug();
    await this.clickCreateNew();
    await this.fillLinkForm({ title, targetUrl, slug: finalSlug, note });
    for (const [key, value] of Object.entries(options)) {
      await this.setLinkOption(key, value);
    }
    const toast = await this.publishLink();
    await this.page.waitForTimeout(500);
    return { slug: finalSlug, toast };
  }

  // --- Find / interact with existing links ---

  /** Find a link card by title. Links are .btl-dnd-link cards with h3.dnd-link-title */
  linkByTitle(title) {
    return this.page.locator('.btl-dnd-link').filter({ hasText: title }).first();
  }

  /**
   * Edit a link. The edit button is a <Link> component rendered inside .btl-tooltip
   * with tooltip text "Edit Link". It wraps a button with class .dnd-link-button.
   */
  async clickEditLink(title) {
    const linkRow = this.linkByTitle(title);
    await linkRow.hover();
    // The edit button is inside .btl-tooltip with tooltip "Edit Link"
    const editBtn = linkRow.locator('.btl-tooltip').filter({ hasText: /Edit Link/i }).locator('.dnd-link-button, button, span').first();
    await editBtn.click();
    await this.modal.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Delete a link. Button has class .delete-button.
   * After click, shows "Are You Sure?" with Yes/No.
   */
  async clickDeleteLink(title) {
    const linkRow = this.linkByTitle(title);
    await linkRow.hover();
    const deleteBtn = linkRow.locator('.delete-button').first();
    await deleteBtn.click();
  }

  async confirmDelete() {
    // BetterLinks shows inline "Are You Sure?" with Yes/No buttons
    const yesBtn = this.page.locator('.btl-confirm-message .action.yes').first();
    await yesBtn.waitFor({ state: 'visible', timeout: 5000 });
    await yesBtn.click();
  }

  /** Duplicate a link — tooltip "Create Duplicate" */
  async duplicateLink(title) {
    const linkRow = this.linkByTitle(title);
    await linkRow.hover();
    const dupBtn = linkRow.locator('.btl-tooltip').filter({ hasText: /Create Duplicate/i }).locator('.dnd-link-button, button, span').first();
    await dupBtn.click();
    await this.modal.waitFor({ state: 'visible', timeout: 10000 });
  }

  async searchLink(text) {
    const searchInput = this.page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill(text);
    await this.page.waitForTimeout(1000);
  }

  async toggleFavorite(title) {
    const linkRow = this.linkByTitle(title);
    await linkRow.hover();
    const favBtn = linkRow.locator('[class*="favorite"], [class*="fav"]').first();
    if (await favBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await favBtn.click();
    }
  }
}

module.exports = { ManageLinksPage };

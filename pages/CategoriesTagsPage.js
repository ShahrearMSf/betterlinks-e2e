const S = require('../helpers/selectors');
const { waitForAppReady, waitForToast, dismissAdminNotice } = require('../helpers/utils');

/**
 * Tags & Categories (BetterLinks 3.x).
 *
 * One table (`.bl-tc__table`) with a Tags / Categories pill toggle, a search
 * box, a sort select and a shared "Add New …" modal (`.bl-term-modal`). The
 * 3.x term modal has no slug field — the slug is derived from the name.
 */
class CategoriesTagsPage {
  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-manage-tags-and-categories';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
    await dismissAdminNotice(this.page);
    await this.page.locator(S.terms.page).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  }

  // --- Chrome ---
  get heading() { return this.page.locator(S.terms.title).first(); }
  get table() { return this.page.locator(S.terms.table).first(); }
  get rows() { return this.page.locator(S.terms.row); }
  get searchInput() { return this.page.locator(S.terms.searchInput).first(); }
  get sortSelect() { return this.page.locator(S.terms.sortSelect).first(); }
  get statCards() { return this.page.locator(S.terms.statCard); }
  get exportButton() { return this.page.locator(S.terms.exportButton).first(); }
  get addNewButton() { return this.page.locator(S.terms.addNewButton).first(); }
  get emptyRow() { return this.page.locator(S.terms.emptyRow).first(); }

  // Both tabs are served by the same button — the label follows the active tab.
  get addNewCategoryButton() { return this.addNewButton; }
  get addNewTagButton() { return this.addNewButton; }

  tab(name) {
    return this.page.locator(S.terms.tab).filter({ hasText: new RegExp(name, 'i') }).first();
  }

  async gotoTags() {
    await this.tab('Tags').click();
    await this.page.waitForTimeout(900);
  }

  async gotoCategories() {
    await this.tab('Categories').click();
    await this.page.waitForTimeout(900);
  }

  async activeTabName() {
    return this.page.locator(`${S.terms.tab}.is-active`).first().innerText().catch(() => '');
  }

  // --- Modal ---
  get modal() { return this.page.locator(S.terms.modal).first(); }
  get modalTitle() { return this.page.locator(S.terms.modalTitle).first(); }
  get nameInput() { return this.page.locator(S.terms.nameInput); }
  get submitButton() { return this.page.locator(S.terms.modalSubmit).first(); }
  get modalError() { return this.page.locator(S.terms.modalError).first(); }
  typeButton(name) {
    return this.page.locator(S.terms.typeButton).filter({ hasText: new RegExp(`^${name}$`, 'i') }).first();
  }

  async openCreateModal(type = 'category') {
    await this.addNewButton.click();
    await this.modal.waitFor({ state: 'visible', timeout: 10000 });
    const typeBtn = this.typeButton(type === 'tag' ? 'Tag' : 'Category');
    if (await typeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeBtn.click();
      await this.page.waitForTimeout(300);
    }
  }

  async createTerm(name, type = 'category') {
    await this.openCreateModal(type);
    await this.nameInput.fill(name);
    await this.submitButton.click();
    const toast = await waitForToast(this.page, 'success').catch(() => null);
    await this.page.waitForTimeout(1200);
    return toast;
  }

  async createCategory(name) {
    await this.gotoCategories();
    return this.createTerm(name, 'category');
  }

  async createTag(name) {
    await this.gotoTags();
    return this.createTerm(name, 'tag');
  }

  // --- Rows ---
  termRow(name) {
    return this.page.locator(S.terms.row).filter({ hasText: name }).first();
  }

  async search(name) {
    if (await this.searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.searchInput.fill(name);
      await this.page.waitForTimeout(1200);
    }
    return this.termRow(name);
  }

  async clearSearch() {
    if (await this.searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.searchInput.fill('');
      await this.page.waitForTimeout(800);
    }
  }

  async termExists(name) {
    await this.search(name);
    const found = await this.termRow(name).isVisible({ timeout: 4000 }).catch(() => false);
    await this.clearSearch();
    return found;
  }

  /** Rename: the row's edit action opens the same modal pre-filled. */
  async editTerm(name, newName) {
    const row = await this.search(name);
    await row.hover();
    await row.locator(`${S.terms.rowActions} button, ${S.terms.rowActions} a`).first().click();
    await this.modal.waitFor({ state: 'visible', timeout: 10000 });
    if (newName) {
      await this.nameInput.fill(newName);
      await this.submitButton.click();
      await waitForToast(this.page, 'success').catch(() => null);
      await this.page.waitForTimeout(1000);
    }
  }

  async deleteTerm(name) {
    const row = await this.search(name);
    await row.hover();
    await row.locator(S.terms.deleteButton).first().click();
    const confirm = this.page.locator(S.confirmModal.confirm).first();
    await confirm.waitFor({ state: 'visible', timeout: 8000 });
    await confirm.click();
    await this.page.waitForTimeout(1500);
    await this.clearSearch();
  }

  /** Delete action is absent (or blocked) for the default "Uncategorized". */
  async canDelete(name) {
    const row = await this.search(name);
    const btn = row.locator(S.terms.deleteButton).first();
    const visible = await btn.isVisible({ timeout: 2000 }).catch(() => false);
    if (!visible) return false;
    return !(await btn.isDisabled().catch(() => false));
  }

  async columnHeaders() {
    const headers = await this.page.locator(`${S.terms.table} thead th`).allTextContents();
    return headers.map((h) => h.trim()).filter(Boolean);
  }
}

module.exports = { CategoriesTagsPage };

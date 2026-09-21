const S = require('../helpers/selectors');
const {
  waitForAppReady,
  waitForToast,
  dismissAdminNotice,
  selectReactOption,
} = require('../helpers/utils');

/**
 * Auto-Link Keywords (BetterLinks 3.x).
 *
 * `.bl-kw` shell with stat cards, a status filter and a `.bl-kw__table`.
 * The add/edit form is a drawer whose keyword field is a chips input
 * (`.bl-kw-chips__input`) — type + Enter/comma adds each keyword.
 */
class KeywordsPage {
  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-keywords-linking';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
    await dismissAdminNotice(this.page);
    await this.page.locator(S.keywords.page).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  }

  // --- Chrome ---
  get heading() { return this.page.locator(S.keywords.title).first(); }
  get addKeywordButton() { return this.page.locator(S.keywords.addButton).first(); }
  get importExportGroup() { return this.page.locator(S.keywords.importExport).first(); }
  get exportButton() { return this.page.locator(S.keywords.exportButton).first(); }
  get importButton() { return this.page.locator(S.keywords.importButton).first(); }
  get statCards() { return this.page.locator(S.keywords.statCard); }
  get dataTable() { return this.page.locator(S.keywords.table).first(); }
  get rows() { return this.page.locator(S.keywords.row); }
  get searchInput() { return this.page.locator(S.keywords.searchInput).first(); }
  get filterSelect() { return this.page.locator(S.keywords.filterSelect).first(); }
  get emptyRow() { return this.page.locator(S.keywords.emptyRow).first(); }

  // --- Drawer ---
  get drawer() { return this.page.locator(S.keywords.drawer).first(); }
  get keywordInput() { return this.page.locator(S.keywords.chipsInput).first(); }
  get chips() { return this.page.locator(S.keywords.chip); }
  get linkSelect() { return this.page.locator(`${S.keywords.drawer} .btl-react-select__control`).first(); }
  get saveButton() { return this.page.locator(S.keywords.submitButton).first(); }

  async openDrawer() {
    await this.addKeywordButton.click();
    await this.drawer.waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForTimeout(600);
  }

  async addKeyword(keyword, linkTitle) {
    await this.openDrawer();
    await this.keywordInput.fill(keyword);
    await this.keywordInput.press('Enter');
    await this.page.waitForTimeout(400);
    if (linkTitle) {
      await selectReactOption(this.page, this.linkSelect, linkTitle);
    }
    await this.saveButton.click();
    const toast = await waitForToast(this.page, 'success').catch(() => null);
    await this.page.waitForTimeout(1000);
    return toast;
  }

  keywordRow(keyword) {
    return this.page.locator(S.keywords.row).filter({ hasText: keyword }).first();
  }

  async keywordExists(keyword) {
    return this.keywordRow(keyword).isVisible({ timeout: 5000 }).catch(() => false);
  }

  async deleteKeyword(keyword) {
    const row = this.keywordRow(keyword);
    await row.hover();
    await row.locator('.bl-kw__cell-action button, .delete-button').last().click();
    const confirm = this.page.locator(S.confirmModal.confirm).first();
    if (await confirm.isVisible({ timeout: 5000 }).catch(() => false)) {
      await confirm.click();
    }
    await this.page.waitForTimeout(1200);
  }

  async columnHeaders() {
    const headers = await this.page.locator(`${S.keywords.table} thead th`).allTextContents();
    return headers.map((h) => h.trim()).filter(Boolean);
  }
}

module.exports = { KeywordsPage };

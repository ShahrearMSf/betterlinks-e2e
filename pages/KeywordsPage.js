const { waitForAppReady, waitForToast } = require('../helpers/utils');

class KeywordsPage {
  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-keywords-linking';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
  }

  // --- Locators (from source: .btl-create-autolink-button with text "Add New Keywords") ---
  get addKeywordButton() {
    return this.page.locator('.btl-create-autolink-button').first();
  }

  get keywordInput() {
    return this.page.locator('input[name="keywords"], input[placeholder*="Keyword"], input[placeholder*="keyword"]').first();
  }

  get linkSelect() {
    return this.page.locator('[class*="keyword-link"], [class*="chooseLink"], [class*="react-select"]').first();
  }

  get saveButton() {
    return this.page.locator('.btl-modal-submit-button, button[type="submit"]').filter({ hasText: /Save|Add|Submit|Publish/i }).first();
  }

  get dataTable() {
    return this.page.locator('table, [class*="table"]').first();
  }

  // --- Actions ---
  async addKeyword(keyword, linkTitle) {
    await this.addKeywordButton.click();
    await this.page.waitForTimeout(500);
    await this.keywordInput.fill(keyword);

    const linkDropdown = this.linkSelect;
    await linkDropdown.click();
    await this.page.waitForTimeout(500);

    const option = this.page.locator('[class*="option"]').filter({ hasText: linkTitle }).first();
    if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
      await option.click();
    }

    await this.saveButton.click();
    return waitForToast(this.page, 'success').catch(() => null);
  }

  keywordRow(keyword) {
    return this.page.locator('[role="row"]').filter({ hasText: keyword }).first();
  }

  async keywordExists(keyword) {
    return this.keywordRow(keyword).isVisible({ timeout: 3000 }).catch(() => false);
  }

  get importExportButton() {
    return this.page.locator('button, a, span').filter({ hasText: /Import|Export/i }).first();
  }
}

module.exports = { KeywordsPage };

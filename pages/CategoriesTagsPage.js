const { waitForAppReady, waitForToast } = require('../helpers/utils');

class CategoriesTagsPage {
  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-manage-tags-and-categories';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
  }

  // --- Tab Navigation ---
  async gotoTags() {
    await this.page.locator('.react-tabs__tab').filter({ hasText: /Tags/i }).first().click();
    await this.page.waitForTimeout(500);
  }

  async gotoCategories() {
    await this.page.locator('.react-tabs__tab').filter({ hasText: /Categories/i }).first().click();
    await this.page.waitForTimeout(500);
  }

  // --- Create ---
  get addNewCategoryButton() {
    return this.page.locator('.btl-create-categories-button').first();
  }

  get addNewTagButton() {
    return this.page.locator('.btl-create-tags-button').first();
  }

  get nameInput() {
    return this.page.locator('.ReactModal__Content #term_name');
  }

  get submitButton() {
    return this.page.locator('.ReactModal__Content .btl-modal-submit-button').first();
  }

  async createCategory(name) {
    await this.addNewCategoryButton.click();
    await this.page.locator('.ReactModal__Content').waitFor({ state: 'visible', timeout: 5000 });
    await this.page.locator('.ReactModal__Content #term_name').fill(name);
    await this.page.locator('.ReactModal__Content .btl-modal-submit-button').click();
    await waitForToast(this.page, 'success').catch(() => null);
    // Reload page to ensure DataTable picks up new entry
    await this.page.reload({ waitUntil: 'domcontentloaded' });
    await waitForAppReady(this.page);
    await this.gotoCategories();
  }

  async createTag(name) {
    await this.addNewTagButton.click();
    await this.page.locator('.ReactModal__Content').waitFor({ state: 'visible', timeout: 5000 });
    // Tag modal uses #term_slug
    await this.page.locator('.ReactModal__Content #term_slug').fill(name);
    await this.page.locator('.ReactModal__Content .btl-modal-submit-button').click();
    await this.page.waitForTimeout(2000);
  }

  // --- Find rows ---
  termRow(name) {
    return this.page.locator('[role="row"]').filter({ hasText: name }).first();
  }

  /**
   * Edit a term. In CategoryQuickAction/TagQuickAction, the action cell has:
   * - First .btl-tooltip button = edit (with icon btl-edit)
   * - Second .btl-tooltip = delete (with icon btl-delete)
   * The edit button is actually in the name column (clicking the name opens edit modal).
   * From source: the name column cell is a button rendered by AddNewCategories.
   */
  async searchAndFindRow(name) {
    const searchInput = this.page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await searchInput.fill(name);
      await this.page.waitForTimeout(1000);
    }
    return this.termRow(name);
  }

  async editTerm(name) {
    const row = await this.searchAndFindRow(name);
    // The category name itself is a clickable button that opens the edit modal
    const nameBtn = row.locator('[role="gridcell"]').first().locator('button').first();
    await nameBtn.click();
    await this.page.locator('.ReactModal__Content').waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Delete a term. The delete button is the LAST button in the action cell.
   * Action cell is the last gridcell in the row.
   */
  async deleteTerm(name) {
    const row = await this.searchAndFindRow(name);
    // Get all buttons in the action cell (last gridcell)
    const actionCell = row.locator('[role="gridcell"]').last();
    // Second button is delete (first is edit icon)
    const deleteBtn = actionCell.locator('button').last();
    await deleteBtn.click();
    // Confirm "Are You Sure?" dialog
    const yesBtn = this.page.locator('.btl-confirm-message .action.yes').first();
    await yesBtn.waitFor({ state: 'visible', timeout: 5000 });
    await yesBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async termExists(name) {
    await this.page.waitForTimeout(500);
    // Check current page first
    let found = await this.termRow(name).isVisible({ timeout: 3000 }).catch(() => false);
    if (found) return true;

    // If not visible, try searching (search input exists on the page)
    const searchInput = this.page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await searchInput.fill(name);
      await this.page.waitForTimeout(1000);
      found = await this.termRow(name).isVisible({ timeout: 3000 }).catch(() => false);
      // Clear search
      await searchInput.clear();
      await this.page.waitForTimeout(500);
    }
    return found;
  }
}

module.exports = { CategoriesTagsPage };

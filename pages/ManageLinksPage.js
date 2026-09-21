const S = require('../helpers/selectors');
const {
  waitForAppReady,
  waitForToast,
  uniqueSlug,
  dismissAdminNotice,
  selectReactOption,
  setCheckbox,
} = require('../helpers/utils');

/**
 * Manage Links (BetterLinks 3.x).
 *
 * The page has two layouts: the default board (`.blb` columns of `.blb-card`)
 * and a list/table view (`.bl-list__table`). Both share the same row action
 * buttons (`.dnd-link-button` inside `.btl-tooltip`), and the create form is a
 * right-hand drawer (`.bl-drawer`) rendered inside a react-modal.
 */
class ManageLinksPage {
  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
    await dismissAdminNotice(this.page);
  }

  // --- Page chrome ---
  get root() { return this.page.locator(S.manageLinks.page); }
  get heading() { return this.page.locator(S.manageLinks.title); }
  get overview() { return this.page.locator(S.manageLinks.overview); }
  get toolbar() { return this.page.locator(S.manageLinks.toolbar); }
  get searchInput() { return this.page.locator(S.manageLinks.searchInput).first(); }
  get favoriteFilter() { return this.page.locator(S.manageLinks.favoriteFilter).first(); }
  get resetFiltersButton() { return this.page.locator(S.manageLinks.resetFilters).first(); }
  get createNewButton() { return this.page.locator(S.manageLinks.createButton).first(); }
  get refreshStatsButton() { return this.page.locator(S.manageLinks.refreshButton).first(); }

  // --- View toggle (Board / List / Compact) ---
  viewButton(name) {
    return this.page.locator(S.manageLinks.viewButton).filter({ hasText: new RegExp(`^${name}$`, 'i') }).first();
  }

  async switchToList() {
    await this.viewButton('List').click();
    await this.page.locator(S.manageLinks.listView).waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForTimeout(500);
  }

  async switchToBoard() {
    await this.viewButton('Board').click();
    await this.page.locator(S.manageLinks.board).waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForTimeout(500);
  }

  async isBoardView() {
    return this.root.evaluate((el) => el.className.includes('is-board')).catch(() => false);
  }

  // --- Drawer ---
  get modal() { return this.page.locator(S.linkForm.drawer).first(); }
  get drawerTitle() { return this.page.locator(S.linkForm.title).first(); }
  get titleInput() { return this.page.locator(S.linkForm.titleInput); }
  get targetUrlInput() { return this.page.locator(S.linkForm.targetUrlInput); }
  get shortUrlInput() { return this.page.locator(S.linkForm.shortUrlInput); }
  get noteInput() { return this.page.locator(S.linkForm.noteInput); }
  get submitButton() { return this.page.locator(S.linkForm.submitButton).first(); }
  get closeModalButton() { return this.page.locator(S.linkForm.closeButton).first(); }
  get cancelButton() { return this.page.locator(S.linkForm.cancelButton).first(); }
  get slugError() { return this.page.locator(`${S.linkForm.drawer} ${S.linkForm.slugError}`).first(); }

  /**
   * Close the link drawer. The panel animates on open/close, so a plain click
   * can hit a moving target — settle first, then fall back to a forced click.
   */
  async closeDrawer() {
    await this.page.waitForTimeout(400);
    const close = this.closeModalButton;
    await close.click({ timeout: 8000 }).catch(async () => {
      await close.click({ force: true }).catch(() => this.page.keyboard.press('Escape'));
    });
    await this.modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  }

  async clickCreateNew() {
    await this.createNewButton.click();
    await this.modal.waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForTimeout(600);
  }

  async fillLinkForm({ title = 'Test Link', targetUrl = 'https://example.com', slug = null, note = '' } = {}) {
    await this.titleInput.fill(title);
    await this.targetUrlInput.fill(targetUrl);
    if (slug) {
      // 3.x pre-fills the field with the configured prefix (e.g. "go/").
      await this.shortUrlInput.fill('');
      await this.shortUrlInput.fill(slug);
    }
    if (note) {
      await this.noteInput.fill(note);
    }
  }

  async setRedirectType(label) {
    await selectReactOption(this.page, this.page.locator(S.linkForm.redirectTypeSelect).first(), label);
  }

  async setCategory(name) {
    await selectReactOption(this.page, this.page.locator(S.linkForm.categorySelect).first(), name);
  }

  /** Toggle one of the Link Options checkboxes (nofollow, sponsored, …). */
  async setLinkOption(optionName, enabled) {
    return setCheckbox(this.page, optionName, enabled, S.linkForm.drawer);
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
    await this.page.waitForTimeout(800);
    return { slug: finalSlug, toast };
  }

  // --- Finding links in either view ---

  /** A link card (board view) or row (list view) matching `title`. */
  linkByTitle(title) {
    return this.page
      .locator(`${S.manageLinks.card}, ${S.manageLinks.listRow}`)
      .filter({ hasText: title })
      .first();
  }

  card(title) {
    return this.page.locator(S.manageLinks.card).filter({ hasText: title }).first();
  }

  listRow(title) {
    return this.page.locator(S.manageLinks.listRow).filter({ hasText: title }).first();
  }

  async linkExists(title) {
    return this.linkByTitle(title).isVisible({ timeout: 8000 }).catch(() => false);
  }

  /**
   * Row/card action buttons. 3.x renders the tooltip text out of the DOM and
   * labels each control with `aria-label` ("Edit Link", "Delete",
   * "Create Duplicate", "Mark as Favorite"), so match on that first and fall
   * back to the old tooltip-text markup.
   */
  actionButton(title, label) {
    const row = this.linkByTitle(title);
    return row
      .locator(`[aria-label="${label}"], ${S.manageLinks.tooltip}:has-text("${label}") button, ${S.manageLinks.tooltip}:has-text("${label}") a`)
      .first();
  }

  async clickEditLink(title) {
    const row = this.linkByTitle(title);
    await row.scrollIntoViewIfNeeded().catch(() => {});
    await row.hover();
    const editBtn = this.actionButton(title, 'Edit Link');
    if (await editBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editBtn.click();
    } else {
      // Compact/list layouts render the edit control without a label.
      await row.locator(S.manageLinks.actionButton).nth(1).click();
    }
    await this.modal.waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForTimeout(500);
  }

  async clickDeleteLink(title) {
    const row = this.linkByTitle(title);
    await row.scrollIntoViewIfNeeded().catch(() => {});
    await row.hover();
    await row.locator(S.manageLinks.deleteButton).first().click();
  }

  /** 3.x replaced the inline "Are You Sure?" strip with a confirm modal. */
  async confirmDelete() {
    const confirmBtn = this.page.locator(S.confirmModal.confirm).first();
    await confirmBtn.waitFor({ state: 'visible', timeout: 8000 });
    await confirmBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async deleteLink(title) {
    await this.clickDeleteLink(title);
    await this.confirmDelete();
  }

  async duplicateLink(title) {
    const row = this.linkByTitle(title);
    await row.scrollIntoViewIfNeeded().catch(() => {});
    await row.hover();
    await this.actionButton(title, 'Create Duplicate').click();
    await this.modal.waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForTimeout(500);
  }

  async searchLink(text) {
    await this.searchInput.fill(text);
    await this.page.waitForTimeout(1200);
  }

  async toggleFavorite(title) {
    const row = this.linkByTitle(title);
    await row.hover();
    await row.locator(S.manageLinks.favoriteButton).first().click();
    await this.page.waitForTimeout(800);
  }

  favoriteButton(title) {
    return this.linkByTitle(title).locator(S.manageLinks.favoriteButton).first();
  }

  async isFavorited(title) {
    const cls = await this.favoriteButton(title).getAttribute('class').catch(() => '');
    return (cls || '').includes('favorated') && !(cls || '').includes('unfavorated');
  }

  // --- Board columns (categories) ---
  column(name) {
    return this.page.locator(S.manageLinks.boardColumn).filter({ hasText: name }).first();
  }

  get columns() { return this.page.locator(S.manageLinks.boardColumn); }
  get createCategoryButton() { return this.page.locator(S.manageLinks.createCategoryButton).first(); }
}

module.exports = { ManageLinksPage };

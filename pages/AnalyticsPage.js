const S = require('../helpers/selectors');
const { waitForAppReady, dismissAdminNotice } = require('../helpers/utils');

/**
 * Analytics (BetterLinks 3.x).
 *
 * The dashboard is a single scrolling page split into seven sections
 * (Overview / Geography / Sources / Technology / Timing / Attention / Links)
 * selected from `.bl-an__nav`. The old `.btl-analytics-table` is now the
 * generic `.bl-tbl` table shell, reused by the click log (`.bl-clog`).
 */
class AnalyticsPage {
  static SECTIONS = ['Overview', 'Geography', 'Sources', 'Technology', 'Timing', 'Attention', 'Links'];

  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-analytics';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
    await dismissAdminNotice(this.page);
    await this.page.locator(S.analytics.page).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  }

  async gotoLinkAnalytics(linkId) {
    await this.page.goto(`${this.url}&id=${linkId}`);
    await waitForAppReady(this.page);
    await dismissAdminNotice(this.page);
  }

  async gotoTagAnalytics(tagId) {
    await this.page.goto(`${this.url}&tag_id=${tagId}`);
    await waitForAppReady(this.page);
  }

  // --- Header ---
  get header() { return this.page.locator(S.analytics.header).first(); }
  get heading() { return this.page.locator(S.analytics.title).first(); }
  get rangeButtons() { return this.page.locator(S.analytics.rangeButton); }
  rangeButton(label) {
    return this.page.locator(S.analytics.rangeButton).filter({ hasText: new RegExp(label, 'i') }).first();
  }
  get calendarButton() { return this.page.locator(S.analytics.calendarButton).first(); }
  get calendarPopup() { return this.page.locator(S.analytics.calendarPopup).first(); }
  get filterButton() { return this.page.locator(S.analytics.filterButton).first(); }
  get filterMenu() { return this.page.locator(S.analytics.filterMenu).first(); }
  headerButton(label) {
    return this.page.locator('.bl-an__btn').filter({ hasText: new RegExp(label, 'i') }).first();
  }
  /** Destructive: opens the "reset clicks" confirmation dialog (`.bl-rc`). */
  get resetButton() { return this.headerButton('Reset'); }
  get resetDialog() { return this.page.locator('.bl-rc').first(); }
  get refreshButton() { return this.headerButton('Refresh'); }
  get exportButton() { return this.headerButton('Export'); }

  // --- Section navigation ---
  get tabs() { return this.page.locator(S.analytics.tab); }
  tab(name) {
    return this.page.locator(S.analytics.tab).filter({ hasText: new RegExp(`^${name}`, 'i') }).first();
  }

  async openSection(name) {
    const tab = this.tab(name);
    await tab.click();
    await this.page.waitForTimeout(1500);
    return tab;
  }

  async sectionTitles() {
    return this.page.locator(S.analytics.sectionTitle).allTextContents();
  }

  // --- Widgets ---
  get chart() { return this.page.locator(S.analytics.chart).first(); }
  get hero() { return this.page.locator(S.analytics.hero).first(); }
  get statCards() { return this.page.locator(S.analytics.statCard); }
  get worldMap() { return this.page.locator(S.analytics.worldMap).first(); }
  get barLists() { return this.page.locator(S.analytics.bars); }
  get heatmap() { return this.page.locator(S.analytics.heatmap).first(); }

  // --- Click log table ---
  get dataTable() { return this.page.locator(S.analytics.tableEl).first(); }
  /** Generic table shell — present on both the dashboard and the single-link view. */
  get table() { return this.page.locator(S.analytics.table).first(); }
  /** Full click log — single-link view only. */
  get clickLog() { return this.page.locator(S.analytics.clickLog).first(); }
  get searchInput() { return this.page.locator(S.analytics.searchInput).first(); }
  get bulkSelect() { return this.page.locator(S.analytics.bulkSelect).first(); }
  get columnsButton() { return this.page.locator(S.analytics.columnsButton).first(); }
  get pager() { return this.page.locator(S.analytics.pager).first(); }
  get rowsPerPage() { return this.page.locator(S.analytics.rowsPerPage).first(); }
  get emptyRow() { return this.page.locator(S.analytics.emptyRow).first(); }

  async columnHeaders() {
    const headers = await this.page.locator(`${S.analytics.tableEl} thead th`).allTextContents();
    return headers.map((h) => h.trim()).filter(Boolean);
  }

  tableRow(text) {
    return this.page.locator(`${S.analytics.tableEl} tbody tr`).filter({ hasText: text }).first();
  }

  async rowCount() {
    return this.page.locator(`${S.analytics.tableEl} tbody tr`).count();
  }

  async searchAnalytics(query) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(1200);
  }

  /** The "Links" section lists every tracked link with its click totals. */
  linkRow(title) {
    return this.page.locator(`${S.analytics.tableEl} tbody tr, .bl-tbl__rows tr`).filter({ hasText: title }).first();
  }

  async hasDataForLink(title) {
    return this.linkRow(title).isVisible({ timeout: 8000 }).catch(() => false);
  }

  async getClickCount(title) {
    const text = await this.linkRow(title).textContent().catch(() => '');
    const match = (text || '').match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  // --- Single-link view ---
  get singleCard() { return this.page.locator(S.analytics.singleCard).first(); }
  get backButton() { return this.page.locator(S.analytics.backButton).first(); }
}

module.exports = { AnalyticsPage };

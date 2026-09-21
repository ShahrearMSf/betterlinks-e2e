const S = require('../helpers/selectors');
const { waitForAppReady, dismissAdminNotice } = require('../helpers/utils');

/**
 * Link Scanner (BetterLinks 3.x) — three react-tabs sections:
 *   1. Full Site Link Scanner       (crawls posts/pages; `.btl-scanhealth` + `.btl-flc-*`)
 *   2. BetterLinks Broken Link Scanner (checks BetterLinks targets; `.btl-bls-*`)
 *   3. Scheduled Scan & Reports     (cron + email reporting; `.btl-bls-*`)
 */
class LinkScannerPage {
  static TABS = [
    'Full Site Link Scanner',
    'BetterLinks Broken Link Scanner',
    'Scheduled Scan & Reports',
  ];

  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-link-scanner';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
    await dismissAdminNotice(this.page);
    await this.page.locator(S.scanner.tabList).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  }

  // --- Tabs ---
  get tabs() { return this.page.locator(S.scanner.tab); }
  get selectedTab() { return this.page.locator(S.scanner.selectedTab).first(); }
  get panel() { return this.page.locator(S.scanner.panel).first(); }

  tab(name) {
    return this.page.locator(S.scanner.tab).filter({ hasText: new RegExp(name, 'i') }).first();
  }

  async openTab(name) {
    await this.tab(name).click();
    await this.page.waitForTimeout(2000);
    return this.panel;
  }

  async tabNames() {
    const names = await this.tabs.allTextContents();
    return names.map((n) => n.replace(/\s+/g, ' ').trim());
  }

  // --- Tab 1: Full Site Link Scanner ---
  get health() { return this.page.locator(S.scanner.health).first(); }
  get healthScore() { return this.page.locator(S.scanner.healthScore).first(); }
  get scanButton() { return this.page.locator(S.scanner.startScanButton).first(); }
  get healthChips() { return this.page.locator(S.scanner.healthChip); }
  get resultsCard() { return this.page.locator(S.scanner.flcCard).first(); }
  get resultsTable() { return this.page.locator(S.scanner.flcTable).first(); }
  get resultsSearch() { return this.page.locator(S.scanner.flcSearch).first(); }
  get statusFilter() { return this.page.locator(S.scanner.flcDropdown).first(); }
  get clearLogsButton() { return this.page.locator(S.scanner.flcClearLogs).first(); }
  get scanModal() { return this.page.locator(S.scanner.scanModal).first(); }
  get noDataState() { return this.page.locator(S.scanner.noData).first(); }

  async startScan() {
    await this.scanButton.click();
    await this.page.waitForTimeout(3000);
  }

  async waitForScanComplete(timeout = 120000) {
    await this.page
      .locator('text=/Scan Complete|Scan finished|No broken|Completed/i')
      .first()
      .waitFor({ timeout })
      .catch(() => {});
    // The progress modal closes itself when the crawl finishes.
    await this.scanModal.waitFor({ state: 'detached', timeout }).catch(() => {});
  }

  brokenLinkRow(text) {
    return this.page.locator(`${S.scanner.flcTable} tbody tr, ${S.scanner.brokenLinksTable} tbody tr`)
      .filter({ hasText: text })
      .first();
  }

  async getBrokenLinkCount() {
    return this.page.locator(`${S.scanner.flcTable} tbody tr, ${S.scanner.brokenLinksTable} tbody tr`).count();
  }

  // --- Tabs 2 & 3: card-based panels ---
  get cards() { return this.page.locator(S.scanner.blsCard); }
  card(title) {
    return this.page.locator(S.scanner.blsCard).filter({ hasText: new RegExp(title, 'i') }).first();
  }
  get primaryButton() { return this.page.locator(S.scanner.blsPrimary).first(); }
  get brokenLinksTable() { return this.page.locator(S.scanner.brokenLinksTable).first(); }
}

module.exports = { LinkScannerPage };

const { waitForAppReady } = require('../helpers/utils');

class AnalyticsPage {
  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-analytics';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
  }

  async gotoLinkAnalytics(linkId) {
    await this.page.goto(`${this.url}&id=${linkId}`);
    await waitForAppReady(this.page);
  }

  // --- Locators ---
  get chart() {
    return this.page.locator('.apexcharts-canvas, [class*="chart"], svg').first();
  }

  get dataTable() {
    return this.page.locator('table, [class*="analytics-table"], [class*="data-table"]').first();
  }

  get dateFilter() {
    return this.page.locator('[class*="date-filter"], [class*="daterange"]').first();
  }

  get searchInput() {
    return this.page.locator('input[placeholder*="Search"], input[type="search"]').first();
  }

  get refreshButton() {
    return this.page.locator('button, span').filter({ hasText: /Refresh|Reset/i }).first();
  }

  // --- Analytics data rows ---
  linkRow(title) {
    return this.page.locator('tr, [class*="row"]').filter({ hasText: title }).first();
  }

  async getClickCount(title) {
    const row = this.linkRow(title);
    const text = await row.textContent();
    // Try to extract click count number from the row
    const match = text.match(/(\d+)\s*(click|unique)/i);
    return match ? parseInt(match[1]) : 0;
  }

  async searchAnalytics(query) {
    await this.searchInput.fill(query);
    await this.page.waitForTimeout(1000);
  }

  async hasDataForLink(title) {
    const row = this.linkRow(title);
    return row.isVisible({ timeout: 5000 }).catch(() => false);
  }
}

module.exports = { AnalyticsPage };

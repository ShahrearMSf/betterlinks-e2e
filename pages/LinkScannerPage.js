const { waitForAppReady, waitForToast } = require('../helpers/utils');

class LinkScannerPage {
  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-link-scanner';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
  }

  get scanButton() {
    return this.page.locator('button, a').filter({ hasText: /Scan|Check|Start/i }).first();
  }

  get dataTable() {
    return this.page.locator('table, [class*="table"], [class*="broken-links"]').first();
  }

  get progressBar() {
    return this.page.locator('[class*="progress"], [role="progressbar"]').first();
  }

  get statusFilter() {
    return this.page.locator('[class*="filter"], select').first();
  }

  async startScan() {
    await this.scanButton.click();
    // Wait for scan to start (progress bar or table changes)
    await this.page.waitForTimeout(2000);
  }

  async waitForScanComplete(timeout = 60000) {
    // Wait for scan to finish — look for completion indicator
    await this.page.locator('text=/Scan Complete|No broken|Completed/i')
      .waitFor({ timeout }).catch(() => {});
  }

  brokenLinkRow(url) {
    return this.page.locator('tr, [class*="row"]').filter({ hasText: url }).first();
  }

  async getBrokenLinkCount() {
    const rows = this.page.locator('[class*="broken-link-row"], tbody tr');
    return rows.count();
  }
}

module.exports = { LinkScannerPage };

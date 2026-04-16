const { waitForAppReady, waitForToast } = require('../helpers/utils');

class SettingsPage {
  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-settings';
  }

  async goto() {
    await this.page.goto(this.url);
    await waitForAppReady(this.page);
  }

  // --- Tab Navigation (react-tabs) ---
  async clickTab(tabName) {
    await this.page.locator('.react-tabs__tab').filter({ hasText: new RegExp(tabName, 'i') }).first().click();
    await this.page.waitForTimeout(500);
  }

  async gotoGeneral() { await this.clickTab('General'); }
  async gotoAdvanced() { await this.clickTab('Advanced'); }
  async gotoTools() { await this.clickTab('Tools'); }
  async gotoRoleManagement() { await this.clickTab('Role Management'); }

  // --- General Settings checkboxes (labels from TabsGeneral) ---
  checkbox(labelText) {
    return this.page.locator('label').filter({ hasText: new RegExp(labelText, 'i') }).locator('input[type="checkbox"]').first();
  }

  get nofollowCheckbox() { return this.checkbox('No Follow'); }
  get sponsoredCheckbox() { return this.checkbox('Sponsored'); }
  get paramForwardingCheckbox() { return this.checkbox('Parameter Forwarding'); }
  get trackMeCheckbox() { return this.checkbox('Track Me'); }

  get saveButton() {
    return this.page.locator('button').filter({ hasText: /Save|Update/i }).first();
  }

  async saveSettings() {
    await this.saveButton.click();
    return waitForToast(this.page, 'success').catch(() => null);
  }

  // --- Tools Tab ---
  async selectExportType(type) {
    await this.page.locator('label, span').filter({ hasText: new RegExp(type, 'i') }).first().click();
  }

  get exportButton() {
    return this.page.locator('button, input[type="submit"]').filter({ hasText: /Export/i }).first();
  }

  get importFileInput() {
    return this.page.locator('input[type="file"]').first();
  }

  get importButton() {
    return this.page.locator('button, input[type="submit"]').filter({ hasText: /Import|Migrate/i }).first();
  }
}

module.exports = { SettingsPage };

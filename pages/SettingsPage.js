const S = require('../helpers/selectors');
const { waitForAppReady, waitForToast, dismissAdminNotice } = require('../helpers/utils');

/**
 * Settings (BetterLinks 3.x).
 *
 * react-tabs is gone: settings are now a sidebar shell with three groups —
 * Configure (Link Defaults, Redirects, Tracking, Automation, AI Configuration),
 * Tools (Auto Post Link Generator, UTM Builder, Import & Export, Feature
 * Modules) and System (Role Management, License). Each panel deep-links via
 * `?page=betterlinks-settings&tab=<id>`.
 */
class SettingsPage {
  static NAV = {
    linkDefaults: 'Link Defaults',
    redirects: 'Redirects',
    tracking: 'Tracking',
    automation: 'Automation',
    ai: 'AI Configuration',
    autoPost: 'Auto Post Link Generator',
    utm: 'UTM Builder',
    importExport: 'Import & Export',
    featureModules: 'Feature Modules',
    roleManagement: 'Role Management',
    license: 'License',
  };

  constructor(page) {
    this.page = page;
    this.url = '/wp-admin/admin.php?page=betterlinks-settings';
  }

  async goto(tab = null) {
    await this.page.goto(tab ? `${this.url}&tab=${tab}` : this.url);
    await waitForAppReady(this.page);
    await dismissAdminNotice(this.page);
    await this.page.locator(S.settings.page).first().waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
  }

  // --- Sidebar ---
  get sidebar() { return this.page.locator(S.settings.sidebar).first(); }
  get navItems() { return this.page.locator(S.settings.navLabel); }
  get groupTitles() { return this.page.locator(S.settings.groupTitle); }
  get panel() { return this.page.locator(S.settings.panel).first(); }
  get panelTitle() { return this.page.locator(S.settings.panelTitle).first(); }

  navLink(label) {
    return this.page
      .locator(`${S.settings.navLink}, ${S.settings.subLink}`)
      .filter({ hasText: new RegExp(label, 'i') })
      .first();
  }

  /** Click a sidebar entry; nested entries (Tracking, Automation) expand first. */
  async openSection(label) {
    const link = this.navLink(label);
    await link.click();
    await this.page.waitForTimeout(900);
    // Parent disclosure items reveal children instead of switching the panel.
    const child = this.page.locator(S.settings.subLink).filter({ hasText: new RegExp(label, 'i') }).first();
    if (await child.isVisible({ timeout: 1500 }).catch(() => false)) {
      await child.click();
      await this.page.waitForTimeout(900);
    }
    return this.panel;
  }

  async activeSection() {
    return this.page.locator(`${S.settings.navLink}.is-active ${S.settings.navLabel}`).first().innerText().catch(() => '');
  }

  async navLabels() {
    const labels = await this.navItems.allTextContents();
    return labels.map((l) => l.trim()).filter(Boolean);
  }

  // Backwards-compatible shortcuts used by the specs
  async gotoLinkDefaults() { return this.openSection(SettingsPage.NAV.linkDefaults); }
  async gotoRedirects() { return this.openSection(SettingsPage.NAV.redirects); }
  async gotoTracking() { return this.openSection(SettingsPage.NAV.tracking); }
  async gotoImportExport() { return this.goto('import-export'); }
  async gotoRoleManagement() { return this.goto('role-management'); }
  async gotoLicense() { return this.goto('license'); }

  // --- Toggle rows ---
  settingRow(labelText) {
    return this.page.locator(S.settings.row).filter({ hasText: new RegExp(labelText, 'i') }).first();
  }

  /**
   * 3.x replaced the settings checkboxes with `button[role="switch"]` toggles
   * that carry `data-name` (the settings key), `aria-label` (the visible label)
   * and `aria-checked`. Several toggles share one `.bl-set-row`, so they must
   * be addressed by name — not by row.
   */
  toggle(nameOrLabel) {
    return this.page
      .locator(`${S.settings.toggle}[data-name="${nameOrLabel}"], ${S.settings.toggle}[aria-label="${nameOrLabel}"]`)
      .first();
  }

  async isToggleOn(nameOrLabel) {
    const toggle = this.toggle(nameOrLabel);
    const checked = await toggle.getAttribute('aria-checked').catch(() => null);
    if (checked !== null) return checked === 'true';
    const cls = await toggle.getAttribute('class').catch(() => '');
    return (cls || '').includes('is-on');
  }

  async setToggle(nameOrLabel, enabled) {
    const current = await this.isToggleOn(nameOrLabel);
    if (current !== enabled) {
      await this.toggle(nameOrLabel).click();
      await this.page.waitForTimeout(400);
    }
    return this.isToggleOn(nameOrLabel);
  }

  // Defaults live on the "Link Defaults" panel, in the Link Attributes row.
  get nofollowToggle() { return this.toggle('nofollow'); }
  get sponsoredToggle() { return this.toggle('sponsored'); }
  get paramForwardingToggle() { return this.toggle('param_forwarding'); }
  get trackMeToggle() { return this.toggle('track_me'); }

  get saveButton() { return this.page.locator(S.settings.saveButton).first(); }

  async saveSettings() {
    await this.saveButton.click();
    return waitForToast(this.page, 'success').catch(() => null);
  }

  // --- Import & Export panel ---
  get toolsGrid() { return this.page.locator(S.settings.toolsGrid).first(); }
  get toolsCards() { return this.page.locator(S.settings.toolsCard); }
  get exportOptions() { return this.page.locator(S.settings.toolsOption); }
  get importFileInput() { return this.page.locator(S.settings.fileInput).first(); }

  toolsCard(title) {
    return this.page.locator(S.settings.toolsCard).filter({ hasText: new RegExp(title, 'i') }).first();
  }

  exportOption(label) {
    return this.toolsCard('Export Data')
      .locator(S.settings.toolsOption)
      .filter({ hasText: new RegExp(label, 'i') })
      .first();
  }

  importOption(label) {
    return this.toolsCard('Import Data')
      .locator(S.settings.toolsOption)
      .filter({ hasText: new RegExp(label, 'i') })
      .first();
  }

  async selectExportType(label) {
    await this.exportOption(label).click();
    await this.page.waitForTimeout(300);
  }

  get exportButton() {
    return this.toolsCard('Export Data').locator(S.settings.toolsActionButton).first();
  }

  get importButton() {
    return this.toolsCard('Import Data').locator(S.settings.toolsActionButton).first();
  }

  // --- Pro panels ---
  get roleManagement() { return this.page.locator(S.settings.roleManagement).first(); }
  get roleSwitches() { return this.page.locator(S.settings.roleSwitchInput); }
  get roleNames() { return this.page.locator(S.settings.roleName); }
  get license() { return this.page.locator(S.settings.license).first(); }
  get licenseStatus() { return this.page.locator(S.settings.licenseStatus).first(); }
  get licenseInput() { return this.page.locator(S.settings.licenseInput).first(); }
}

module.exports = { SettingsPage };

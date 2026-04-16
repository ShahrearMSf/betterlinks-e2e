/**
 * Centralized selectors for BetterLinks admin UI.
 * Derived from the React source code in dev_betterlinks/.
 */
module.exports = {
  // WordPress Admin
  wp: {
    adminMenu: '#adminmenu',
    betterlinksMenu: '#toplevel_page_betterlinks',
    subMenu: '.wp-submenu',
    notices: '.notice',
  },

  // React App Root
  app: {
    root: '#betterlinksbody',
    topbar: '.topbar',
    loader: '.btl-loader',
  },

  // Manage Links Page
  manageLinks: {
    createButton: '.btl-create-new-link',
    searchInput: 'input[placeholder*="Search"]',
    linkCard: '.btl-link-item',
    linkTitle: '.btl-link-title',
    listView: '.btl-list-view',
    listViewTable: '.btl-list-view-table',
    editButton: '.dnd-link-button',
    deleteButton: '.btl-delete-link',
    favoriteButton: '.btl-favorite-link',
    bulkActions: '.btl-bulk-actions',
    categoryFilter: '.btl-category-filter',
  },

  // Link Form Modal
  linkForm: {
    modal: '.ReactModal__Content',
    overlay: '.ReactModal__Overlay',
    closeButton: '.btl-close-modal',
    titleInput: '#link_title',
    noteInput: '#link_note',
    targetUrlInput: '#target_url',
    shortUrlInput: '#short_url',
    redirectTypeSelect: '.btl-redirect-type',
    categorySelect: '.btl-cat-id',
    tagsSelect: '.btl-tags-id',
    submitButton: '.btl-modal-submit-button',
    utmButton: '.btl-utm-button',

    // Link Options toggles (right panel)
    optionsPanel: '.link-options',
    optionHead: '.link-options__head',
    optionBody: '.link-options__body',
    nofollowCheckbox: 'input[name="nofollow"]',
    sponsoredCheckbox: 'input[name="sponsored"]',
    paramForwardingCheckbox: 'input[name="param_forwarding"]',
    trackMeCheckbox: 'input[name="track_me"]',
  },

  // Settings Page
  settings: {
    generalTab: '[data-rttab="0"]',
    advancedTab: '[data-rttab="1"]',
    toolsTab: '[data-rttab="2"]',
    roleManagementTab: '[data-rttab="3"]',
    saveButton: '.button-primary',
    redirectTypeSelect: 'select[name="redirect_type"]',
  },

  // Analytics Page
  analytics: {
    dateFilter: '.btl-date-filter',
    chart: '.apexcharts-canvas',
    dataTable: '.btl-analytics-table',
    searchInput: 'input[placeholder*="Search"]',
    refreshButton: '.btl-refresh-stats',
  },

  // Categories & Tags Page
  terms: {
    tagsTab: '[data-rttab="0"]',
    categoriesTab: '[data-rttab="1"]',
    addNewButton: '.btl-add-new',
    nameInput: 'input[name="term_name"]',
    slugInput: 'input[name="term_slug"]',
    saveButton: '.button-primary',
    deleteButton: '.btl-delete-term',
    dataTable: '.btl-terms-table',
  },

  // Pro: Auto-Link Keywords
  keywords: {
    addButton: '.btl-add-keyword',
    keywordInput: 'input[name="keywords"]',
    linkSelect: '.btl-keyword-link-select',
    saveButton: '.button-primary',
    dataTable: '.btl-keywords-table',
  },

  // Pro: Password Protection (inside link form)
  passwordProtection: {
    enableCheckbox: 'input[name="enable_password_protection"]',
    passwordInput: 'input[name="password"]',
    cookieCheckbox: 'input[name="password.remember_password_cookies"]',
  },

  // Toast Notifications
  toast: {
    success: '.Toastify__toast--success',
    error: '.Toastify__toast--error',
    container: '.Toastify',
  },
};

/**
 * Centralized selectors for the BetterLinks admin UI.
 *
 * Target: BetterLinks 3.x (free) + BetterLinks Pro 3.x.
 *
 * The 3.0 redesign replaced the old `btl-*` markup with a `bl-*` / `blb-*`
 * BEM system (board, list, drawer, settings shell, analytics sections), so
 * these do NOT match 2.x builds. A handful of legacy hooks survived the
 * redesign and are still used below: `.btl-create-link-button`,
 * `.dnd-link-button`, `.delete-button`, `.btl-fav-link`, `.btl-check`,
 * `.btl-toast-*`, `.ReactModal__*` and the link drawer's `data-testid`s.
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
    navbar: '.bl-navbar',
    loading: '.betterlinks-loading',
    noticeArea: '.bl-notice-area',
  },

  // Manage Links — board (default) / list views
  manageLinks: {
    page: '.bl-manage',
    header: '.bl-manage__header',
    title: '.bl-manage__title',
    createButton: '.bl-create-links .btl-create-link-button',
    refreshButton: '.bl-manage__actions .bl-icon-btn',
    viewSegment: '.bl-viewseg',
    viewButton: '.bl-viewseg__btn',        // Board / List / Compact
    overview: '.bl-overview',
    overviewCard: '.bl-overview__card',

    // Toolbar
    toolbar: '.bl-toolbar',
    searchInput: '.bl-toolbar__search input',
    filter: '.bl-filter',
    favoriteFilter: '.bl-toolbar__fav',
    resetFilters: '.bl-toolbar__reset',

    // Board view
    board: '.blb',
    boardColumn: '.blb-col',
    boardColumnTitle: '.blb-col__title',
    boardColumnMenu: '.blb-col__menu-btn',
    boardAddColumn: '.blb-col--add',
    createCategoryButton: '.dnd-create-category-button',
    card: '.blb-card',
    cardTitle: '.blb-card__title',
    cardGrip: '.blb-card__grip',
    cardSlug: '.blb-card__slug-text',
    cardClicks: '.blb-card__clicks',
    cardActions: '.blb-card__foot-actions',

    // List view
    listView: '.bl-listview',
    listTable: '.bl-list__table',
    listRow: '.bl-list__table tbody tr',
    listRowTitle: '.bl-row__title',
    listBulkBar: '.bl-list__bulk',
    listBulkDelete: '.bl-list__bulk-btn.is-danger',

    // Row/card action buttons (shared by both views)
    actionButton: '.dnd-link-button',
    deleteButton: '.delete-button',
    favoriteButton: '.btl-fav-link',
    tooltip: '.btl-tooltip',
  },

  // Link drawer (create / edit link) — react-modal, `.bl-drawer` inside
  linkForm: {
    portal: '.bl-drawer-portal',
    overlay: '.ReactModal__Overlay',
    modal: '.ReactModal__Content',
    drawer: '.bl-drawer',
    header: '.bl-drawer__header',
    title: '.bl-drawer__title',
    closeButton: '.bl-drawer__close',
    submitButton: '[data-testid="btl-submit-button"]',
    cancelButton: '.bl-drawer__cancel',

    titleInput: '#link_title',
    noteInput: '#link_note',
    targetUrlInput: '#target_url',
    shortUrlInput: '#short_url',
    redirectTypeSelect: '[data-testid="btl-redirect-type"] .btl-react-select__control',
    redirectTypeValue: '[data-testid="btl-redirect-type"] input[name="redirect_type"]',
    categorySelect: '[data-testid="btl-cat-id"] .btl-react-select__control',
    categoryValue: '[data-testid="btl-cat-id"] input[name="cat_id"]',
    tagsSelect: '[data-testid="btl-tags-id"] .btl-react-select__control',
    utmButton: '[data-testid="btl-utm-button"]',
    shareButton: '[data-testid="btl-share-button"]',
    slugError: '.errorlog',

    // Collapsible panels in the right column
    optionsPanel: '.link-options',
    panelHead: '.link-options__head',
    panelTitle: '.link-options__head--title',
    panelBody: '.link-options__body',
    advancedPanel: '.link-options--advanced',
    dynamicRedirectPanel: '.link-options--dynamic-redirect',

    // Link Options checkboxes (hidden inputs — click the wrapping label)
    checkbox: (name) => `input.btl-check[name="${name}"]`,
    nofollowCheckbox: 'input.btl-check[name="nofollow"]',
    sponsoredCheckbox: 'input.btl-check[name="sponsored"]',
    paramForwardingCheckbox: 'input.btl-check[name="param_forwarding"]',
    trackMeCheckbox: 'input.btl-check[name="track_me"]',
    uncloakedCheckbox: 'input.btl-check[name="uncloaked"]',
  },

  // Analytics — redesigned dashboard with 7 sections
  analytics: {
    page: '.bl-an',
    header: '.bl-an__head',
    title: '.bl-an__title',
    rangeButton: '.bl-an__range-btn',          // 7 / 30 / 90 days
    calendarButton: '.bl-an__range-icon',
    calendarPopup: '.bl-an__pop--calendar',
    filterButton: '.bl-an__filter .bl-an__btn',
    filterMenu: '.bl-an__pop--menu',
    filterMenuItem: '.bl-an__menu-item',
    actionButton: '.bl-an__actions .bl-an__btn', // Reset / Refresh Stats
    exportButton: '.bl-an__tools > .bl-an__btn',
    nav: '.bl-an__nav',
    tab: '.bl-an__tab',
    section: '.bl-an__section',
    sectionTitle: '.bl-an__sectitle',

    // Overview
    hero: '.bl-hero',
    heroChart: '.bl-hero__chart',
    chart: '.apexcharts-canvas',
    statCard: '.bl-stat',

    // Pro sections
    geography: '.bl-geo',
    worldMap: '.bl-geo__map',
    bars: '.bl-bars',
    heatmap: '.bl-heat',
    mover: '.bl-mv',

    // Click log table
    table: '.bl-tbl',
    clickLog: '.bl-clog',
    tableEl: '.bl-tbl__table',
    searchInput: '.bl-tbl__search input',
    bulkSelect: '.bl-tbl__select',
    bulkApply: '.bl-tbl__apply',
    columnsButton: '.bl-clog__cols-btn',
    columnsMenu: '.bl-clog__cols-menu',
    emptyRow: '.bl-tbl__empty-row',
    rowsPerPage: '.bl-tbl__rows select',
    pager: '.bl-tbl__pager',

    // Single-link view
    singleCard: '.bl-slc',
    backButton: '.bl-an__back',
  },

  // Tags & Categories
  terms: {
    page: '.bl-tc',
    title: '.bl-tc__title',
    exportButton: '.bl-tc__btn-ghost',
    addNewButton: '.btl-create-autolink-button',
    statCard: '.bl-tc__stat',
    tab: '.bl-tc__tab',                       // Tags | Categories
    searchInput: '.bl-tc__search input',
    sortSelect: '.bl-tc__sort-select',
    table: '.bl-tc__table',
    row: '.bl-tc__table tbody tr',
    nameCell: '.bl-tc__name-text',
    emptyRow: '.bl-tc__empty-row',
    rowActions: '.bl-tc__row-actions',
    deleteButton: '.bl-tc__action-btn--danger',
    bulkBar: '.bl-tc__bulk',
    pager: '.bl-tc__pager',

    // Add/edit term modal
    modal: '.bl-term-modal',
    modalTitle: '.bl-term-modal__title',
    typeButton: '.bl-term-modal__type-btn',
    nameInput: '#bl-term-name',
    modalError: '.bl-term-modal__error',
    modalSubmit: '.bl-term-modal__btn--primary',
    modalCancel: '.bl-term-modal__btn--ghost',
    modalClose: '.bl-term-modal__close',
  },

  // Settings — sidebar shell (no react-tabs any more)
  settings: {
    page: '.bl-settings',
    sidebar: '.bl-settings__sidebar',
    groupTitle: '.bl-settings__group-title',   // Configure | Tools | System
    navItem: '.bl-settings__navitem',
    navLink: '.bl-settings__navlink',
    navLabel: '.bl-settings__navlabel',
    subNav: '.bl-settings__subnav',
    subLink: '.bl-settings__sublink',
    content: '.bl-settings__content',
    panel: '.bl-settings__panel',
    panelTitle: '.bl-settings__panel-title',
    row: '.bl-set-row',
    rowLabel: '.bl-set-row__label',
    toggle: '.bl-toggle',
    toggleOn: '.bl-toggle.is-on',
    saveButton: '.bl-set-save',
    docs: '.bl-docs',

    // Import & Export panel (Tools → Import & Export)
    toolsGrid: '.btl-tools-grid',
    toolsCard: '.btl-tools-card',
    toolsOption: '.btl-tools-option',
    toolsActionButton: '.btl-tools-action-button',
    importLog: '.btl-import-log',
    fileInput: 'input[type="file"]',

    // Pro: Role Management panel
    roleManagement: '.bl-rm',
    roleGrid: '.bl-rm__grid',
    roleSwitch: '.bl-rm__switch',
    roleSwitchInput: '.bl-rm__switch-input',
    roleName: '.bl-rm__role-name',
    roleFooter: '.bl-rm__footer',

    // Pro: License panel
    license: '.bl-lic',
    licenseHero: '.bl-lic__hero',
    licenseStatus: '.bl-lic__status',
    licenseInput: '.bl-lic__input-field',
    licenseField: '.bl-lic__field',
    licenseSteps: '.bl-lic__steps',
    licenseMessage: '.bl-lic__msg',
  },

  // Auto-Link Keywords (Pro feature, free UI shell)
  keywords: {
    page: '.bl-kw',
    title: '.bl-kw__title',
    addButton: '.btl-create-autolink-button',
    importExport: '.btl-keywords-import-export',
    // `.btl-download` / `.btl-upload` are the icon glyphs inside these buttons.
    exportButton: '.btl-keywords-import-export .btl-btn-secondary',
    importButton: '.btl-keywords-import-export .btl-import-button',
    statCard: '.bl-kw__stat',
    searchInput: '.bl-kw__search input',
    filterSelect: '.bl-kw__filter-select',
    resetButton: '.bl-kw__reset',
    table: '.bl-kw__table',
    row: '.bl-kw__table tbody tr',
    emptyRow: '.bl-kw__empty-row',

    // Add/edit keyword drawer
    drawer: '.bl-kw-drawer',
    chipsInput: '.bl-kw-chips__input',
    chip: '.bl-kw-chips__item',
    linkSelect: '.btl-modal-select--full .btl-react-select__control',
    submitButton: '[data-testid="btl-submit-button"], .bl-drawer__publish',
  },

  // Link Scanner — three tabs (react-tabs)
  scanner: {
    tabList: '.react-tabs__tab-list',
    tab: '.react-tabs__tab',
    selectedTab: '.react-tabs__tab--selected',
    panel: '.react-tabs__tab-panel--selected',

    // Tab 1 — Full Site Link Scanner
    health: '.btl-scanhealth',
    healthScore: '.btl-scanhealth__score-value',
    startScanButton: '.btl-link-scan-btn',
    healthChip: '.btl-scanhealth__chip',
    flcCard: '.btl-flc-card',
    flcSearch: '.btl-flc-search input',
    flcDropdown: '.btl-flc-dropdown__trigger',
    flcTable: '.btl-flc-table',
    flcButton: '.btl-flc-btn',
    flcClearLogs: '.btl-flc-btn--danger',
    scanModal: '.bl-scanmodal',
    noData: '.btl-no-data-found',

    // Tab 2 — BetterLinks Broken Link Scanner / Tab 3 — Scheduled Scan & Reports
    blsCard: '.btl-bls-card',
    blsButton: '.btl-bls-btn',
    blsPrimary: '.btl-bls-btn--primary',
    blsInput: '.btl-bls-input',
    brokenLinksTable: '.btl-broken-links-table-wrapper',
  },

  // Pro: Promo Cards (Product Display) and Bio Links share the `btl-pd-*` shell
  productDisplay: {
    page: '.btl-product-display-page',
    header: '.btl-pd-header',
    title: '.btl-pd-header__title',
    addButton: '.btl-pd-btn--primary',
    tab: '.btl-pd-tab',                       // Single Cards | Card Groups (or Bio Links | Analytics)
    searchInput: '.btl-pd-search__input',
    list: '.btl-pd-list',
    card: '.btl-pd-card',
    empty: '.btl-pd-empty',

    // Editor (shared by promo cards and bio links)
    editor: '.btl-pd-editor',
    editorBack: '.btl-pd-editor__back',
    editorTitle: '.btl-pd-editor__bar-title',
    editorActions: '.btl-pd-editor__bar-actions',
    editorNav: '.btl-pd-editor__nav',
    navItem: '.btl-pd-navitem',
    navItemTitle: '.btl-pd-navitem__title',
    contentTitle: '.btl-pd-editor__content-title',
    input: '.btl-pd-editor__input',
    dropzone: '.btl-pd-dropzone',
    toggle: '.btl-pd-toggle',
    toggleBox: '.btl-pd-togglebox',
    preview: '.btl-pd-editor__preview',
    previewCard: '.btl-pd-preview',
    segmented: '.btl-pd-segmented__btn',
  },

  bioLinks: {
    page: '.btl-lib',
    card: '.btl-lib-card',
    field: '.btl-lib-field',
    label: '.btl-lib-label',
    input: '.btl-lib-input',
    editor: '.btl-lib-quill .ql-editor',
    slugWrap: '.btl-lib-slug',
    slugPrefix: '.btl-lib-slug__prefix',
    slugInput: '.btl-lib-slug__input',
    phonePreview: '.btl-lib-phone',
    phoneTitle: '.btl-lib-phone__title',
  },

  // Gutenberg editor integrations (post / page screens)
  gutenberg: {
    instantRedirectPanel: '.components-panel__body:has-text("Instant Redirect")',
    instantRedirectBody: '.betterlinks-instant-redirect',
    deleteInstantRedirect: '.betterlinks-instant-gutenberg-redirect-delete-button-wrapper button',
    autoLinkSidebar: '.betterlinks-auto-link-create-sidebar',
    bodyHasLink: 'body.betterlinks-guten-instant-redirect-has-link',
  },

  // Shared modals
  confirmModal: {
    modal: '.bl-confirm-modal',
    title: '.bl-confirm-modal__title',
    confirm: '.bl-confirm-modal__btn--danger',
    cancel: '.bl-confirm-modal__btn--ghost',
  },

  permissionModal: '.btl-permission-modal',

  // Toast notifications (unchanged across 2.x → 3.x)
  toast: {
    wrapper: '.btl-toast-wrapper',
    item: '.btl-toast-item',
    success: '.btl-toast-success',
    error: '.btl-toast-error',
    message: '.btl-toast-message',
    close: '.btl-toast-close',
  },
};

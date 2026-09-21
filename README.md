<a id="readme-top"></a>

<br />
<div align="center">
  <a href="https://betterlinks.io">
    <img src="https://ps.w.org/betterlinks/assets/icon-256x256.gif" alt="BetterLinks" width="96" height="96" style="object-fit:contain;">
  </a>

  <h3 align="center">BetterLinks E2E Test Automation</h3>

  <p align="center">
    Full Playwright test suite for BetterLinks (Free + Pro)
    — admin, REST, redirect, and frontend coverage.
  </p>
</div>

## About The Project

[BetterLinks](https://betterlinks.io) is a WordPress link-management plugin with cloaking, UTM builder, auto-linking, broken-link scanning, password protection, split testing and rich click analytics (country / device / browser / OS).

This project provides an end-to-end Playwright suite covering the BetterLinks React admin, the REST layer, redirect semantics, and public-facing behaviours such as auto-link keyword replacement.

### Built With

* Node.js 22 LTS
* [Playwright](https://playwright.dev) `^1.59`
* dotenv

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

### Prerequisites

- Node.js 22 LTS (or newer)
- npm
- A WordPress install with BetterLinks Free + Pro activated
- An admin account with `manage_options`

### Installation

1. Clone the repo
   ```sh
   git clone <repo-url>
   cd BetterLinks-E2E-Test
   ```
2. Install dependencies
   ```sh
   npm install
   ```
3. Create `.env` from the template and fill in your site details
   ```sh
   cp .env.example .env
   # then edit .env
   ```
   Required variables:
   ```env
   BASE_URL=https://your-site.example
   ADMIN_USER=admin-username-or-email
   ADMIN_PASS=your-admin-password
   ```
4. Install Playwright browsers
   ```sh
   npx playwright install --with-deps
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

```sh
# Full suite (headless)
npm test

# Only the "free" project
npm run test:free

# Only the "pro" project
npm run test:pro

# Just refresh the auth session
npm run test:auth

# Open the HTML report from the last run
npm run report

# Run a single spec
npx playwright test tests/free/link-crud.spec.js

# Debug / headed run (for demos)
npx playwright test --headed
# or step through a single spec
npx playwright test tests/free/link-crud.spec.js --headed --debug
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Project Structure

```
BetterLinks-E2E-Test/
├── .env.example              # Environment template (copy to .env)
├── .gitignore                # Excludes .env, node_modules, test artifacts, probes
├── package.json              # npm scripts & deps
├── playwright.config.js      # Projects: auth-setup → free → pro; global setup/teardown
├── README.md
├── helpers/
│   ├── api.js                # REST wrapper (links, terms, settings, analytics, keywords, UTM)
│   ├── cleanup.js            # Safe sweep of test-prefixed data
│   ├── global-setup.js       # Pre-run sweep
│   ├── global-teardown.js    # Post-run sweep
│   ├── selectors.js          # Centralised selector map (3.x `bl-*` / `blb-*`)
│   └── utils.js              # safeGoto, handleEmailVerification, toasts, slug helpers
├── pages/                    # Page objects
│   ├── ManageLinksPage.js
│   ├── SettingsPage.js
│   ├── AnalyticsPage.js
│   ├── CategoriesTagsPage.js
│   ├── KeywordsPage.js
│   ├── LinkScannerPage.js
│   ├── PromoCardsPage.js     # Pro 3.0 — Product Display
│   └── BioLinksPage.js       # Pro 3.0 — Link in Bio
├── tests/
│   ├── auth.setup.js         # Login & storageState (with transient-failure retry)
│   ├── free/                 # Free-tier specs
│   └── pro/                  # Pro-only specs
├── playwright/.auth/         # Saved storage state (gitignored)
├── playwright-report/        # HTML report output (gitignored)
└── test-results/             # Artifacts on failure (gitignored)
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Target Version

The suite targets **BetterLinks 3.x (free) + BetterLinks Pro 3.x**.

BetterLinks 3.0 rebuilt the entire admin UI: the old `btl-*` markup was replaced
by a `bl-*` / `blb-*` BEM system, links moved to a board/list layout, the link
form became a drawer, Settings swapped react-tabs for a sidebar shell, Analytics
became one page of seven sections, and Promo Cards, Bio Links, Feature Modules
and the three-section Link Scanner arrived. Selectors here do **not** match 2.x
builds. Two REST shapes also changed and are handled in `helpers/api.js`:

| Endpoint | 2.x | 3.x |
|---|---|---|
| `GET betterlinks/v1/terms` | `{ data: { category: [], tag: [] } }` | flat `{ data: [ { ID, term_name, term_type } ] }` |
| `GET betterlinks/v1/settings` | object | JSON **string** in `data` |

## Test Coverage

### Free (`tests/free/`)

| Spec | What it covers |
|---|---|
| `link-crud.spec.js` | Create / edit / delete / duplicate / validate / REST-to-UI parity |
| `link-options.spec.js` | nofollow, sponsored, parameter forwarding, tracking toggles |
| `redirects.spec.js` | 301 / 302 / 307 / cloaked / parameter-forwarding |
| `settings.spec.js` | **Sidebar shell**, section deep-links (`?tab=`), `.bl-toggle` defaults + REST persistence |
| `feature-modules.spec.js` | **New in 3.x** — module grid, per-module config screens, toggle persistence |
| `categories-tags.spec.js` | Tag/Category tabs, `.bl-term-modal` CRUD, rename, Uncategorized protection |
| `terms-extended.spec.js` | Deeper CRUD, duplicate handling, search, appear-in-drawer |
| `analytics.spec.js` | **Seven sections**, range presets, hero chart, click log, single-link navigation |
| `analytics-extended.spec.js` | Single-link view: identity card, stat strip, geo/sources/tech/timing, click-log columns |
| `analytics-filter.spec.js` | Range presets, calendar popover, filter menu, reset, search, rows-per-page |
| `import-export.spec.js` | **Settings → Import & Export** — export links/analytics/sample CSV + import round-trip |
| `link-views.spec.js` | **Board / List / Compact**, card anatomy, list table headers, overview cards |
| `favorite.spec.js` | Favorite/unfavorite toggle + favourites filter |
| `search-filter.spec.js` | Manage-Links search & filters, Analytics search, Terms search |
| `short-url-validation.spec.js` | Duplicate slug (inline error), empty URL, special chars, long slug |
| `gutenberg-instant-redirect.spec.js` | **New** — Instant Redirect panel in the post/page editor, end-to-end redirect |
| `admin-navigation.spec.js` | Every 3.x admin page loads (incl. Promo Cards, Bio Links, MCP), submenu resolves |

### Pro (`tests/pro/`)

| Spec | What it covers |
|---|---|
| `promo-cards.spec.js` | **New in 3.0** — list/tabs, three-column editor, sections, live preview, save + REST |
| `bio-links.spec.js` | **New in 3.0** — builder sections, phone preview, slug, draft/publish, frontend page |
| `license.spec.js` | **New spec** — License panel, status/action coherence, masked key (read-only) |
| `link-scanner-sections.spec.js` | **New spec** — the three scanner sections and switching between them |
| `auto-link-keywords.spec.js` | Keywords page, stat cards, chips drawer, add/search/filter, import/export, REST |
| `autolink-frontend.spec.js` | **End-to-end**: keyword → published post → frontend replacement |
| `broken-link-checker.spec.js` | Health score, scan start, status filters, clear-logs confirmation |
| `custom-meta-tags.spec.js` | Customize Link Preview module, OG fields, cloaked page head |
| `dynamic-redirects.spec.js` | Dynamic Redirect panel + switch, split-test rule over REST, split-test report |
| `link-expiration.spec.js` | Advanced panel: status, date/click expiry, expiry redirect, expired behaviour |
| `password-protection.spec.js` | Password Protection module + config, per-link password, front-end password form |
| `role-management.spec.js` | Capability matrix, role columns, filters, toggle + save persistence |
| `utm-templates.spec.js` | UTM builder fields, apply-to-target, applied/not-applied state, templates over REST |

### Run status (2026-09-20, live site, BetterLinks 3.1.3 / Pro 3.0.3)

Full suite — 274 tests, ~48 minutes, single worker:

| Result | Count |
|---|---|
| passed | 266 |
| failed | 2 (both deliberate — see below) |
| skipped | 6 |

The full run itself reported 264/4/6; the two extra failures were stale
expectations in the suite and were fixed and re-verified straight after.
The two remaining failures are deliberate: they flag the live defects listed
below rather than being worked around. Skips fire when a feature module is
switched off (Password Protection, Customize Link Preview) instead of
asserting nothing.

### Known environment caveats

- **Click analytics do not accumulate on the current test site.** Visiting a
  tracked short link redirects correctly but records no click, so the suite
  asserts that analytics *surfaces* render and respond rather than asserting
  click counts. Worth investigating separately (page cache in front of the
  redirect is the usual cause).
- `GET betterlinks/v1/clicks/individual/{id}` currently returns a **500** on
  Pro 3.0.3 (`Helper::sanitize_date()` called statically). The single-link REST
  test asserts a 200, so it fails until that is fixed — deliberately.

## Live-Site Safety

Because this suite is designed to run against a **live** WordPress site, it takes a few deliberate precautions:

1. **Prefixed test data.** Every link slug, category, tag, and keyword uses a documented prefix (`test-`, `crud-`, `country-`, `kwlink-`, …). A sweep helper deletes only items matching those prefixes.
2. **Global pre-run and post-run sweeps.** `helpers/global-setup.js` clears leftovers before the suite starts; `helpers/global-teardown.js` runs even when tests fail, so nothing lingers.
3. **Single worker + `fullyParallel: false`.** Prevents concurrent writes from stomping each other or creating duplicate slugs.
4. **REST via the logged-in nonce.** No application passwords are stored; auth is a WP cookie session captured by `auth.setup.js`.
5. **PHP-warning tolerance.** The REST helper strips PHP notices prepended to JSON responses so transient warnings don't abort runs.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Error Handling & Resilience

Patterns borrowed (and adapted) from the sibling [notificationx-e2e](https://github.com/ShahrearMSf/notificationx-e2e) suite:

| Scenario | How it's handled |
|---|---|
| "Error establishing a database connection" | `safeGoto()` detects the error, waits 2 min, retries once |
| WP "Administration email verification" interstitial | `handleEmailVerification()` clicks "The email is correct" and proceeds |
| Bot-protection false positives on login | `auth.setup.js` retries with backoff (15s, 45s) before failing |
| Slow live-site network | Extended timeouts: 120 s per test, 60 s nav, 30 s action |
| BetterLinks DELETE 200-with-no-op | REST wrapper includes `{ ID }` in the request body as required |
| Flaky React re-renders on confirm dialogs | `force: true` + re-query fallback on the second attempt |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## CI / GitHub Actions

A workflow ships at `.github/workflows/playwright.yml` that:

- Runs on a **Mon & Wed 04:00 Bangladesh Time** schedule (`0 22 * * 0,2` UTC)
- Supports **manual dispatch** from the Actions tab
- Uploads the HTML report as a build artifact **and** publishes it to GitHub Pages
- Posts a summary card to **Slack** (pass / fail / flaky / skipped counts + report link)

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Purpose |
|---|---|
| `BASE_URL` | Live WP site to run against |
| `ADMIN_USER` | Admin user / email |
| `ADMIN_PASS` | Admin password |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook for run summaries |

Enable GitHub Pages under Settings → Pages (source: "GitHub Actions") so the report URL works.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Configuration Reference

- `playwright.config.js` — workers=1, fullyParallel=false, timeout=120 s, nav=60 s, action=30 s, html+list reporter, global setup/teardown hooked in.
- Projects:
  - `auth-setup` — runs `tests/auth.setup.js`, saves `playwright/.auth/admin.json`.
  - `free` — depends on `auth-setup`, scoped to `tests/free/`.
  - `pro` — depends on `auth-setup`, scoped to `tests/pro/`.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [x] Port auth/error-handling patterns from notificationx-e2e
- [x] Add country / device / browser / OS analytics coverage
- [x] Add list-view / DnD view coverage
- [x] Add admin-navigation sanity sweep
- [x] Verify auto-link keywords on the rendered frontend
- [x] Live-site cleanup sweep (pre + post)
- [x] Ported the suite from the 2.x UI to the 3.x redesign
- [x] Promo Cards, Bio Links, Feature Modules, License and Instant Redirect coverage
- [ ] Multi-role testing (editor / author / subscriber access)
- [ ] CI pipeline (GitHub Actions) with nightly smoke
- [ ] Cross-browser (Firefox / WebKit)
- [ ] Visual regression snapshots

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Muammar Shahrear — [@Muammar Shahrear](https://www.linkedin.com/in/muammarshahrear/) — shahrearmuammar@gmail.com

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## About the Author

**Muammar Shahrear** is a software tester and researcher specializing in test automation, AI agents, WordPress plugin testing, and SaaS product quality assurance. He completed his B.Sc. and M.Sc. from the Institute of Information Technology (IIT), Jahangirnagar University (JU), Bangladesh, and also holds an M.Sc. from Technische Hochschule Mittelhessen (THM), Germany.

- [![LinkedIn][LinkedIn-shield]][LinkedIn-url]
- [![Google Scholar][Scholar-shield]][Scholar-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments

* [Playwright](https://playwright.dev)
* [BetterLinks](https://betterlinks.io)
* [notificationx-e2e](https://github.com/ShahrearMSf/notificationx-e2e) — error-handling patterns
* [othneildrew/Best-README-Template](https://github.com/othneildrew/Best-README-Template)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[LinkedIn-shield]: https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white
[LinkedIn-url]: https://www.linkedin.com/in/muammarshahrear/
[Scholar-shield]: https://img.shields.io/badge/Google_Scholar-4285F4?style=for-the-badge&logo=googlescholar&logoColor=white
[Scholar-url]: https://scholar.google.com/citations?user=nPKujs4AAAAJ

<a id="readme-top"></a>

<br />
<div align="center">
  <a href="https://betterlinks.io">
    <img src="https://betterlinks.io/wp-content/uploads/2022/03/Betterlinks-site-icon.svg" alt="BetterLinks" width="80" height="80">
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
│   ├── selectors.js          # Centralised selector map
│   └── utils.js              # safeGoto, handleEmailVerification, toasts, slug helpers
├── pages/                    # Page objects
│   ├── ManageLinksPage.js
│   ├── SettingsPage.js
│   ├── AnalyticsPage.js
│   ├── CategoriesTagsPage.js
│   ├── KeywordsPage.js
│   └── LinkScannerPage.js
├── tests/
│   ├── auth.setup.js         # Login & storageState (with transient-failure retry)
│   ├── free/                 # Free-tier specs
│   └── pro/                  # Pro-only specs
├── playwright/.auth/         # Saved storage state (gitignored)
├── playwright-report/        # HTML report output (gitignored)
└── test-results/             # Artifacts on failure (gitignored)
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Test Coverage

### Free (`tests/free/`)

| Spec | What it covers |
|---|---|
| `link-crud.spec.js` | Create / edit / delete / duplicate / validate / REST-to-UI parity |
| `link-options.spec.js` | nofollow, sponsored, parameter forwarding, tracking toggles |
| `redirects.spec.js` | 301 / 302 / 307 / cloaked / parameter-forwarding |
| `settings.spec.js` | Tabs, persistence, default flag toggles |
| `categories-tags.spec.js` | Baseline CRUD + Uncategorized protection |
| `terms-extended.spec.js` | Deeper CRUD, duplicate-name handling, appear-in-dropdown |
| `analytics.spec.js` | Overview, chart/table, click generation, date range, no-data |
| `analytics-extended.spec.js` | **Country column**, top-charts (Referer / Social Media / Devices / OS / Browser / Medium), reset, refresh, pagination, bulk actions |
| `analytics-filter.spec.js` | Filter toolbar, calendar/date range, REST endpoint, table search |
| `import-export.spec.js` | Export links / analytics / sample CSV + round-trip |
| `link-views.spec.js` | **List view ↔ grid/DnD toggle**, drag handle attrs, favorite filter, category filter |
| `favorite.spec.js` | Favorite/unfavorite toggle on link cards |
| `search-filter.spec.js` | Manage-Links filter controls, Analytics search, Terms search |
| `short-url-validation.spec.js` | Duplicate slug, empty URL, special chars, long slug |
| `admin-navigation.spec.js` | Every BetterLinks admin page loads (no 404 / fatal PHP), WP dashboard unaffected, submenu hrefs resolve |

### Pro (`tests/pro/`)

| Spec | What it covers |
|---|---|
| `auto-link-keywords.spec.js` | Keywords admin page, list, add, delete, import/export |
| `autolink-frontend.spec.js` | **End-to-end**: create keyword → publish WP post → verify frontend replacement |
| `broken-link-checker.spec.js` | Scan start, results, filters, instant check, clear logs |
| `custom-meta-tags.spec.js` | OG title/desc, Twitter card, image upload, rendered HTML |
| `dynamic-redirects.spec.js` | Split-test variants, rotation types, geolocation placeholder |
| `link-expiration.spec.js` | Date-based / click-based / scheduled / expired-fallback |
| `password-protection.spec.js` | Toggle, set password, wrong password, correct password |
| `role-management.spec.js` | Permissions matrix, role columns, save, role-specific scenarios |
| `utm-templates.spec.js` | UTM builder, fields, save template, apply template, REST list |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

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
- [ ] Multi-role testing (editor / author / subscriber access)
- [ ] CI pipeline (GitHub Actions) with nightly smoke
- [ ] Cross-browser (Firefox / WebKit)
- [ ] Visual regression snapshots

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

Muammar Shahrear — <shahrearmuammar@gmail.com>
LinkedIn: <https://www.linkedin.com/in/muammarshahrear/>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments

* [Playwright](https://playwright.dev)
* [BetterLinks](https://betterlinks.io)
* [notificationx-e2e](https://github.com/ShahrearMSf/notificationx-e2e) — error-handling patterns

<p align="right">(<a href="#readme-top">back to top</a>)</p>

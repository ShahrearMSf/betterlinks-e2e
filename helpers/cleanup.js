/**
 * Live-site cleanup helper. Used by global setup/teardown to sweep up
 * any BetterLinks data created by tests (identified by slug/name prefix).
 *
 * IMPORTANT: Only deletes objects whose slug/name starts with TEST_PREFIXES.
 * Never touches user-created data.
 */
const { chromium } = require('@playwright/test');
require('dotenv').config();

// Every test-created slug begins with one of these (see helpers/utils.js uniqueSlug + spec prefixes).
const TEST_LINK_SLUG_PREFIXES = [
  'test-', 'crud-', 'note-', 'edit-', 'delete-', 'dup-', 'api-',
  'nofollow-', 'sponsored-', 'paramfwd-', 'notrack-', 'toggle-nf-', 'multi-opt-', 'nf-cloak-',
  'r301-', 'r302-', 'r307-', 'cloak-', 'track-', 'params-',
  'analytics-', 'single-analytics-', 'no-clicks-', 'export1-', 'export2-',
  'keyword-link-', 'broken-', 'instant-check-', 'meta-', 'og-verify-',
  'expire-date-', 'expire-clicks-', 'expire-redirect-', 'schedule-',
  'password-', 'pw-form-', 'split-', 'geo-', 'utm-', 'tmpl-', 'utm-apply-',
  'country-', 'device-', 'referrer-', 'bulk-', 'favorite-', 'search-',
  'view-', 'kwlink-', 'kwlist-', 'probe-', 'empty-', 'long-',
];

// Category / tag test name prefixes
const TEST_TERM_NAME_PREFIXES = ['TestCat', 'APICat', 'testtag', 'deltag', 'E2ECat', 'E2ETag'];

// Keyword prefixes (for pro keywords feature)
const TEST_KEYWORD_PREFIXES = ['testkw', 'e2ekw'];

function isTestSlug(slug) {
  if (!slug || typeof slug !== 'string') return false;
  return TEST_LINK_SLUG_PREFIXES.some(p => slug.startsWith(p));
}

function isTestTermName(name) {
  if (!name || typeof name !== 'string') return false;
  return TEST_TERM_NAME_PREFIXES.some(p => name.startsWith(p));
}

function isTestKeyword(kw) {
  if (!kw || typeof kw !== 'string') return false;
  return TEST_KEYWORD_PREFIXES.some(p => kw.startsWith(p));
}

/** Walk the nested { catId: { lists: [links] } } response into a flat array */
function flattenLinks(resp) {
  const data = resp?.data?.data;
  if (!data || typeof data !== 'object') return [];
  const out = [];
  for (const catId of Object.keys(data)) {
    const lists = data[catId]?.lists || [];
    for (const l of lists) out.push(l);
  }
  return out;
}

async function restFetch(page, method, endpoint, body = null) {
  const nonce = await page.evaluate(() => {
    if (window.betterLinksGlobal) return window.betterLinksGlobal.nonce;
    if (window.wpApiSettings) return window.wpApiSettings.nonce;
    return null;
  });
  return page.evaluate(
    async ({ method, endpoint, body, nonce, baseURL }) => {
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${baseURL}/wp-json/${endpoint}`, opts);
      const text = await res.text();
      let data = null;
      // Strip any PHP warnings/notices before the JSON payload
      const jsonStart = text.search(/[\[{]/);
      const candidate = jsonStart >= 0 ? text.slice(jsonStart) : text;
      try { data = JSON.parse(candidate); } catch (e) { /* ignore */ }
      return { status: res.status, data };
    },
    { method, endpoint, body, nonce, baseURL: process.env.BASE_URL }
  );
}

async function sweep({ verbose = true } = {}) {
  const storageStatePath = 'playwright/.auth/admin.json';
  const fs = require('fs');
  if (!fs.existsSync(storageStatePath)) {
    if (verbose) console.log('[cleanup] no storage state yet, skipping sweep');
    return { links: 0, terms: 0, keywords: 0 };
  }

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: storageStatePath, ignoreHTTPSErrors: true });
  const page = await ctx.newPage();

  try {
    await page.goto(`${process.env.BASE_URL}/wp-admin/admin.php?page=betterlinks`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#betterlinksbody', { state: 'attached', timeout: 30000 });
    await page.waitForTimeout(1500);

    let linksDeleted = 0;
    let termsDeleted = 0;
    let keywordsDeleted = 0;

    // --- Links ---
    const linksRes = await restFetch(page, 'GET', 'betterlinks/v1/links/');
    const links = flattenLinks(linksRes);
    const testLinks = links.filter(l => isTestSlug(l.short_url));
    if (verbose) console.log(`[cleanup] links: ${links.length} total, ${testLinks.length} match test prefix`);
    for (const l of testLinks) {
      const id = l.ID || l.id;
      if (!id) continue;
      // DELETE requires the ID in the JSON body for BetterLinks REST
      const res = await restFetch(page, 'DELETE', `betterlinks/v1/links/${id}?force=true`, { ID: id, force: true });
      if (res.status < 300) linksDeleted++;
    }

    // --- Terms ---
    const termsRes = await restFetch(page, 'GET', 'betterlinks/v1/terms/');
    const termData = termsRes?.data?.data || {};
    const cats = termData.category || termData.cat || [];
    const tags = termData.tag || [];
    const testCats = (Array.isArray(cats) ? cats : []).filter(t => isTestTermName(t.term_name || t.name));
    const testTags = (Array.isArray(tags) ? tags : []).filter(t => isTestTermName(t.term_name || t.name));
    if (verbose) console.log(`[cleanup] terms: ${testCats.length} cats, ${testTags.length} tags match test prefix`);
    for (const c of testCats) {
      const id = c.term_id || c.ID || c.id;
      if (!id) continue;
      await restFetch(page, 'DELETE', `betterlinks/v1/terms/?cat_id=${id}`);
      termsDeleted++;
    }
    for (const t of testTags) {
      const id = t.term_id || t.ID || t.id;
      if (!id) continue;
      await restFetch(page, 'DELETE', `betterlinks/v1/terms/?tag_id=${id}`);
      termsDeleted++;
    }

    // --- Keywords ---
    const kwRes = await restFetch(page, 'GET', 'betterlinks/v1/keywords');
    const kwList = kwRes?.data?.data || kwRes?.data || [];
    const testKws = (Array.isArray(kwList) ? kwList : []).filter(k => isTestKeyword(k.keyword));
    if (verbose) console.log(`[cleanup] keywords: ${testKws.length} match test prefix`);
    for (const k of testKws) {
      const id = k.link_id || k.id;
      if (!id) continue;
      const res = await restFetch(page, 'DELETE', `betterlinks/v1/keywords/${id}`, { ID: id });
      if (res.status < 300) keywordsDeleted++;
    }

    if (verbose) console.log(`[cleanup] deleted: ${linksDeleted} links, ${termsDeleted} terms, ${keywordsDeleted} keywords`);
    return { links: linksDeleted, terms: termsDeleted, keywords: keywordsDeleted };
  } catch (e) {
    console.error('[cleanup] error:', e.message);
    return { links: 0, terms: 0, keywords: 0, error: e.message };
  } finally {
    await browser.close();
  }
}

module.exports = { sweep, isTestSlug, isTestTermName, isTestKeyword, TEST_LINK_SLUG_PREFIXES, TEST_TERM_NAME_PREFIXES };

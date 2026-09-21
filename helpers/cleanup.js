/**
 * Live-site cleanup helper. Used by global setup/teardown to sweep up
 * any BetterLinks data created by tests (identified by slug/name prefix).
 *
 * IMPORTANT: Only deletes objects whose slug/name starts with TEST_PREFIXES.
 * Never touches user-created data.
 *
 * 3.x note: `GET betterlinks/v1/terms` returns a FLAT array of terms
 * (`[{ ID, term_name, term_type }]`) instead of 2.x's `{ category: [], tag: [] }`.
 * The old parser silently matched nothing, so test categories accumulated on the
 * live site — hence `flattenTerms()` below handling both shapes.
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
  'promo-', 'bio-', 'scanner-', 'gutenberg-', 'instant-redirect-', 'license-',
];

// Category / tag test name prefixes
const TEST_TERM_NAME_PREFIXES = ['TestCat', 'APICat', 'testtag', 'deltag', 'E2ECat', 'E2ETag'];

// Keyword prefixes (for the auto-link keywords feature)
const TEST_KEYWORD_PREFIXES = ['testkw', 'e2ekw'];

// Promo cards / bio links / posts created by the editor specs
const TEST_TITLE_PREFIXES = ['E2E Promo', 'E2E Bio', 'E2E Post', 'E2E Instant'];

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

function isTestTitle(title) {
  if (!title || typeof title !== 'string') return false;
  return TEST_TITLE_PREFIXES.some(p => title.startsWith(p));
}

/** Walk the nested { catId: { lists: [links] } } response into a flat array */
function flattenLinks(resp) {
  const data = resp?.data?.data;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const out = [];
  for (const catId of Object.keys(data)) {
    const lists = data[catId]?.lists || [];
    for (const l of lists) out.push(l);
  }
  return out;
}

/** 3.x: flat array. 2.x: { category: [], tag: [] }. Normalise to a flat array. */
function flattenTerms(resp) {
  const data = resp?.data?.data;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const out = [];
  for (const key of ['category', 'cat', 'tag']) {
    for (const t of data[key] || []) out.push({ term_type: key === 'cat' ? 'category' : key, ...t });
  }
  return out;
}

async function restFetch(page, method, endpoint, body = null) {
  const nonce = await page.evaluate(() => {
    if (window.betterLinksGlobal) return window.betterLinksGlobal.nonce;
    if (window.betterLinksProGlobal) return window.betterLinksProGlobal.nonce;
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
    return { links: 0, terms: 0, keywords: 0, promo: 0, bio: 0 };
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
    let promoDeleted = 0;
    let bioDeleted = 0;

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

    // --- Terms (flat array in 3.x) ---
    const termsRes = await restFetch(page, 'GET', 'betterlinks/v1/terms/');
    const terms = flattenTerms(termsRes);
    const testTerms = terms.filter(t => isTestTermName(t.term_name || t.name));
    if (verbose) console.log(`[cleanup] terms: ${terms.length} total, ${testTerms.length} match test prefix`);
    for (const t of testTerms) {
      const id = t.ID || t.term_id || t.id;
      if (!id) continue;
      const param = (t.term_type === 'tag') ? `tag_id=${id}` : `cat_id=${id}`;
      const res = await restFetch(page, 'DELETE', `betterlinks/v1/terms/?${param}`);
      if (res.status < 300) termsDeleted++;
    }

    // --- Keywords (rows arrive as JSON strings keyed `keywords`) ---
    const kwRes = await restFetch(page, 'GET', 'betterlinks/v1/keywords');
    const kwRaw = kwRes?.data?.data || kwRes?.data || [];
    const kwList = (Array.isArray(kwRaw) ? kwRaw : []).map(k => {
      if (typeof k !== 'string') return k;
      try { return JSON.parse(k); } catch (e) { return null; }
    }).filter(Boolean);
    const testKws = kwList.filter(k => isTestKeyword(k.keywords || k.keyword));
    if (verbose) console.log(`[cleanup] keywords: ${testKws.length} match test prefix`);
    for (const k of testKws) {
      const id = k.link_id || k.id;
      if (!id) continue;
      const res = await restFetch(page, 'DELETE', `betterlinks/v1/keywords/${id}`, { ID: id });
      if (res.status < 300) keywordsDeleted++;
    }

    // --- Pro: promo cards + card groups (3.x) ---
    for (const [endpoint, label] of [['product-displays', 'cards'], ['product-groups', 'groups']]) {
      const res = await restFetch(page, 'GET', `betterlinks-pro/v1/${endpoint}`);
      const list = res?.data?.data || res?.data || [];
      const mine = (Array.isArray(list) ? list : []).filter(c => isTestTitle(c.title || c.name || c.product_name));
      if (verbose && mine.length) console.log(`[cleanup] promo ${label}: ${mine.length} match test prefix`);
      for (const c of mine) {
        const id = c.ID || c.id;
        if (!id) continue;
        const d = await restFetch(page, 'DELETE', `betterlinks-pro/v1/${endpoint}/${id}`);
        if (d.status < 300) promoDeleted++;
      }
    }

    // --- Pro: bio links (3.x) ---
    const bioRes = await restFetch(page, 'GET', 'betterlinks-pro/v1/bio-pages');
    const bioList = bioRes?.data?.data || bioRes?.data || [];
    const testBios = (Array.isArray(bioList) ? bioList : []).filter(
      b => isTestTitle(b.title || b.name) || isTestSlug(b.slug)
    );
    if (verbose && testBios.length) console.log(`[cleanup] bio pages: ${testBios.length} match test prefix`);
    for (const b of testBios) {
      const id = b.ID || b.id;
      if (!id) continue;
      const d = await restFetch(page, 'DELETE', `betterlinks-pro/v1/bio-pages/${id}`);
      if (d.status < 300) bioDeleted++;
    }

    // --- WP posts created by the editor specs ---
    let postsDeleted = 0;
    const postsRes = await restFetch(page, 'GET', 'wp/v2/posts?per_page=50&search=E2E');
    const posts = Array.isArray(postsRes?.data) ? postsRes.data : [];
    for (const p of posts.filter(p => isTestTitle(p?.title?.rendered || ''))) {
      const d = await restFetch(page, 'DELETE', `wp/v2/posts/${p.id}?force=true`);
      if (d.status < 300) postsDeleted++;
    }

    if (verbose) {
      console.log(`[cleanup] deleted: ${linksDeleted} links, ${termsDeleted} terms, ${keywordsDeleted} keywords, ${promoDeleted} promo, ${bioDeleted} bio, ${postsDeleted} posts`);
    }
    return { links: linksDeleted, terms: termsDeleted, keywords: keywordsDeleted, promo: promoDeleted, bio: bioDeleted, posts: postsDeleted };
  } catch (e) {
    console.error('[cleanup] error:', e.message);
    return { links: 0, terms: 0, keywords: 0, error: e.message };
  } finally {
    await browser.close();
  }
}

module.exports = {
  sweep,
  isTestSlug,
  isTestTermName,
  isTestKeyword,
  isTestTitle,
  flattenLinks,
  flattenTerms,
  TEST_LINK_SLUG_PREFIXES,
  TEST_TERM_NAME_PREFIXES,
};

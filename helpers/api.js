/**
 * BetterLinks REST API helper for test data seeding and cleanup.
 * Uses the WP REST API with cookie-based auth (from Playwright's storageState).
 *
 * Targets BetterLinks 3.x / Pro 3.x. Response shapes differ from 2.x:
 *   - GET links  → { success, data: { <catId>: { term_name, lists: [...] } } }
 *   - GET terms  → { success, data: [ { ID, term_name, term_type } ] }   (flat in 3.x)
 *   - GET settings → { success, data: "<json string>" }
 */
class BetterLinksAPI {
  constructor(page) {
    this.page = page;
    this.baseURL = process.env.BASE_URL;
    this.nonce = null;
  }

  /** Fetch the REST nonce from the loaded admin page */
  async getNonce() {
    if (!this.nonce) {
      this.nonce = await this.page.evaluate(() => {
        if (window.betterLinksGlobal) return window.betterLinksGlobal.nonce;
        if (window.betterLinksProGlobal) return window.betterLinksProGlobal.nonce;
        if (window.wpApiSettings) return window.wpApiSettings.nonce;
        return null;
      });
    }
    return this.nonce;
  }

  /** Generic REST request via page.evaluate (uses browser cookies) */
  async request(method, endpoint, body = null) {
    const nonce = await this.getNonce();
    return this.page.evaluate(
      async ({ method, endpoint, body, nonce, baseURL }) => {
        const url = `${baseURL}/wp-json/${endpoint}`;
        const opts = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-WP-Nonce': nonce,
          },
        };
        if (body) opts.body = JSON.stringify(body);
        const res = await fetch(url, opts);
        const text = await res.text();
        // Strip any PHP warnings/notices that may be prepended to the JSON body
        const jsonStart = text.search(/[\[{]/);
        const candidate = jsonStart >= 0 ? text.slice(jsonStart) : text;
        let data = null;
        try { data = JSON.parse(candidate); } catch (e) { /* leave null */ }
        return { status: res.status, data };
      },
      { method, endpoint, body, nonce, baseURL: this.baseURL }
    );
  }

  // --- Links ---
  async createLink({
    title = 'Test Link',
    targetUrl = 'https://example.com',
    slug = null,
    redirectType = '307',
    catId = 1,
    nofollow = false,
    sponsored = false,
    trackMe = true,
    paramForwarding = false,
    extra = {},
  } = {}) {
    const short = slug || `test-${Date.now()}`;
    return this.request('POST', 'betterlinks/v1/links/', {
      params: {
        link_title: title,
        target_url: targetUrl,
        short_url: short,
        redirect_type: redirectType,
        cat_id: catId,
        nofollow,
        sponsored,
        track_me: trackMe,
        param_forwarding: paramForwarding,
        ...extra,
      },
    });
  }

  async getLinks() {
    return this.request('GET', 'betterlinks/v1/links/');
  }

  /**
   * Flatten the category-keyed links payload into a plain array.
   * Tolerates both the nested 3.x shape and a plain array.
   */
  async listLinks() {
    const res = await this.getLinks();
    return BetterLinksAPI.flattenLinks(res);
  }

  static flattenLinks(res) {
    const data = res?.data?.data;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    const out = [];
    for (const key of Object.keys(data)) {
      for (const l of data[key]?.lists || []) out.push(l);
    }
    return out;
  }

  async findLinkBySlug(slug) {
    const links = await this.listLinks();
    return links.find((l) => l.short_url === slug) || null;
  }

  async getLink(id) {
    return this.request('GET', `betterlinks/v1/links/${id}`);
  }

  async updateLink(id, params) {
    return this.request('PUT', `betterlinks/v1/links/${id}`, { params });
  }

  async deleteLink(id) {
    // BetterLinks REST delete requires the ID in the JSON body too (not just URL)
    return this.request('DELETE', `betterlinks/v1/links/${id}?force=true`, { ID: id, force: true });
  }

  async toggleFavorite(id, favorite = true) {
    return this.request('POST', `betterlinks/v1/links_favorite/${id}`, { ID: id, favorite: favorite ? 1 : 0 });
  }

  // --- Categories & Tags ---
  async createCategory(name, slug = null) {
    return this.request('POST', 'betterlinks/v1/terms/', {
      params: {
        term_name: name,
        term_slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        term_type: 'category',
      },
    });
  }

  async createTag(name, slug = null) {
    return this.request('POST', 'betterlinks/v1/terms/', {
      params: {
        term_name: name,
        term_slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        term_type: 'tag',
      },
    });
  }

  async getTerms() {
    return this.request('GET', 'betterlinks/v1/terms/');
  }

  /** 3.x returns a flat array of terms; split it by term_type. */
  async listTerms(type = null) {
    const res = await this.getTerms();
    const terms = BetterLinksAPI.flattenTerms(res);
    return type ? terms.filter((t) => t.term_type === type) : terms;
  }

  static flattenTerms(res) {
    const data = res?.data?.data;
    if (!data) return [];
    if (Array.isArray(data)) return data;
    // 2.x-style { category: [...], tag: [...] } fallback
    const out = [];
    for (const key of ['category', 'cat', 'tag']) {
      for (const t of data[key] || []) out.push({ term_type: key === 'cat' ? 'category' : key, ...t });
    }
    return out;
  }

  async getCategories() {
    return this.request('GET', 'betterlinks/v1/terms/categories');
  }

  async getTags() {
    return this.request('GET', 'betterlinks/v1/terms/tags');
  }

  async deleteTerm(id, type = 'category') {
    const param = type === 'category' ? `cat_id=${id}` : `tag_id=${id}`;
    return this.request('DELETE', `betterlinks/v1/terms/?${param}`);
  }

  // --- Settings ---
  async getSettings() {
    return this.request('GET', 'betterlinks/v1/settings/');
  }

  /** Settings arrive as a JSON string in `data`; parse it. */
  async readSettings() {
    const res = await this.getSettings();
    const raw = res?.data?.data;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch (e) { return {}; }
    }
    return raw || {};
  }

  async updateSettings(params) {
    return this.request('PUT', 'betterlinks/v1/settings/', params);
  }

  // --- Analytics ---
  async getAnalytics(from, to) {
    return this.request('GET', `betterlinks/v1/clicks/?from=${from}&to=${to}`);
  }

  async getIndividualAnalytics(id, from, to) {
    return this.request('GET', `betterlinks/v1/clicks/individual/${id}?from=${from}&to=${to}`);
  }

  async getCharts(from, to) {
    return this.request('GET', `betterlinks/v1/clicks/get_charts?from=${from}&to=${to}`);
  }

  async getGraphs(from, to) {
    return this.request('GET', `betterlinks/v1/clicks/get_graphs?from=${from}&to=${to}`);
  }

  async getCountries(from, to) {
    return this.request('GET', `betterlinks/v1/clicks/get_countries?from=${from}&to=${to}`);
  }

  async getAudience(from, to) {
    return this.request('GET', `betterlinks/v1/clicks/get_audience?from=${from}&to=${to}`);
  }

  async getTiming(from, to) {
    return this.request('GET', `betterlinks/v1/clicks/get_timing?from=${from}&to=${to}`);
  }

  async getMedium(from, to) {
    return this.request('GET', `betterlinks/v1/clicks/get_medium?from=${from}&to=${to}`);
  }

  async deleteAnalytics(linkIds) {
    return this.request('DELETE', `betterlinks/v1/clicks/delete_by_links/?link_ids=${linkIds}`);
  }

  // --- Keywords (Auto-Link) ---
  /**
   * The Pro endpoint expects `params.keywords` (plural) and resolves the link
   * from `params.chooseLink` — which accepts an ID, a slug or a full short URL.
   * Posting `link_id`/`keyword` is silently accepted and stores nothing
   * (`success: false`).
   */
  async createKeyword(linkId, keyword, extra = {}) {
    return this.request('POST', 'betterlinks/v1/keywords', {
      params: {
        keywords: keyword,
        chooseLink: String(linkId),
        keywordStatus: 'active',
        ...extra,
      },
    });
  }

  async getKeywords() {
    return this.request('GET', 'betterlinks/v1/keywords');
  }

  /** Rows come back as JSON *strings*, so parse each one before use. */
  async listKeywords() {
    const res = await this.getKeywords();
    const data = res?.data?.data ?? res?.data;
    if (!Array.isArray(data)) return [];
    return data
      .map((item) => {
        if (typeof item !== 'string') return item;
        try { return JSON.parse(item); } catch (e) { return null; }
      })
      .filter(Boolean);
  }

  /** Find a stored keyword row by its text (the column is `keywords`). */
  async findKeyword(text) {
    const rows = await this.listKeywords();
    return rows.find((k) => `${k.keywords || k.keyword || ''}`.includes(text)) || null;
  }

  async exportKeywords() {
    return this.request('GET', 'betterlinks/v1/keywords/export');
  }

  async deleteKeyword(linkId) {
    return this.request('DELETE', `betterlinks/v1/keywords/${linkId}`, { ID: linkId });
  }

  // --- Quick link (used by the editor integrations) ---
  async createQuickLink(params) {
    return this.request('POST', 'betterlinks/v1/quick-link', params);
  }

  /**
   * Call an admin-ajax action (several BetterLinks features — meta tags, the
   * analytics cron, module settings — are wired to admin-ajax rather than REST).
   * The handlers verify a `security` field holding the `betterlinks_admin_nonce`,
   * exposed to the app as `betterLinksGlobal.betterlinks_nonce`.
   */
  async ajax(action, fields = {}) {
    return this.page.evaluate(
      async ({ action, fields }) => {
        const body = new FormData();
        body.append('action', action);
        body.append('security', window.betterLinksGlobal?.betterlinks_nonce || '');
        for (const [key, value] of Object.entries(fields)) body.append(key, value);
        const res = await fetch(window.ajaxurl || window.betterLinksGlobal?.ajaxurl, { method: 'POST', body });
        const text = await res.text();
        let data = null;
        try { data = JSON.parse(text.slice(Math.max(0, text.search(/[\[{]/)))); } catch (e) { /* leave null */ }
        return { status: res.status, data };
      },
      { action, fields }
    );
  }

  // --- Pro: social / OG meta tags (admin-ajax backed) ---
  async setMetaTags(linkId, { title = '', description = '', image = '', status = true } = {}) {
    return this.ajax('betterlinkspro/admin/add_meta_tags', {
      link_id: linkId,
      meta_title: title,
      meta_description: description,
      meta_image: image,
      status: status ? 'true' : 'false',
    });
  }

  async getMetaTags() {
    return this.ajax('betterlinkspro/admin/fetch_meta_tags');
  }

  /** The fetch handler wraps the rows twice: `{ data: { data: [ … ] } }`. */
  async listMetaTags() {
    const res = await this.getMetaTags();
    const rows = res?.data?.data?.data ?? res?.data?.data ?? res?.data;
    return Array.isArray(rows) ? rows : [];
  }

  async findMetaTagsForLink(linkId) {
    const rows = await this.listMetaTags();
    return rows.find((r) => String(r.link_id) === String(linkId)) || null;
  }

  // --- Pro: UTM Templates ---
  async createUTMTemplate({ name, source, medium, campaign, term = '', content = '' }) {
    return this.request('POST', 'betterlinks-pro/v1/utm', {
      template_name: name,
      utm_source: source,
      utm_medium: medium,
      utm_campaign: campaign,
      utm_term: term,
      utm_content: content,
    });
  }

  async getUTMTemplates() {
    return this.request('GET', 'betterlinks-pro/v1/utm');
  }

  async deleteUTMTemplate(index) {
    return this.request('DELETE', `betterlinks-pro/v1/utm?template_index=${index}`);
  }

  // --- Pro: Promo Cards (Product Display) ---
  async getPromoCards() {
    return this.request('GET', 'betterlinks-pro/v1/product-displays');
  }

  async createPromoCard(payload) {
    return this.request('POST', 'betterlinks-pro/v1/product-displays', payload);
  }

  async deletePromoCard(id) {
    return this.request('DELETE', `betterlinks-pro/v1/product-displays/${id}`);
  }

  async getPromoGroups() {
    return this.request('GET', 'betterlinks-pro/v1/product-groups');
  }

  async deletePromoGroup(id) {
    return this.request('DELETE', `betterlinks-pro/v1/product-groups/${id}`);
  }

  // --- Pro: Bio Links ---
  async getBioPages() {
    return this.request('GET', 'betterlinks-pro/v1/bio-pages');
  }

  async createBioPage(payload) {
    return this.request('POST', 'betterlinks-pro/v1/bio-pages', payload);
  }

  async getBioPage(id) {
    return this.request('GET', `betterlinks-pro/v1/bio-pages/${id}`);
  }

  async deleteBioPage(id) {
    return this.request('DELETE', `betterlinks-pro/v1/bio-pages/${id}`);
  }

  async getBioTemplates() {
    return this.request('GET', 'betterlinks-pro/v1/bio-pages/templates');
  }

  async getBioAnalytics() {
    return this.request('GET', 'betterlinks-pro/v1/bio-pages/analytics');
  }
}

/** Unwrap `{ success, data }` responses to plain arrays where possible. */
function unwrap(res) {
  const data = res?.data?.data ?? res?.data;
  return data;
}

module.exports = { BetterLinksAPI, unwrap };

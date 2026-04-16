/**
 * BetterLinks REST API helper for test data seeding and cleanup.
 * Uses the WP REST API with cookie-based auth (from Playwright's storageState).
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
      },
    });
  }

  async getLinks() {
    return this.request('GET', 'betterlinks/v1/links/');
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

  async deleteTerm(id, type = 'category') {
    const param = type === 'category' ? `cat_id=${id}` : `tag_id=${id}`;
    return this.request('DELETE', `betterlinks/v1/terms/?${param}`);
  }

  // --- Settings ---
  async getSettings() {
    return this.request('GET', 'betterlinks/v1/settings/');
  }

  async updateSettings(params) {
    return this.request('PUT', 'betterlinks/v1/settings/', params);
  }

  // --- Analytics ---
  async getAnalytics(from, to) {
    return this.request('GET', `betterlinks/v1/clicks/?from=${from}&to=${to}`);
  }

  async deleteAnalytics(linkIds) {
    return this.request('DELETE', `betterlinks/v1/clicks/delete_by_links/?link_ids=${linkIds}`);
  }

  // --- Pro: Keywords (route lives under core betterlinks/v1 on current builds) ---
  async createKeyword(linkId, keyword) {
    return this.request('POST', 'betterlinks/v1/keywords', {
      params: { link_id: linkId, keyword },
    });
  }

  async getKeywords() {
    return this.request('GET', 'betterlinks/v1/keywords');
  }

  async deleteKeyword(linkId) {
    return this.request('DELETE', `betterlinks/v1/keywords/${linkId}`, { ID: linkId });
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
}

module.exports = { BetterLinksAPI };

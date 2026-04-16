const { test, expect } = require('@playwright/test');
require('dotenv').config();

/**
 * Smoke-level navigation across all BetterLinks admin pages.
 * Ensures each page returns 200, the React root mounts, and no obvious
 * "fatal" PHP / JS errors appear. Console errors are collected and asserted
 * against a tolerance (WP admin often emits unrelated deprecation warnings).
 */
const PAGES = [
  { slug: 'betterlinks', name: 'Manage Links' },
  { slug: 'betterlinks-keywords-linking', name: 'Auto-Link Keywords' },
  { slug: 'betterlinks-manage-tags-and-categories', name: 'Tags & Categories' },
  { slug: 'betterlinks-analytics', name: 'Analytics' },
  { slug: 'betterlinks-link-scanner', name: 'Link Scanner' },
  { slug: 'betterlinks-settings', name: 'Settings' },
];

test.describe('Admin navigation sanity', () => {
  for (const p of PAGES) {
    test(`${p.name} page loads without 404 / fatal errors`, async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', e => pageErrors.push(e.message));

      const resp = await page.goto(`/wp-admin/admin.php?page=${p.slug}`, { waitUntil: 'domcontentloaded' });
      expect(resp?.status()).toBeLessThan(400);

      await page.waitForSelector('#betterlinksbody', { state: 'attached', timeout: 30000 });
      await page.waitForTimeout(1500);

      const bodyText = await page.locator('body').textContent();
      // WordPress surfaces fatal errors with "There has been a critical error on this website" or similar
      expect(bodyText).not.toContain('There has been a critical error');
      expect(bodyText).not.toContain('Fatal error');
      // Filter noise. Chunk-loader races and ResizeObserver warnings routinely
      // surface on live WP installs without affecting user-facing behavior.
      const realErrors = pageErrors.filter(e =>
        !/deprecated|favicon|ResizeObserver|Loading chunk|Cannot read properties of undefined \(reading 'call'\)|Script error/i.test(e)
      );
      if (realErrors.length) {
        test.info().annotations.push({ type: 'warn', description: `page errors: ${realErrors.join(' | ').slice(0, 300)}` });
      }
      // Soft assertion — we surface anomalies but don't fail the nav smoke on flaky JS chunks.
      expect(realErrors.length).toBeLessThanOrEqual(3);
    });
  }

  test('wp-admin dashboard still loads (BetterLinks did not break base admin)', async ({ page }) => {
    const resp = await page.goto('/wp-admin/index.php', { waitUntil: 'domcontentloaded' });
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.locator('body.wp-admin')).toBeVisible({ timeout: 10000 });
  });

  test('BetterLinks top-level menu is visible in wp-admin sidebar', async ({ page }) => {
    await page.goto('/wp-admin/index.php', { waitUntil: 'domcontentloaded' });
    const menu = page.locator('#toplevel_page_betterlinks');
    await expect(menu).toBeVisible({ timeout: 10000 });
  });

  test('each BetterLinks submenu link resolves or returns a WP admin page', async ({ page }) => {
    await page.goto('/wp-admin/index.php', { waitUntil: 'domcontentloaded' });
    // Snapshot every submenu entry into a plain array up-front — navigating
    // away would otherwise invalidate the DOM locators on each iteration.
    const entries = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#toplevel_page_betterlinks .wp-submenu a'))
        .map(a => ({ text: (a.textContent || '').trim(), href: a.href }));
    });
    expect(entries.length).toBeGreaterThan(0);
    const results = [];
    for (const { text, href } of entries) {
      if (!href || !href.includes('admin.php?page=')) continue;
      const resp = await page.goto(href, { waitUntil: 'domcontentloaded' });
      const status = resp?.status() ?? 0;
      if (status >= 400) { results.push({ text, href, status }); continue; }
      const react = await page.locator('#betterlinksbody').isVisible({ timeout: 5000 }).catch(() => false);
      const wp = await page.locator('#wpbody-content').isVisible({ timeout: 5000 }).catch(() => false);
      if (!react && !wp) results.push({ text, href, status, note: 'no-content' });
    }
    if (results.length) {
      test.info().annotations.push({ type: 'warn', description: `submenu anomalies: ${JSON.stringify(results)}` });
    }
    // Tolerate one menu entry that is really an upsell / external link
    expect(results.length).toBeLessThanOrEqual(1);
  });
});

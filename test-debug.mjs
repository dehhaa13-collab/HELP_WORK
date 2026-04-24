import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Track CSS files loaded
  const cssFiles = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('.css') || (response.headers()['content-type'] || '').includes('text/css')) {
      cssFiles.push(url);
    }
  });

  console.log('→ Opening site...');
  await page.goto('https://help-work-kappa.vercel.app', { waitUntil: 'networkidle' });

  // Login
  await page.fill('input[type="text"], input#login-username, input[autocomplete="username"]', 'admin');
  await page.fill('input[type="password"]', '12345');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Click first client
  const clientCard = page.locator('.client-card, .client-grid > div').first();
  if (await clientCard.count() > 0) {
    await clientCard.click();
    await page.waitForTimeout(2000);

    // Check if sidebar-client-avatar even exists in DOM
    const avatarExists = await page.locator('.sidebar-client-avatar').count();
    console.log(`\n🔍 Avatar element exists: ${avatarExists > 0}`);

    if (avatarExists > 0) {
      // Get full HTML of the avatar
      const avatarHTML = await page.locator('.sidebar-client-avatar').evaluate(el => el.outerHTML);
      console.log(`Avatar HTML: ${avatarHTML}`);

      // Get ALL styles applied (check if there's a conflicting rule)
      const allStyles = await page.locator('.sidebar-client-avatar').evaluate(el => {
        const cs = window.getComputedStyle(el);
        return {
          width: cs.width,
          height: cs.height,
          borderRadius: cs.borderRadius,
          background: cs.background,
          display: cs.display,
          color: cs.color,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          boxShadow: cs.boxShadow,
          margin: cs.margin,
        };
      });
      console.log('\n📐 All avatar styles:', JSON.stringify(allStyles, null, 2));

      // Check if there's a competing stylesheet
      const styleSheetCount = await page.evaluate(() => document.styleSheets.length);
      console.log(`\n📄 Total stylesheets: ${styleSheetCount}`);

      // Find which CSS rules apply to .sidebar-client-avatar
      const matchingRules = await page.evaluate(() => {
        const el = document.querySelector('.sidebar-client-avatar');
        if (!el) return 'Element not found';
        const rules = [];
        for (const sheet of document.styleSheets) {
          try {
            for (const rule of sheet.cssRules) {
              if (rule.selectorText && rule.selectorText.includes('sidebar-client-avatar')) {
                rules.push({
                  selector: rule.selectorText,
                  cssText: rule.cssText.substring(0, 300),
                  source: sheet.href || 'inline',
                });
              }
            }
          } catch (e) {
            // cross-origin
          }
        }
        return rules;
      });
      console.log('\n🎯 CSS rules matching .sidebar-client-avatar:');
      console.log(JSON.stringify(matchingRules, null, 2));
    }
  }

  console.log('\n📦 CSS files loaded:', cssFiles);

  await browser.close();
})();

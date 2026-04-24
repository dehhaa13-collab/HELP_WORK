import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    bypassCSP: true,
  });
  const page = await context.newPage();

  // Force bypass cache
  await page.route('**/*', (route) => {
    route.continue({
      headers: {
        ...route.request().headers(),
        'cache-control': 'no-cache, no-store, must-revalidate',
        'pragma': 'no-cache',
      },
    });
  });

  // 1. Go to the site
  console.log('→ Opening site (cache-busted)...');
  await page.goto('https://help-work-kappa.vercel.app', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'screenshots/01-login-page.png', fullPage: false });
  console.log('✓ Login page loaded');

  // 2. Login
  console.log('→ Logging in as admin...');
  await page.fill('input[type="text"], input#login-username, input[autocomplete="username"]', 'admin');
  await page.fill('input[type="password"]', '12345');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/02-dashboard.png', fullPage: false });
  console.log('✓ Dashboard loaded');

  // 3. Click on first client card
  console.log('→ Clicking on first client...');
  const clientCard = page.locator('.client-card, .client-grid > div').first();
  if (await clientCard.count() > 0) {
    await clientCard.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'screenshots/03-client-workspace.png', fullPage: false });
    console.log('✓ Client workspace opened');

    // 4. Screenshot just the sidebar area
    const sidebar = page.locator('.workspace-sidebar');
    if (await sidebar.count() > 0) {
      await sidebar.screenshot({ path: 'screenshots/04-sidebar-close.png' });
      console.log('✓ Sidebar screenshot captured');

      // 5. Check computed styles of the avatar
      const avatarStyles = await page.locator('.sidebar-client-avatar').evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          width: cs.width,
          height: cs.height,
          borderRadius: cs.borderRadius,
          background: cs.background,
          backgroundColor: cs.backgroundColor,
          backgroundImage: cs.backgroundImage,
          display: cs.display,
          alignItems: cs.alignItems,
          justifyContent: cs.justifyContent,
          fontSize: cs.fontSize,
        };
      });
      console.log('\n📐 Avatar computed styles:');
      console.log(JSON.stringify(avatarStyles, null, 2));
    } else {
      console.log('⚠ Sidebar not found (may be mobile view)');
    }
  } else {
    console.log('⚠ No client cards found on dashboard');
  }

  await browser.close();
  console.log('\n✅ All done! Check screenshots/ folder.');
})();

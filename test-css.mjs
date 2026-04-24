import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const cssFiles = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('.css') && url.includes('assets/index')) {
      cssFiles.push(url);
    }
  });

  await page.goto('https://help-work-kappa.vercel.app', { waitUntil: 'networkidle' });

  if (cssFiles.length > 0) {
    console.log('CSS bundle:', cssFiles[0]);
    // Fetch the CSS content and check for avatar rule
    const cssContent = await page.evaluate(async (url) => {
      const resp = await fetch(url);
      return resp.text();
    }, cssFiles[0]);
    
    // Search for avatar-related rules
    const avatarMatch = cssContent.match(/sidebar-client-avatar[^}]+}/);
    console.log('Avatar CSS rule:', avatarMatch ? avatarMatch[0] : 'NOT FOUND');
    
    // Check if it has border-radius: 50%
    const hasCircle = cssContent.includes('border-radius:50%') || cssContent.includes('border-radius: 50%');
    console.log('Has circle (border-radius 50%):', hasCircle);
    
    const hasGradient = cssContent.includes('linear-gradient') && cssContent.includes('sidebar-client-avatar');
    console.log('Has gradient on avatar:', hasGradient);
  } else {
    console.log('No CSS bundle found');
  }

  await browser.close();
})();

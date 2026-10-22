const puppeteer = require('./browser-test/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    console.log('1. Navigating to login...');
    await page.goto('http://127.0.0.1:9000/login', { waitUntil: 'networkidle0' });

    console.log('2. Signing in as dev@lexorion.in...');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'dev@lexorion.in');
    await page.click('button[type="submit"]');

    await page.waitForSelector('input[type="password"]');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));

    console.log('3. Navigating to /app/admin/organization...');
    await page.goto('http://127.0.0.1:9000/app/admin/organization', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.admin-form-container');
    await page.waitForSelector('#org-website');
    await new Promise(r => setTimeout(r, 1000));

    // Capture desktop screenshot
    await page.screenshot({ path: 'scratch/org-profile-desktop-final.png', fullPage: true });
    console.log('Saved scratch/org-profile-desktop-final.png');

    // Resize to mobile
    await page.setViewport({ width: 420, height: 900 });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'scratch/org-profile-mobile-final.png', fullPage: true });
    console.log('Saved scratch/org-profile-mobile-final.png');

    console.log('DONE!');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

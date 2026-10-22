const puppeteer = require('./browser-test/node_modules/puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    console.log('1. Navigating to http://127.0.0.1:9000/login...');
    await page.goto('http://127.0.0.1:9000/login', { waitUntil: 'networkidle0' });

    console.log('2. Signing in as dev@lexorion.in...');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'dev@lexorion.in');
    await page.click('button[type="submit"]');

    await page.waitForSelector('input[type="password"]');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    console.log('3. Waiting for navigation after login...');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    console.log('Current URL:', page.url());

    // Evaluate what is on the page
    const pageInfo = await page.evaluate(() => {
      return {
        title: document.title,
        h1: document.querySelector('h1')?.textContent?.trim(),
        h2s: Array.from(document.querySelectorAll('h2')).map(el => el.textContent.trim()),
        headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(el => el.textContent.trim()),
        hasOnboardingTopBar: Boolean(document.querySelector('.onboarding-topbar')),
        hasContextSelector: Boolean(document.querySelector('.context-selector-group')),
        hasOldEmptyNotice: Boolean(document.querySelector('.notice')?.textContent?.includes('No active workspaces are available')),
        hasSetupWorkspaceButton: Boolean(document.querySelector('a, button')?.textContent?.includes('Set up a workspace')),
        bodyTextSnippet: document.body.innerText.slice(0, 500)
      };
    });

    console.log('Page Evaluation Result:', JSON.stringify(pageInfo, null, 2));

    await page.screenshot({ path: 'scratch/p0-lexorion-client-after-fix.png', fullPage: true });
    console.log('Screenshot saved to scratch/p0-lexorion-client-after-fix.png');

  } catch (err) {
    console.error('Error running test:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

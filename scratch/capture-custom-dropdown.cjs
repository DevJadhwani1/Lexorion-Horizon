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

    console.log('1. Signing in...');
    await page.goto('http://127.0.0.1:9000/login', { waitUntil: 'networkidle0' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'dev@lexorion.in');
    await page.click('button[type="submit"]');

    await page.waitForSelector('input[type="password"]');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));

    console.log('2. Navigating to /app/admin/members...');
    await page.goto('http://127.0.0.1:9000/app/admin/members', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.table-wrap');
    await new Promise(r => setTimeout(r, 1000));

    // Capture closed state
    await page.screenshot({ path: 'scratch/admin-members-custom-closed.png', fullPage: true });
    console.log('Saved scratch/admin-members-custom-closed.png');

    // Click Role trigger in table
    console.log('3. Opening custom Role dropdown in Members table...');
    const roleTrigger = await page.waitForSelector('.search-select-trigger');
    await roleTrigger.click();
    await page.waitForSelector('.search-select-portal-menu');
    await new Promise(r => setTimeout(r, 400));

    // Capture open state
    await page.screenshot({ path: 'scratch/admin-members-custom-open.png', fullPage: true });
    console.log('Saved scratch/admin-members-custom-open.png');

    // Navigating to invitations
    console.log('4. Navigating to /app/admin/invitations...');
    await page.goto('http://127.0.0.1:9000/app/admin/invitations', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.toolbar');
    const inviteRoleTrigger = await page.waitForSelector('#invitation-role-select');
    await inviteRoleTrigger.click();
    await page.waitForSelector('.search-select-portal-menu');
    await new Promise(r => setTimeout(r, 400));

    await page.screenshot({ path: 'scratch/admin-invitations-custom-open.png', fullPage: true });
    console.log('Saved scratch/admin-invitations-custom-open.png');

    console.log('ALL DONE!');
  } catch (err) {
    console.error('Error in capture:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

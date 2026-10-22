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

    console.log('1. Navigating to login...');
    await page.goto('http://127.0.0.1:9000', { waitUntil: 'networkidle0' });

    console.log('2. Logging in with devjadhwani8652@gmail.com...');
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'devjadhwani8652@gmail.com');
    await page.click('button[type="submit"]');
    await page.waitForSelector('input[type="password"]');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});

    console.log('3. Verifying Application Shell elements...');
    // Ensure we are in client mode
    await page.evaluate(() => {
      sessionStorage.setItem('lexorion.applicationMode', 'client');
    });
    await page.goto('http://127.0.0.1:9000/app', { waitUntil: 'networkidle0' });

    // Check App Switcher (Waffle button)
    const appSwitcherBtn = await page.waitForSelector('.app-switcher-trigger');
    console.log('App switcher trigger found. Clicking to open...');
    await appSwitcherBtn.click();
    await page.waitForSelector('.app-switcher-popover');
    const popoverHeading = await page.$eval('.app-switcher-heading', el => el.textContent);
    console.log('App switcher opened, heading:', popoverHeading);
    await appSwitcherBtn.click(); // close

    // Check Organization Dropdown & Select Test Org
    console.log('Checking organization selector dropdown...');
    const orgTrigger = await page.waitForSelector('.context-dropdown-container .context-dropdown-trigger');
    await orgTrigger.click();
    await page.waitForSelector('.context-popover');
    const orgItems = await page.$$eval('.context-popover-item', els => els.map(e => e.textContent.trim().replace(/\s+/g, ' ')));
    console.log(`Found ${orgItems.length} organizations in dropdown list:`, orgItems.slice(0, 3));
    
    console.log('Selecting Test Org from dropdown...');
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.context-popover-item'));
      const testOrg = items.find(i => i.textContent.includes('Test Org') || i.textContent.includes('test-org'));
      if (testOrg) (testOrg).click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Check Account Menu
    console.log('Checking account avatar menu...');
    const accountTrigger = await page.waitForSelector('.account-menu-trigger');
    await accountTrigger.click();
    await page.waitForSelector('.account-popover');
    const accountEmail = await page.$eval('.account-popover-user small', el => el.textContent);
    console.log('Account popover opened for:', accountEmail);
    await page.keyboard.press('Escape');

    // Check Admin Tab Navigation
    console.log('Navigating to Organization Admin...');
    await page.goto('http://127.0.0.1:9000/app/admin/organization', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.admin-tabs');
    const tabs = await page.$$eval('.admin-tab-link', els => els.map(e => ({
      text: e.textContent.trim(),
      active: e.classList.contains('active')
    })));
    console.log('Admin navigation tabs:', tabs);

    // Navigate to Workspaces via tab
    console.log('Navigating to Workspaces tab...');
    await page.goto('http://127.0.0.1:9000/app/admin/workspaces', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.admin-tabs');
    const wsTabActive = await page.$eval('.admin-tab-link.active', el => el.textContent.trim());
    console.log('Active tab is now:', wsTabActive);

    // Check Dashboard Quick Actions
    console.log('Navigating back to Overview...');
    await page.goto('http://127.0.0.1:9000/app', { waitUntil: 'networkidle0' });
    
    // Select Workspace from ContextSelector
    console.log('Opening workspace selector dropdown...');
    const wsTriggers = await page.$$('.context-dropdown-container .context-dropdown-trigger');
    if (wsTriggers.length >= 2) {
      await wsTriggers[1].click();
      await page.waitForSelector('.context-popover');
      const wsItems = await page.$$eval('.context-popover-item', els => els.map(e => e.textContent.trim().replace(/\s+/g, ' ')));
      console.log('Workspaces available in dropdown:', wsItems);
      await page.evaluate(() => {
        const item = document.querySelector('.context-popover-item');
        if (item) (item).click();
      });
      await new Promise(r => setTimeout(r, 2000));
    }

    const quickActions = await page.$$eval('.quick-action-chip', els => els.map(e => e.textContent.trim()));
    console.log(`Found ${quickActions.length} quick actions launchpad chips on Overview:`, quickActions);

    console.log('ALL CLIENT-SIDE PRODUCT EXPERIENCE VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

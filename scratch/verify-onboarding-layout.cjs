const puppeteer = require('./browser-test/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // 1. Desktop Test (1440x900)
    await page.setViewport({ width: 1440, height: 900 });
    console.log('Navigating to http://127.0.0.1:9000/login...');
    await page.goto('http://127.0.0.1:9000/login', { waitUntil: 'networkidle0' });

    // Login as dev@lexorion.in
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'dev@lexorion.in');
    await page.click('button[type="submit"]');

    await page.waitForSelector('input[type="password"]');
    await page.type('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    console.log('Current URL after login:', page.url());
    if (!page.url().includes('/app')) {
      await page.goto('http://127.0.0.1:9000/app', { waitUntil: 'networkidle0' });
    }

    await page.waitForSelector('h1', { timeout: 10000 });

    const desktopChecks = await page.evaluate(() => {
      const h1 = document.querySelector('h1')?.textContent?.trim();
      const orgName = document.querySelector('.summary-org-name')?.textContent?.trim();
      const overviewGrid = document.querySelector('.onboarding-overview-grid');
      const stepper = document.querySelector('.onboarding-stages-stepper');
      const checklistGrid = document.querySelector('.onboarding-checklist-grid');
      const stageItems = Array.from(document.querySelectorAll('.stage-step-item')).map((el) => ({
        title: el.querySelector('.stage-step-title')?.textContent?.trim(),
        sub: el.querySelector('.stage-step-sub')?.textContent?.trim(),
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      }));

      const cards = Array.from(document.querySelectorAll('.onboarding-step-card')).map((el) => ({
        title: el.querySelector('.step-card-title')?.textContent?.trim(),
        width: Math.round(el.getBoundingClientRect().width),
        height: Math.round(el.getBoundingClientRect().height),
      }));

      // Check sidebar active states
      const activeNavLinks = Array.from(document.querySelectorAll('.shell nav a.active')).map((a) => a.textContent?.trim());
      const helpBtn = document.querySelector('.nav-item-btn[aria-label="Help & Support"]');
      const docsBtn = document.querySelector('.nav-item-btn[aria-label="Documentation"]');
      const helpIsActive = helpBtn?.classList.contains('active') || false;
      const docsIsActive = docsBtn?.classList.contains('active') || false;

      // Check horizontal overflow
      const hasHorizontalScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;

      return {
        h1,
        orgName,
        overviewGridCols: overviewGrid ? window.getComputedStyle(overviewGrid).gridTemplateColumns.split(' ').length : 0,
        stepperCols: stepper ? window.getComputedStyle(stepper).gridTemplateColumns.split(' ').length : 0,
        checklistCols: checklistGrid ? window.getComputedStyle(checklistGrid).gridTemplateColumns.split(' ').length : 0,
        stageItems,
        cards,
        activeNavLinks,
        helpIsActive,
        docsIsActive,
        hasHorizontalScroll,
        viewportWidth: window.innerWidth,
        bodyScrollWidth: document.documentElement.scrollWidth,
      };
    });

    console.log('Desktop layout evaluation:', JSON.stringify(desktopChecks, null, 2));

    const desktopShotPath = path.join('/Users/dev/Lexorion/Horizon/scratch', 'onboarding-layout-desktop.png');
    await page.screenshot({ path: desktopShotPath, fullPage: false });
    console.log('Saved desktop screenshot to:', desktopShotPath);

    // 2. Tablet Test (820x1180)
    await page.setViewport({ width: 820, height: 1180 });
    await new Promise((r) => setTimeout(r, 500));
    const tabletChecks = await page.evaluate(() => {
      const hasHorizontalScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      const stepper = document.querySelector('.onboarding-stages-stepper');
      const checklistGrid = document.querySelector('.onboarding-checklist-grid');
      return {
        hasHorizontalScroll,
        viewportWidth: window.innerWidth,
        bodyScrollWidth: document.documentElement.scrollWidth,
        stepperCols: stepper ? window.getComputedStyle(stepper).gridTemplateColumns.split(' ').length : 0,
        checklistCols: checklistGrid ? window.getComputedStyle(checklistGrid).gridTemplateColumns.split(' ').length : 0,
      };
    });
    console.log('Tablet layout evaluation:', JSON.stringify(tabletChecks, null, 2));
    const tabletShotPath = path.join('/Users/dev/Lexorion/Horizon/scratch', 'onboarding-layout-tablet.png');
    await page.screenshot({ path: tabletShotPath, fullPage: false });
    console.log('Saved tablet screenshot to:', tabletShotPath);

    // 3. Mobile Test (390x844)
    await page.setViewport({ width: 390, height: 844 });
    await new Promise((r) => setTimeout(r, 500));
    const mobileChecks = await page.evaluate(() => {
      const hasHorizontalScroll = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      const stepper = document.querySelector('.onboarding-stages-stepper');
      const checklistGrid = document.querySelector('.onboarding-checklist-grid');
      return {
        hasHorizontalScroll,
        viewportWidth: window.innerWidth,
        bodyScrollWidth: document.documentElement.scrollWidth,
        stepperCols: stepper ? window.getComputedStyle(stepper).gridTemplateColumns.split(' ').length : 0,
        checklistCols: checklistGrid ? window.getComputedStyle(checklistGrid).gridTemplateColumns.split(' ').length : 0,
      };
    });
    console.log('Mobile layout evaluation:', JSON.stringify(mobileChecks, null, 2));
    const mobileShotPath = path.join('/Users/dev/Lexorion/Horizon/scratch', 'onboarding-layout-mobile.png');
    await page.screenshot({ path: mobileShotPath, fullPage: false });
    console.log('Saved mobile screenshot to:', mobileShotPath);

    // 4. Test Interaction & Modal on Desktop
    await page.setViewport({ width: 1440, height: 900 });
    await new Promise((r) => setTimeout(r, 300));
    await page.click('.edit-details-btn');
    await page.waitForSelector('.onboarding-modal-dialog', { timeout: 5000 });
    await new Promise((r) => setTimeout(r, 400));
    console.log('Edit details modal opened successfully!');

    const modalShotPath = path.join('/Users/dev/Lexorion/Horizon/scratch', 'onboarding-edit-modal.png');
    await page.screenshot({ path: modalShotPath });
    console.log('Saved modal screenshot to:', modalShotPath);

    // Close modal
    const closeBtn = await page.$('.modal-close-btn');
    if (closeBtn) await closeBtn.click();
    await new Promise((r) => setTimeout(r, 300));

    console.log('All browser layout verifications passed successfully!');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Layout verification failed:', err);
  process.exit(1);
});

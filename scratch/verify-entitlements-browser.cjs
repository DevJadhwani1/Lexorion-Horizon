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

    console.log('3. Waiting for navigation after login...');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    console.log('Current URL after login:', page.url());

    console.log('4. Navigating to Entitlements via sidebar link or in-app link...');
    // Look for link to Entitlements
    const clickedLink = await page.evaluate(() => {
      const link = Array.from(document.querySelectorAll('a')).find(a => 
        a.textContent.includes('Entitlements') || a.getAttribute('href')?.includes('/admin/entitlements')
      );
      if (link) {
        link.click();
        return true;
      }
      return false;
    });

    console.log('Clicked Entitlements link:', clickedLink);

    if (!clickedLink) {
      // Fallback: evaluate window navigation or direct link
      await page.goto('http://127.0.0.1:9000/app/admin/entitlements', { waitUntil: 'networkidle0' });
    }

    await new Promise(r => setTimeout(r, 2500));
    console.log('Current URL:', page.url());

    const result = await page.evaluate(() => {
      const pageTitle = document.querySelector('h1')?.textContent?.trim();
      const pageDesc = document.querySelector('.page-header p')?.textContent?.trim();
      const activeTab = document.querySelector('.admin-tab-link.active')?.textContent?.trim();

      const planTitle = document.querySelector('.product-access-plan-title')?.textContent?.trim();
      const planBadge = document.querySelector('.product-access-plan-header .badge')?.textContent?.trim();
      const metricChips = Array.from(document.querySelectorAll('.product-access-metric-chip')).map(el => el.textContent.trim().replace(/\s+/g, ' '));

      const sectionTitle = document.querySelector('.product-access-section-title')?.textContent?.trim();

      const cards = Array.from(document.querySelectorAll('.product-access-card')).map(card => {
        return {
          name: card.querySelector('.product-access-card-name')?.textContent?.trim(),
          badge: card.querySelector('.badge')?.textContent?.trim(),
          badgeClass: card.querySelector('.badge')?.className,
          description: card.querySelector('.product-access-card-desc')?.textContent?.trim(),
          limits: Array.from(card.querySelectorAll('.product-access-limit-badge')).map(l => l.textContent.trim().replace(/\s+/g, ' ')),
          unavailableNote: card.querySelector('.product-access-unavailable-note')?.textContent?.trim()
        };
      });

      const bodyText = document.body.innerText;
      const rawKeyMatches = [
        'payroll.enabled',
        'payroll.processing',
        'platform.employee_limit',
        'platform.workspace_limit',
        'workforce.enabled'
      ].filter(key => bodyText.includes(key));

      return {
        pageTitle,
        pageDesc,
        activeTab,
        planTitle,
        planBadge,
        metricChips,
        sectionTitle,
        cards,
        rawKeyMatches,
        bodySnippet: bodyText.slice(0, 700)
      };
    });

    console.log('Page Evaluation Result:\n', JSON.stringify(result, null, 2));

    await page.screenshot({ path: 'scratch/p0-product-access-page.png', fullPage: true });
    console.log('Screenshot saved to scratch/p0-product-access-page.png');

    if (result.rawKeyMatches.length > 0) {
      throw new Error('Raw keys found in page: ' + result.rawKeyMatches.join(', '));
    }

    if (result.cards.length < 2) {
      throw new Error('Expected at least 2 product cards, found: ' + result.cards.length);
    }

    console.log('All browser verifications passed!');
  } catch (err) {
    console.error('Error running browser test:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

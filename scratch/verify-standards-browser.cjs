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

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
    page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
    page.on('response', res => {
      if (res.status() >= 400) console.log('HTTP ERROR:', res.status(), res.url());
    });

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

    // Ensure client mode
    await page.evaluate(() => {
      sessionStorage.setItem('lexorion.applicationMode', 'client');
    });

    console.log('3. Navigating to /app/admin/organization...');
    await page.goto('http://127.0.0.1:9000/app/admin/organization', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.admin-form-container');

    // 3.1 Verify Website Input Standards
    console.log('3.1 Checking Website input standards...');
    const websiteField = await page.waitForSelector('#org-website');
    console.log('Website input field found.');

    // Test protocol rejection
    console.log('Testing invalid protocol rejection in WebsiteInput...');
    await page.evaluate(() => {
      const el = document.querySelector('#org-website');
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await websiteField.type('javascript:alert(1)');
    await page.click('input[name="legalName"]'); // blur
    await new Promise(r => setTimeout(r, 400));

    const websiteError = await page.$eval('#org-website-error', el => el.textContent.trim()).catch(() => null);
    console.log('Inline website error message:', websiteError);
    if (!websiteError || !websiteError.toLowerCase().includes('unsupported protocol')) {
      throw new Error(`Expected unsupported protocol error, got: ${websiteError}`);
    }

    // Now set valid website
    console.log('Entering valid website domain/path...');
    await page.evaluate(() => {
      const el = document.querySelector('#org-website');
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await websiteField.type('lexorion.com/about');
    await page.click('input[name="legalName"]'); // blur
    await new Promise(r => setTimeout(r, 400));
    const clearedError = await page.$eval('#org-website-error', el => el.textContent.trim()).catch(() => null);
    if (clearedError) throw new Error(`Expected website error to clear, but got: ${clearedError}`);

    // 3.2 Check Phone Input Standards
    console.log('3.2 Checking Phone input standards...');
    const phoneTrigger = await page.waitForSelector('#org-primary-phone-calling-code');
    const callingCodeLabel = await page.$eval('.phone-selected-code', el => el.textContent.trim());
    console.log('Current calling code:', callingCodeLabel);

    // Open calling code dropdown
    await phoneTrigger.click();
    await page.waitForSelector('.search-select-portal-menu');
    console.log('Calling code dropdown menu opened.');

    // Search for country or code in calling code picker
    const phoneSearch = await page.waitForSelector('.search-select-search-input');
    await phoneSearch.type('India');
    await new Promise(r => setTimeout(r, 200));

    // Select India (+91)
    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.search-select-option'));
      const inOption = items.find(el => el.textContent.includes('India') && el.textContent.includes('+91'));
      if (inOption) (inOption).click();
    });
    await new Promise(r => setTimeout(r, 300));

    // Type local phone digits
    const phoneDigitsInput = await page.$('#org-primary-phone-number');
    await page.evaluate(() => {
      const input = document.querySelector('#org-primary-phone-number');
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await phoneDigitsInput.type('9876543210');

    // 3.3 Check Industry taxonomy dropdown
    console.log('3.3 Checking Industry taxonomy dropdown...');
    const industryTrigger = await page.$('#org-industry');
    await industryTrigger.click();
    await page.waitForSelector('.search-select-portal-menu');

    // Search for Information technology
    const industrySearch = await page.waitForSelector('.search-select-search-input');
    await industrySearch.type('software');
    await new Promise(r => setTimeout(r, 200));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.search-select-option'));
      const itOpt = items.find(el => el.textContent.includes('Enterprise Software'));
      if (itOpt) (itOpt).click();
    });
    await new Promise(r => setTimeout(r, 300));

    // 3.4 Check Country selector
    console.log('3.4 Checking Organization Country dropdown...');
    const countryTrigger = await page.$('#org-address-country');
    await countryTrigger.click();
    await page.waitForSelector('.search-select-portal-menu');

    const countrySearch = await page.waitForSelector('.search-select-search-input');
    await countrySearch.type('India');
    await new Promise(r => setTimeout(r, 200));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.search-select-option'));
      const inOpt = items.find(el => el.textContent.includes('India (IN)'));
      if (inOpt) (inOpt).click();
    });
    await new Promise(r => setTimeout(r, 300));

    // Fill address details
    console.log('Filling in address details...');
    await page.evaluate(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      for (const name of ['stateProvince', 'city', 'postalCode']) {
        const el = document.querySelector(`input[name="${name}"]`);
        if (el) {
          setter.call(el, '');
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    });

    const stateInput = await page.$('input[name="stateProvince"]');
    await stateInput.type('Karnataka');

    const cityInput = await page.$('input[name="city"]');
    await cityInput.type('Bengaluru');

    const postalInput = await page.$('input[name="postalCode"]');
    await postalInput.type('560001');

    // Submit Organization Profile
    console.log('Checking form validity...');
    const formValidity = await page.evaluate(() => {
      const form = document.querySelector('.admin-form-container');
      const invalidFields = Array.from(form.querySelectorAll(':invalid')).map(el => ({
        name: el.name,
        id: el.id,
        type: el.type,
        value: el.value,
        validationMessage: el.validationMessage
      }));
      return {
        isValid: form.checkValidity(),
        invalidFields
      };
    });
    console.log('Form validity result:', JSON.stringify(formValidity, null, 2));

    console.log('Submitting organization profile changes...');
    await page.evaluate(() => {
      const form = document.querySelector('form.admin-form-container');
      form.requestSubmit();
    });

    // Verify success banner/notice
    const saveResultEl = await page.waitForSelector('.admin-form-save-status.is-success, .notice');
    const saveResultText = await page.evaluate(el => el.textContent.trim(), saveResultEl);
    console.log('Profile save notification:', saveResultText);
    if (!saveResultText.includes('successfully')) {
      throw new Error(`Expected success notification, got: ${saveResultText}`);
    }

    // Take screenshots of Organization Profile
    console.log('Capturing organization profile screenshots...');
    await page.screenshot({ path: 'scratch/org-profile-standards-desktop.png', fullPage: true });

    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await page.screenshot({ path: 'scratch/org-profile-standards-mobile.png', fullPage: true });
    await page.setViewport({ width: 1280, height: 900, isMobile: false });

    // 4. Reload page and verify persistence of Organization Profile
    console.log('4. Reloading /app/admin/organization to verify backend persistence...');
    await page.goto('http://127.0.0.1:9000/app/admin/organization', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.admin-form-container');

    const persistedWebsite = await page.$eval('#org-website', el => el.value);
    const persistedPhoneDigits = await page.$eval('#org-primary-phone-number', el => el.value);
    const persistedState = await page.$eval('input[name="stateProvince"]', el => el.value);
    const persistedCity = await page.$eval('input[name="city"]', el => el.value);
    const persistedPostal = await page.$eval('input[name="postalCode"]', el => el.value);

    console.log('Persisted Profile Values from Backend:');
    console.log('  Website input domain:', persistedWebsite);
    console.log('  Primary Phone digits:', persistedPhoneDigits);
    console.log('  State/Province:', persistedState);
    console.log('  City:', persistedCity);
    console.log('  Postal code:', persistedPostal);

    if (persistedWebsite !== 'lexorion.com/about') throw new Error(`Website mismatch: ${persistedWebsite}`);
    if (persistedPhoneDigits !== '9876543210') throw new Error(`Phone mismatch: ${persistedPhoneDigits}`);
    if (persistedCity !== 'Bengaluru') throw new Error(`City mismatch: ${persistedCity}`);

    // 5. Navigate to /app/admin/settings
    console.log('5. Navigating to /app/admin/settings...');
    await page.goto('http://127.0.0.1:9000/app/admin/settings', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.admin-form-container');

    // 5.1 Currency dropdown
    console.log('5.1 Testing Currency dropdown...');
    const currencyTrigger = await page.$('#settings-default-currency');
    await currencyTrigger.click();
    await page.waitForSelector('.search-select-portal-menu');

    const currencySearch = await page.waitForSelector('.search-select-search-input');
    await currencySearch.type('INR');
    await new Promise(r => setTimeout(r, 200));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.search-select-option'));
      const inrOpt = items.find(el => el.textContent.includes('Indian Rupee (INR ₹)'));
      if (inrOpt) (inrOpt).click();
    });
    await new Promise(r => setTimeout(r, 300));

    // 5.2 Time Zone dropdown
    console.log('5.2 Testing IANA Time Zone dropdown...');
    const tzTrigger = await page.$('#settings-timezone');
    await tzTrigger.click();
    await page.waitForSelector('.search-select-portal-menu');

    const tzSearch = await page.waitForSelector('.search-select-search-input');
    await tzSearch.type('Kolkata');
    await new Promise(r => setTimeout(r, 200));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.search-select-option'));
      const kolkataOpt = items.find(el => el.textContent.includes('Asia/Kolkata'));
      if (kolkataOpt) (kolkataOpt).click();
    });
    await new Promise(r => setTimeout(r, 300));

    // 5.3 Date Format dropdown
    console.log('5.3 Testing Date Format dropdown...');
    const dfTrigger = await page.$('#settings-date-format');
    await dfTrigger.click();
    await page.waitForSelector('.search-select-portal-menu');

    // Check that options show live examples
    const dfOptionsText = await page.$$eval('.search-select-option', els => els.map(e => e.textContent.trim()));
    console.log('Date format options found in dropdown:', dfOptionsText);

    const dfSearch = await page.waitForSelector('.search-select-search-input');
    await dfSearch.type('DD/MM/YYYY');
    await new Promise(r => setTimeout(r, 200));

    await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('.search-select-option'));
      const opt = items.find(el => el.textContent.includes('DD/MM/YYYY'));
      if (opt) (opt).click();
    });
    await new Promise(r => setTimeout(r, 300));

    // Submit Organization Settings
    console.log('Submitting organization settings changes...');
    await page.evaluate(() => {
      const form = document.querySelector('form.admin-form-container');
      form.requestSubmit();
    });

    // Verify success banner/notice
    const settingsResultEl = await page.waitForSelector('.admin-form-save-status.is-success, .notice');
    const settingsNotice = await page.evaluate(el => el.textContent.trim(), settingsResultEl);
    console.log('Settings save notification:', settingsNotice);
    if (!settingsNotice.includes('successfully')) {
      throw new Error(`Expected success notification, got: ${settingsNotice}`);
    }

    // Take screenshots of Organization Settings
    console.log('Capturing organization settings screenshots...');
    await page.screenshot({ path: 'scratch/org-settings-standards-desktop.png', fullPage: true });

    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await page.screenshot({ path: 'scratch/org-settings-standards-mobile.png', fullPage: true });
    await page.setViewport({ width: 1280, height: 900, isMobile: false });

    // 6. Reload /app/admin/settings to verify persistence
    console.log('6. Reloading /app/admin/settings to verify backend persistence...');
    await page.goto('http://127.0.0.1:9000/app/admin/settings', { waitUntil: 'networkidle0' });
    await page.waitForSelector('.admin-form-container');

    const persistedCountry = await page.$eval('#settings-default-country .search-select-text', el => el.textContent.trim());
    const persistedCurrency = await page.$eval('#settings-default-currency .search-select-text', el => el.textContent.trim());
    const persistedTz = await page.$eval('#settings-timezone .search-select-text', el => el.textContent.trim());
    const persistedDf = await page.$eval('#settings-date-format .search-select-text', el => el.textContent.trim());

    console.log('Persisted Settings Values from Backend:');
    console.log('  Country:', persistedCountry);
    console.log('  Currency:', persistedCurrency);
    console.log('  Time Zone:', persistedTz);
    console.log('  Date Format:', persistedDf);

    if (!persistedCountry.includes('India (IN)')) throw new Error(`Country mismatch: ${persistedCountry}`);
    if (!persistedCurrency.includes('INR')) throw new Error(`Currency mismatch: ${persistedCurrency}`);
    if (!persistedTz.includes('Asia/Kolkata')) throw new Error(`Timezone mismatch: ${persistedTz}`);
    if (!persistedDf.includes('DD/MM/YYYY')) throw new Error(`Date format mismatch: ${persistedDf}`);

    console.log('\n=== ALL BROWSER & PERSISTENCE CHECKS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('Browser verification failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

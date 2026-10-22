const puppeteer = require('./browser-test/node_modules/puppeteer-core');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    const capturedRequests = [];
    const capturedResponses = [];

    page.on('request', req => {
      if (req.url().includes('/api/tenant/workspaces') && req.method() === 'POST') {
        capturedRequests.push({
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
          postData: req.postData()
        });
      }
    });

    page.on('response', async res => {
      if (res.url().includes('/api/tenant/workspaces') && res.request().method() === 'POST') {
        let body;
        try {
          body = await res.json();
        } catch {
          body = await res.text();
        }
        capturedResponses.push({
          url: res.url(),
          status: res.status(),
          body: body
        });
      }
    });

    console.log('1. Navigating to login...');
    await page.goto('http://127.0.0.1:9000/login', { waitUntil: 'networkidle0' });

    console.log('2. Logging in as dev@lexorion.in...');
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

    // Take screenshot of onboarding page before opening modal
    await page.screenshot({ path: 'scratch/onboarding-before-provisioning.png', fullPage: true });

    // Check plan displayed
    const planText = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('.org-meta-cell'));
      for (const cell of cells) {
        if (cell.innerText.includes('Active plan')) {
          return cell.innerText;
        }
      }
      return 'not found';
    });
    console.log('Active plan cell:', planText);

    // Look for button to set up workspace
    console.log('4. Opening workspace modal...');
    const setupWsBtn = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'));
      const btn = buttons.find(b => b.textContent && (b.textContent.includes('Set up workspace') || b.textContent.includes('Create workspace') || b.textContent.includes('Configure workspace')));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked setup workspace button:', setupWsBtn);

    await new Promise(r => setTimeout(r, 1000));
    await page.screenshot({ path: 'scratch/onboarding-modal-opened.png' });

    // Inspect modal contents
    const modalInfo = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      return {
        title: dialog.querySelector('h2')?.textContent,
        inputs: Array.from(dialog.querySelectorAll('input')).map(i => ({
          name: i.name,
          placeholder: i.placeholder,
          value: i.value,
          label: i.closest('label')?.innerText
        })),
        buttons: Array.from(dialog.querySelectorAll('button')).map(b => b.textContent.trim()),
        capabilities: Array.from(dialog.querySelectorAll('.capability-tag')).map(c => c.textContent.trim())
      };
    });
    console.log('Modal info:', JSON.stringify(modalInfo, null, 2));

    // Fill workspace name
    console.log('5. Entering workspace details...');
    const nameInput = await page.$('input[placeholder*="Main HR"]');
    if (nameInput) {
      await nameInput.click({ clickCount: 3 });
      await nameInput.type('Main HR');
    }

    await new Promise(r => setTimeout(r, 500));

    // Fill or verify key
    const keyValue = await page.evaluate(() => {
      const input = document.querySelector('input[placeholder*="main-hr"]');
      return input ? input.value : null;
    });
    console.log('Auto-derived workspace key:', keyValue);

    await page.screenshot({ path: 'scratch/onboarding-modal-filled.png' });

    // Submit the form
    console.log('6. Submitting workspace provisioning...');
    const submitted = await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
        b => b.getAttribute('type') === 'submit' || b.textContent.includes('Provision') || b.textContent.includes('Create')
      );
      if (submitBtn) {
        submitBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked submit button:', submitted);

    // Wait for request and network to settle
    await new Promise(r => setTimeout(r, 4000));

    console.log('Captured requests:', JSON.stringify(capturedRequests, null, 2));
    console.log('Captured responses:', JSON.stringify(capturedResponses, null, 2));

    // Take screenshot after provisioning
    await page.screenshot({ path: 'scratch/onboarding-after-provisioning.png', fullPage: true });

    // Check page state after provisioning
    const afterState = await page.evaluate(() => {
      return {
        url: window.location.href,
        hasModal: Boolean(document.querySelector('[role="dialog"]')),
        errorNotice: document.querySelector('.notice.error, [role="alert"]')?.textContent?.trim(),
        progressHeadline: document.querySelector('.progress-headline')?.textContent?.trim(),
        progressPercent: document.querySelector('.progress-percent-badge')?.textContent?.trim(),
        step2Status: document.querySelectorAll('.stage-step-item')[1]?.textContent?.trim(),
        firstWorkspaceName: document.querySelector('.finish-summary')?.innerText
      };
    });
    console.log('After state:', JSON.stringify(afterState, null, 2));

  } catch (err) {
    console.error('Error in browser test:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

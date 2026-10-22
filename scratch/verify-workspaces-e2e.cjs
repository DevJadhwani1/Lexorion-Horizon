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
    await new Promise(r => setTimeout(r, 1500));

    console.log('4. Navigating to http://127.0.0.1:9000/app/admin/workspaces...');
    await page.goto('http://127.0.0.1:9000/app/admin/workspaces', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));

    console.log('Current URL:', page.url());

    // Inspect the Workspaces page state
    const workspacesPageState = await page.evaluate(() => {
      const h1 = document.querySelector('h1')?.textContent?.trim();
      const statusText = document.querySelector('[role="status"]')?.textContent?.trim();
      const planCountText = Array.from(document.querySelectorAll('p')).map(p => p.textContent.trim()).find(t => t.includes('active workspaces'));
      const createButton = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create workspace'));
      const productSelect = document.querySelector('select[multiple]');
      const displayNameInput = document.querySelector('input[required]:not([pattern])')?.value;
      const keyInput = document.querySelector('input[pattern]')?.value;

      return {
        h1,
        statusText,
        planCountText,
        isCreateButtonDisabled: createButton ? createButton.disabled : null,
        hasProductSelect: Boolean(productSelect),
        displayNameInput,
        keyInput,
      };
    });

    console.log('Workspaces Page State BEFORE creating workspace:', JSON.stringify(workspacesPageState, null, 2));
    await page.screenshot({ path: 'scratch/p0-workspaces-page-before-create.png', fullPage: true });

    // Fill in workspace details
    console.log('5. Filling in Display Name "Main HR"...');
    const inputs = await page.$$('input[required]');
    // inputs[0] is Display name, inputs[1] is Workspace key
    await inputs[0].click({ clickCount: 3 });
    await inputs[0].type('Main HR');
    await new Promise(r => setTimeout(r, 500));

    const updatedInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[required]')).map(i => i.value);
      return inputs;
    });
    console.log('Inputs after typing Main HR:', updatedInputs);

    // Click Create workspace button
    console.log('6. Clicking Create workspace button...');
    const createBtn = await page.evaluateHandle(() => {
      return Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create workspace'));
    });
    await createBtn.click();

    console.log('7. Waiting for navigation or page update...');
    await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 5000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    console.log('Current URL after create:', page.url());

    const afterCreateState = await page.evaluate(() => {
      return {
        url: window.location.href,
        h1: document.querySelector('h1')?.textContent?.trim(),
        title: document.title,
        bodySnippet: document.body.innerText.slice(0, 400),
      };
    });

    console.log('State after create:', JSON.stringify(afterCreateState, null, 2));
    await page.screenshot({ path: 'scratch/p0-after-create-workspace.png', fullPage: true });

    // Also navigate back to /app/admin/workspaces to inspect table list
    console.log('8. Inspecting /app/admin/workspaces list...');
    await page.goto('http://127.0.0.1:9000/app/admin/workspaces', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1500));

    const tableState = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr')).map(tr => {
        return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
      });
      const planCountText = Array.from(document.querySelectorAll('p')).map(p => p.textContent.trim()).find(t => t.includes('active workspaces'));
      const statusText = document.querySelector('[role="status"]')?.textContent?.trim();
      return {
        planCountText,
        statusText,
        rows,
      };
    });

    console.log('Workspaces Table State:', JSON.stringify(tableState, null, 2));
    await page.screenshot({ path: 'scratch/p0-workspaces-page-list.png', fullPage: true });

  } catch (err) {
    console.error('Error running test:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

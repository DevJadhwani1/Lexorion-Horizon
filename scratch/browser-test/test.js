const puppeteer = require('puppeteer-core');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('response', async response => {
      if (!response.ok() && response.url().includes('/api/')) {
        try {
          const text = await response.text();
          console.log(`API ERROR ${response.status()} ${response.url()}:`, text);
        } catch(e) {}
      }
    });
    await page.setViewport({ width: 1280, height: 800 });
    
    // 1. Login
    console.log('Logging in...');
    await page.goto('http://localhost:9000', { waitUntil: 'networkidle0' });
    
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'admin@lexorion.in');
    await page.click('button[type="submit"]');
    await page.waitForSelector('input[type="password"]');
    await page.type('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(()=>{});
    
    // Setup Plan if needed
    console.log('Setting up organization plan...');
    await page.evaluate(async () => {
      const token = sessionStorage.getItem('lexorion.accessToken');
      if (!token) throw new Error('No access token found');
      
      const orgsRes = await fetch('/api/platform/organizations', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const orgs = await orgsRes.json();
      const testOrg = orgs.find(o => o.slug === 'test-org' || o.slug === 'test');
      if (testOrg) {
        await fetch(`/api/platform/organizations/${testOrg.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ planKey: 'business' })
        });
      }
    });

    const wsKey = 'ws' + Date.now();
    
    // Switch to client mode (Tenant Org UI)
    await page.evaluate(() => sessionStorage.setItem('lexorion.applicationMode', 'client'));
    await page.goto('http://localhost:9000/app/admin/workspaces', { waitUntil: 'networkidle0' });
    
    // Find or Create Workspace
    const isCreateDisabled = await page.$eval('button[type="submit"]', el => el.disabled);
    let targetWs = wsKey;
    if (isCreateDisabled) {
      console.log('Workspace limit reached. Using existing workspace...');
      targetWs = await page.evaluate(() => {
        const selects = document.querySelectorAll('select[aria-label="Workspace"] option');
        return selects.length > 1 ? selects[1].value : null;
      });
      if (!targetWs) targetWs = 'ws1';
    } else {
      console.log(`Creating workspace ${wsKey}...`);
      await page.type('input[pattern]', wsKey);
      await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input'));
        const nameInput = inputs.find(el => !el.hasAttribute('pattern') && el.type === 'text');
        if (nameInput) {
           const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
           nativeInputValueSetter.call(nameInput, 'Workforce Workspace');
           nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await page.click('button[type="submit"]');
      
      await page.waitForFunction((expectedWs) => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        return rows.some(row => row.textContent.includes(expectedWs));
      }, { timeout: 10000 }, wsKey);
    }
    
    // Select Workspace
    console.log(`Selecting Workspace ${targetWs} from header dropdown...`);
    await page.select('select[aria-label="Workspace"]', targetWs);
    await new Promise(r => setTimeout(r, 2000));
    
    // 3. Navigate to workforce employees
    console.log('Navigating to Workforce Employees...');
    await page.goto('http://localhost:9000/app/workforce/employees', { waitUntil: 'networkidle0' });
    
    // 4. Create an employee
    const empCode = 'EMP-' + Date.now();
    console.log(`Creating employee ${empCode}...`);
    // Open <details className="card"> summary
    try {
      await page.waitForSelector('details summary', { timeout: 10000 });
    } catch(e) {
      console.log('HTML Dump:', await page.evaluate(() => document.body.innerHTML));
      throw e;
    }
    await page.click('details summary');
    
    await page.type('input[name="employeeCode"]', empCode);
    await page.type('input[name="firstName"]', 'John');
    await page.type('input[name="lastName"]', 'Doe');
    await page.type('input[name="workEmail"]', `john.doe.${Date.now()}@example.com`);
    await page.$eval('input[name="joiningDate"]', el => el.value = '2024-01-01');
    await page.click('form.form-grid button');
    
    console.log('Waiting for employee to appear in list...');
    await page.waitForFunction((code) => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      return rows.some(row => row.textContent.includes(code));
    }, { timeout: 10000 }, empCode);
    console.log('Employee created and displayed in list.');

    // 5. Open employee profile
    console.log(`Navigating to Employee Profile ${empCode}...`);
    await page.goto(`http://localhost:9000/app/workforce/employees/${empCode}`, { waitUntil: 'networkidle0' });
    
    // Verify persisted details
    let profileText = await page.evaluate(() => document.body.innerText);
    if (!profileText.includes('John Doe') || !profileText.includes(empCode)) {
      throw new Error("Employee profile details missing or incorrect");
    }
    console.log('Employee profile loaded correctly.');

    // 6. Edit Employee
    console.log('Editing employee...');
    await page.waitForSelector('details summary');
    await page.click('details summary'); // Open edit employee details
    
    // Edit middle name
    await page.type('input[name="middleName"]', 'Smith');
    await page.click('form.form-grid button');
    await new Promise(r => setTimeout(r, 2000));
    
    // Refresh to verify persistence
    console.log('Refreshing to verify edit persistence...');
    await page.reload({ waitUntil: 'networkidle0' });
    
    profileText = await page.evaluate(() => document.body.innerText);
    // Middle name doesn't show in the profile view directly, let's open details to check value
    await page.click('details summary');
    const middleNameVal = await page.$eval('input[name="middleName"]', el => el.value);
    if (middleNameVal !== 'Smith') {
      throw new Error(`Employee edit did not persist! Expected Smith, got ${middleNameVal}`);
    }
    console.log('Employee edit persisted successfully.');

    // 7. Departments
    console.log('Navigating to Departments...');
    await page.goto('http://localhost:9000/app/workforce/departments', { waitUntil: 'networkidle0' });
    const deptKey = 'dept-' + Date.now();
    await page.type('input[name="key"]', deptKey);
    await page.type('input[name="name"]', 'Engineering');
await page.click('form.toolbar button');
    
    await page.waitForFunction((key) => {
      return document.body.innerText.includes(key);
    }, { timeout: 10000 }, deptKey);
    console.log('Department created.');

    // 8. Designations
    console.log('Navigating to Designations...');
    await page.goto('http://localhost:9000/app/workforce/designations', { waitUntil: 'networkidle0' });
    const desigKey = 'desig-' + Date.now();
    await page.type('input[name="key"]', desigKey);
    await page.type('input[name="name"]', 'Software Engineer');
await page.click('form.toolbar button');
    
    await page.waitForFunction((key) => {
      return document.body.innerText.includes(key);
    }, { timeout: 10000 }, desigKey);
    console.log('Designation created.');

    // 9. Assign Dept/Designation to Employee
    console.log('Assigning Dept and Designation to Employee...');
    await page.goto(`http://localhost:9000/app/workforce/employees/${empCode}`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('details summary');
    await page.click('details summary');
    
    await page.evaluate(() => document.querySelector('input[name="departmentKey"]').value = '');
    await page.type('input[name="departmentKey"]', deptKey);
    
    await page.evaluate(() => document.querySelector('input[name="designationKey"]').value = '');
    await page.type('input[name="designationKey"]', desigKey);
    
    await page.click('form.form-grid button');
    await new Promise(r => setTimeout(r, 2000));
    
    await page.reload({ waitUntil: 'networkidle0' });
    profileText = await page.evaluate(() => document.body.innerText);
    if (!profileText.includes(deptKey) || !profileText.includes(desigKey)) {
      throw new Error("Employee department/designation failed to update/persist");
    }
    console.log('Employee department and designation persisted.');

    // 10. Lifecycle Actions (suspend)
    console.log('Exercising Lifecycle Action: suspend');
    // We should intercept the confirm dialog
    page.on('dialog', async dialog => {
      await dialog.accept();
    });
    
    // Find the button with text "suspend"
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const suspendBtn = btns.find(b => b.textContent === 'suspend');
      if (suspendBtn) suspendBtn.click();
    });
    await new Promise(r => setTimeout(r, 2000));
    
    await page.reload({ waitUntil: 'networkidle0' });
    profileText = await page.evaluate(() => document.body.innerText);
    if (!profileText.includes('SUSPENDED')) {
      throw new Error("Employee status did not transition to SUSPENDED");
    }
    console.log('Lifecycle transition (suspend) successful.');

    console.log('BATCH 3 BROWSER JOURNEY COMPLETED SUCCESSFULLY.');

  } catch (err) {
    console.error('Browser journey failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();

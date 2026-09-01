const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.setCookie({ name: 'auth', value: 'true', domain: 'localhost', path: '/' });

  console.log('Navigating to /reports');
  await page.goto('http://localhost:3000/reports', { waitUntil: 'networkidle0' });
  
  console.log('Navigating to /restock');
  await page.goto('http://localhost:3000/restock', { waitUntil: 'networkidle0' });

  await browser.close();
})();

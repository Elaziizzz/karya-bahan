const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  // We need to set the auth cookie to bypass login
  await page.setCookie({
    name: 'auth',
    value: 'true',
    domain: 'localhost',
    path: '/'
  });

  console.log('Navigating to http://localhost:3000/');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
  
  console.log('Done waiting. Check logs above.');
  await browser.close();
})();

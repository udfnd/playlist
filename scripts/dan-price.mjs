import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();

// dan.com redirects repe.at to its listing page
await page.goto('https://dan.com/buy-domain/repe.at', {
  waitUntil: 'domcontentloaded',
  timeout: 30000,
}).catch(async () => {
  await page.goto('https://dan.com/repe.at', { waitUntil: 'domcontentloaded', timeout: 30000 });
});
await page.waitForTimeout(6000);

const text = await page.evaluate(() => document.body.innerText);
const url = page.url();
console.log('URL:', url);
console.log('---');
// Look for price patterns
const prices = text.match(/[€$£]\s?[\d,.]+/g) || [];
console.log('Prices found:', prices.slice(0, 10));
console.log('---');
console.log('First 1500 chars:');
console.log(text.slice(0, 1500));
await page.screenshot({ path: '/tmp/dan-repeat.png', fullPage: false });
await browser.close();

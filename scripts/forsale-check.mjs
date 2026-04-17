import { chromium } from 'playwright';

const browser = await chromium.launch();
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  viewport: { width: 1440, height: 900 },
  locale: 'en-US',
});
const page = await context.newPage();

// Try opening repe.at — it redirects to forsale parking with JS-rendered price
const resp = await page.goto('http://repe.at/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => null);
await page.waitForTimeout(8000);

const url = page.url();
const text = await page.evaluate(() => document.body.innerText);
console.log('Final URL:', url);
console.log();
console.log('Full page text:');
console.log(text.slice(0, 3000));
await page.screenshot({ path: '/tmp/repeat-forsale.png', fullPage: false });
await browser.close();

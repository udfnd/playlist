import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://iwantmyname.com/en/?q=playcrate', { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);

// capture inner HTML near pricing
const html = await page.content();
await (await import('node:fs/promises')).writeFile('/tmp/iwmn-rendered.html', html);

const text = await page.evaluate(() => document.body.innerText);
await (await import('node:fs/promises')).writeFile('/tmp/iwmn-body.txt', text);

await page.screenshot({ path: '/tmp/iwmn-search.png', fullPage: true });
await browser.close();
console.log('saved /tmp/iwmn-rendered.html, body.txt, search.png');

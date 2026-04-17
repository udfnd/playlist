import { chromium } from 'playwright';
const browser = await chromium.launch();
const p = await browser.newPage();
await p.goto('https://iwantmyname.com/en/?q=onrepeat', { waitUntil: 'domcontentloaded' });
await p.waitForFunction(
  () => /onrepeat\.com/i.test(document.body.innerText),
  { timeout: 20000 },
).catch(() => {});
await p.waitForTimeout(2500);
const text = await p.evaluate(() => document.body.innerText);
// Only find onrepeat.me block
const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
for (let i = 0; i < lines.length - 3; i++) {
  if (/^onrepeat\.[a-z]{2,10}$/i.test(lines[i])) {
    console.log(`${lines[i].padEnd(20)} | ${lines[i+1].padEnd(10)} | ${lines[i+2]}`);
  }
}
await browser.close();

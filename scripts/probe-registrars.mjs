import { chromium } from 'playwright';
const browser = await chromium.launch();
const urls = {
  porkbun: 'https://porkbun.com/checkout/search?q=repe.at',
  namecheap: 'https://www.namecheap.com/domains/registration/results/?domain=repe.at',
  domainr: 'https://domainr.com/?q=repe.at',
};
for (const [name, url] of Object.entries(urls)) {
  const p = await browser.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(7000);
  const txt = await p.evaluate(() => document.body.innerText);
  console.log(`===== ${name} =====`);
  console.log(txt.split('\n').filter(l=>l.trim()).slice(0, 50).join('\n'));
  console.log();
  await p.close();
}
await browser.close();

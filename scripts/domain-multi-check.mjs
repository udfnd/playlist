import { chromium } from 'playwright';

const domains = process.argv.slice(2);
if (domains.length === 0) {
  console.error('Usage: node domain-multi-check.mjs <full.domain> ...');
  process.exit(1);
}

const browser = await chromium.launch();

async function porkbun(page, full) {
  try {
    await page.goto(`https://porkbun.com/checkout/search?q=${encodeURIComponent(full)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForFunction(
      (d) => document.body.innerText.toLowerCase().includes(d.toLowerCase()),
      full,
      { timeout: 15000 },
    ).catch(() => {});
    await page.waitForTimeout(2500);
    const text = await page.evaluate(() => document.body.innerText);
    // Find the line containing full domain and the nearby price or "unavailable"
    const lines = text.split('\n').map((l) => l.trim());
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase() === full.toLowerCase()) {
        // Look forward for $ or "Unavailable"/"Taken"
        for (let j = i; j < Math.min(i + 15, lines.length); j++) {
          if (/unavailable|taken|registered/i.test(lines[j])) return { status: 'taken' };
          const pm = lines[j].match(/\$\s?([\d,.]+)/);
          if (pm) return { status: 'available', price: `$${pm[1]}` };
        }
      }
    }
    return { status: 'unknown' };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

async function namecheap(page, full) {
  try {
    await page.goto(`https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(full)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForFunction(
      (d) => document.body.innerText.toLowerCase().includes(d.toLowerCase()),
      full,
      { timeout: 15000 },
    ).catch(() => {});
    await page.waitForTimeout(3000);
    const text = await page.evaluate(() => document.body.innerText);
    const lines = text.split('\n').map((l) => l.trim());
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase() === full.toLowerCase()) {
        for (let j = i; j < Math.min(i + 20, lines.length); j++) {
          if (/taken|unavailable|registered/i.test(lines[j])) return { status: 'taken' };
          const pm = lines[j].match(/\$\s?([\d,.]+)/);
          if (pm) return { status: 'available', price: `$${pm[1]}` };
        }
      }
    }
    // fallback: look for any 'taken' / price near first occurrence
    const firstIdx = text.toLowerCase().indexOf(full.toLowerCase());
    if (firstIdx >= 0) {
      const chunk = text.slice(firstIdx, firstIdx + 400);
      if (/taken|unavailable|registered/i.test(chunk)) return { status: 'taken' };
      const pm = chunk.match(/\$\s?([\d,.]+)/);
      if (pm) return { status: 'available', price: `$${pm[1]}` };
    }
    return { status: 'unknown' };
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

async function domainr(page, full) {
  try {
    await page.goto(`https://domainr.com/?q=${encodeURIComponent(full)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3500);
    const info = await page.evaluate((d) => {
      const results = Array.from(document.querySelectorAll('.domain, li, div'));
      for (const el of results) {
        const text = (el.innerText || '').trim();
        if (!text) continue;
        const lines = text.split('\n').map((l) => l.trim());
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase() === d.toLowerCase()) {
            const chunk = lines.slice(i, i + 6).join(' | ');
            return { block: chunk };
          }
        }
      }
      return { block: null };
    }, full);
    return info;
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

async function check(full) {
  const ctx = await browser.newContext();
  const page1 = await ctx.newPage();
  const page2 = await ctx.newPage();
  const page3 = await ctx.newPage();
  const [pb, nc, dr] = await Promise.all([
    porkbun(page1, full),
    namecheap(page2, full),
    domainr(page3, full),
  ]);
  await ctx.close();
  return { domain: full, porkbun: pb, namecheap: nc, domainr: dr };
}

const results = [];
for (const d of domains) {
  process.stderr.write(`checking ${d}...\n`);
  const r = await check(d);
  results.push(r);
  process.stderr.write(`  porkbun: ${r.porkbun.status}${r.porkbun.price ? ' ' + r.porkbun.price : ''} | namecheap: ${r.namecheap.status}${r.namecheap.price ? ' ' + r.namecheap.price : ''}\n`);
}

await browser.close();
console.log(JSON.stringify(results, null, 2));

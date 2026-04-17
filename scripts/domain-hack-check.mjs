import { chromium } from 'playwright';

const CONCURRENCY = 5;
const hacks = process.argv.slice(2);
if (hacks.length === 0) {
  console.error('Usage: node domain-hack-check.mjs <full.domain> ...');
  process.exit(1);
}

const browser = await chromium.launch();

async function checkOne(full) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`https://iwantmyname.com/en/?q=${encodeURIComponent(full)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    const [stem] = full.split('.');
    await page.waitForFunction(
      (s) => new RegExp(`${s}\\.`, 'i').test(document.body.innerText),
      stem,
      { timeout: 20000 },
    ).catch(() => {});
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText);
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // Find exact match block
    for (let i = 0; i < lines.length - 2; i++) {
      if (lines[i].toLowerCase() === full.toLowerCase()) {
        const status = lines[i + 2];
        if (/^taken$/i.test(status)) return { domain: full, status: 'taken' };
        if (/^\$[\d,.]+/.test(status)) return { domain: full, status: 'available', price: status };
        return { domain: full, status: 'unknown', raw: status };
      }
    }
    return { domain: full, status: 'not_found' };
  } finally {
    await ctx.close();
  }
}

async function runPool(items) {
  const results = [];
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) {
        const n = queue.shift();
        if (!n) return;
        try {
          const r = await checkOne(n);
          results.push(r);
          process.stderr.write(`  ${r.status === 'available' ? '✓' : r.status === 'taken' ? '✗' : '?'} ${n} → ${r.status}${r.price ? ' ' + r.price : ''}\n`);
        } catch (e) {
          results.push({ domain: n, status: 'error', error: e.message });
        }
      }
    }),
  );
  return results;
}

const t0 = Date.now();
const results = await runPool(hacks);
await browser.close();
process.stderr.write(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s\n\n`);
console.log(JSON.stringify(results, null, 2));

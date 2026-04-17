import { chromium } from 'playwright';

const TARGET_TLDS = ['com', 'fm', 'app', 'io', 'co', 'me', 'dev', 'ai'];
const CONCURRENCY = 5;

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Usage: node domain-check.mjs <name1> <name2> ...');
  process.exit(1);
}

const browser = await chromium.launch();

async function checkOne(name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`https://iwantmyname.com/en/?q=${encodeURIComponent(name)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    // wait for pricing text to appear
    await page.waitForFunction(
      (stem) => {
        const txt = document.body.innerText;
        const re = new RegExp(`${stem}\\.com`, 'i');
        return re.test(txt);
      },
      name,
      { timeout: 20000 },
    ).catch(() => {});
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText);
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    const out = [];
    for (let i = 0; i < lines.length - 2; i++) {
      const domain = lines[i];
      const tldLine = lines[i + 1];
      const statusLine = lines[i + 2];
      const m = domain.match(/^([a-z0-9-]+)\.([a-z]{2,10})$/i);
      if (!m) continue;
      const stem = m[1].toLowerCase();
      const tld = m[2].toLowerCase();
      if (stem !== name.toLowerCase()) continue;
      if (!tldLine.toLowerCase().startsWith('.')) continue;
      if (!TARGET_TLDS.includes(tld)) continue;
      if (/^taken$/i.test(statusLine)) {
        out.push({ domain: domain.toLowerCase(), status: 'taken' });
      } else if (/^\$[\d,.]+/.test(statusLine)) {
        out.push({ domain: domain.toLowerCase(), status: 'available', price: statusLine });
      }
    }
    return [name, out];
  } finally {
    await ctx.close();
  }
}

async function runPool(names) {
  const results = {};
  const queue = [...names];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const n = queue.shift();
      if (!n) return;
      try {
        const [name, rows] = await checkOne(n);
        results[name] = rows;
        process.stderr.write(`  ✓ ${name} (${rows.length} tlds)\n`);
      } catch (e) {
        results[n] = { error: e.message };
        process.stderr.write(`  ✗ ${n}: ${e.message}\n`);
      }
    }
  });
  await Promise.all(workers);
  return results;
}

const t0 = Date.now();
const results = await runPool(names);
await browser.close();
process.stderr.write(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
console.log(JSON.stringify(results, null, 2));

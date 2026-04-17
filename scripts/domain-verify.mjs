import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const TARGET_TLDS = ['com', 'fm', 'app', 'io', 'co', 'me', 'dev'];
const CONCURRENCY = 4;
const AFTERMARKET_NS = /dan\.com|afternic|sedo|uniregistry|parkingcrew|above\.com|bodis|dns-parking|dns\.parking|park\.io|hugedomains/i;

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Usage: node domain-verify.mjs <name1> <name2> ...');
  process.exit(1);
}

function dnsNS(fqdn) {
  try {
    const out = execSync(`dig +short +time=3 +tries=1 NS ${fqdn}`, { timeout: 8000 })
      .toString().trim();
    return out ? out.split('\n') : [];
  } catch {
    return [];
  }
}

const browser = await chromium.launch();

async function queryIwmn(name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(`https://iwantmyname.com/en/?q=${encodeURIComponent(name)}`, {
      waitUntil: 'domcontentloaded', timeout: 30000,
    });
    await page.waitForFunction(
      (s) => new RegExp(`${s}\\.com`, 'i').test(document.body.innerText),
      name, { timeout: 20000 },
    ).catch(() => {});
    await page.waitForTimeout(1500);
    const text = await page.evaluate(() => document.body.innerText);
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const out = {};
    for (let i = 0; i < lines.length - 2; i++) {
      const m = lines[i].match(/^([a-z0-9-]+)\.([a-z]{2,10})$/i);
      if (!m) continue;
      if (m[1].toLowerCase() !== name.toLowerCase()) continue;
      const tld = m[2].toLowerCase();
      if (!TARGET_TLDS.includes(tld)) continue;
      const status = lines[i + 2];
      if (/^taken$/i.test(status)) out[tld] = 'taken';
      else if (/^\$[\d,.]+/.test(status)) out[tld] = status;
    }
    return out;
  } finally {
    await ctx.close();
  }
}

async function verify(name) {
  const iwmn = await queryIwmn(name);
  // For each TLD marked as price (available), do NS check
  const verified = {};
  for (const tld of Object.keys(iwmn)) {
    const fqdn = `${name}.${tld}`;
    if (iwmn[tld] === 'taken') {
      verified[tld] = { status: 'taken' };
      continue;
    }
    const ns = dnsNS(fqdn);
    if (ns.length === 0) {
      verified[tld] = { status: 'available', price: iwmn[tld] };
    } else if (AFTERMARKET_NS.test(ns.join(','))) {
      verified[tld] = { status: 'aftermarket', price: iwmn[tld], ns: ns[0] };
    } else {
      verified[tld] = { status: 'taken-parked', price: iwmn[tld], ns: ns[0] };
    }
  }
  return verified;
}

async function runPool(names) {
  const results = {};
  const q = [...names];
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (q.length) {
      const n = q.shift();
      if (!n) return;
      try {
        results[n] = await verify(n);
        const com = results[n].com;
        const tag = com?.status === 'available' ? '✓' : com?.status === 'taken' ? '✗' : '~';
        process.stderr.write(`  ${tag} ${n}.com: ${com?.status || 'n/a'}${com?.price ? ' ' + com.price : ''}\n`);
      } catch (e) {
        results[n] = { error: e.message };
      }
    }
  }));
  return results;
}

const t0 = Date.now();
const results = await runPool(names);
await browser.close();
process.stderr.write(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s\n\n`);
console.log(JSON.stringify(results, null, 2));

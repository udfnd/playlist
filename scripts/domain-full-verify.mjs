import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const TARGET_TLDS = ['com', 'net', 'org', 'app', 'io', 'co', 'me', 'dev', 'fm', 'ai', 'cc', 'xyz', 'sh', 'tv', 'studio'];
const CONCURRENCY = 3;
const AFTERMARKET_NS = /dan\.com|afternic|sedo|uniregistry|parkingcrew|above\.com|bodis|dns-parking|park\.io|hugedomains|huge\.com/i;

const names = process.argv.slice(2);
if (names.length === 0) {
  console.error('Usage: node domain-full-verify.mjs <name1> <name2> ...');
  process.exit(1);
}

function rdap(fqdn) {
  try {
    const out = execSync(
      `curl -sL "https://rdap.org/domain/${fqdn}" --max-time 12 -w "\\n__HTTP__%{http_code}"`,
      { timeout: 15000 },
    ).toString();
    const match = out.match(/__HTTP__(\d+)$/);
    const code = match ? parseInt(match[1]) : 0;
    if (code === 404) return { status: 'available' };
    if (code === 200) {
      try {
        const body = out.replace(/\n__HTTP__\d+$/, '');
        const data = JSON.parse(body);
        const regEvent = (data.events || []).find((e) => e.eventAction === 'registration');
        return { status: 'taken', registered: regEvent?.eventDate?.slice(0, 10) };
      } catch {
        return { status: 'taken' };
      }
    }
    return { status: 'unknown', code };
  } catch {
    return { status: 'unknown' };
  }
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
      if (/^taken$/i.test(status)) out[tld] = { iwmn: 'taken' };
      else if (/^\$[\d,.]+/.test(status)) out[tld] = { iwmn: status };
    }
    return out;
  } finally {
    await ctx.close();
  }
}

async function verify(name) {
  const iwmn = await queryIwmn(name);
  const result = {};
  for (const tld of Object.keys(iwmn)) {
    const fqdn = `${name}.${tld}`;
    const r = { ...iwmn[tld] };
    const rd = rdap(fqdn);
    r.rdap = rd.status;
    if (rd.registered) r.registered = rd.registered;
    if (rd.status === 'available') {
      r.verdict = 'AVAILABLE';
    } else if (rd.status === 'taken') {
      const ns = dnsNS(fqdn);
      if (AFTERMARKET_NS.test(ns.join(','))) {
        r.verdict = 'AFTERMARKET';
        r.ns = ns[0];
      } else {
        r.verdict = 'TAKEN';
        r.ns = ns[0] || null;
      }
    } else {
      r.verdict = 'UNKNOWN';
    }
    result[tld] = r;
  }
  return result;
}

const t0 = Date.now();
const all = {};
const queue = [...names];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const n = queue.shift();
    if (!n) return;
    process.stderr.write(`  working on ${n}...\n`);
    all[n] = await verify(n);
  }
}));
await browser.close();
process.stderr.write(`\nDone in ${((Date.now() - t0) / 1000).toFixed(1)}s\n\n`);

// Pretty table print
console.log('\n==================================================');
for (const [name, tlds] of Object.entries(all)) {
  console.log(`\n### ${name}`);
  console.log('TLD     | verdict       | price (iwmn) | registered | NS (if taken)');
  console.log('--------|---------------|--------------|------------|-------------------------');
  for (const tld of TARGET_TLDS) {
    const r = tlds[tld];
    if (!r) continue;
    console.log(
      `.${tld.padEnd(6)} | ${String(r.verdict).padEnd(13)} | ${String(r.iwmn).padEnd(12)} | ${(r.registered || '-').padEnd(10)} | ${r.ns || '-'}`,
    );
  }
}
console.log('\n==================================================');
console.log(JSON.stringify(all, null, 2));

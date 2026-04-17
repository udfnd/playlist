import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const OUT_DIR = '.moai/reports/mobile-check';
const URL = process.env.TARGET_URL || 'http://localhost:3001/';

const viewports = [
  { name: 'iphone-se-portrait', device: devices['iPhone SE'] },
  { name: 'iphone-14-portrait', device: devices['iPhone 14'] },
  { name: 'iphone-14-landscape', device: devices['iPhone 14 landscape'] },
  { name: 'pixel-7-portrait', device: devices['Pixel 7'] },
  { name: 'ipad-mini-portrait', device: devices['iPad Mini'] },
  {
    name: 'desktop',
    device: {
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      deviceScaleFactor: 2,
      isMobile: false,
      hasTouch: false,
    },
  },
];

async function ensureDir(p) {
  await mkdir(dirname(p), { recursive: true });
}

async function runOne(browser, vp) {
  const context = await browser.newContext({ ...vp.device });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const results = { name: vp.name, steps: [] };

  try {
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(500);

    const shot1 = `${OUT_DIR}/${vp.name}-01-input.png`;
    await ensureDir(shot1);
    await page.screenshot({ path: shot1, fullPage: false });
    const hasHorizScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    const dvhSupport = await page.evaluate(() => {
      const el = document.querySelector('.w-dvw');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { w: rect.width, h: rect.height, vpW: window.innerWidth, vpH: window.innerHeight };
    });
    results.steps.push({ step: 'input', shot: shot1, hasHorizScroll, dvhSupport });

    // Click "demo playlist" to enter carousel
    const demoBtn = page.getByRole('button', { name: /demo playlist/i });
    if (await demoBtn.count()) {
      await demoBtn.click();
      await page.waitForTimeout(2500);
      const shot2 = `${OUT_DIR}/${vp.name}-02-carousel.png`;
      await page.screenshot({ path: shot2, fullPage: false });
      const canvasBox = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { w: r.width, h: r.height };
      });
      results.steps.push({ step: 'carousel', shot: shot2, canvasBox });

      // Try tapping near center to open a card
      const vpSize = page.viewportSize();
      if (vpSize) {
        await page.mouse.click(vpSize.width / 2, vpSize.height * 0.55);
        await page.waitForTimeout(1500);
        const shot3 = `${OUT_DIR}/${vp.name}-03-songview.png`;
        await page.screenshot({ path: shot3, fullPage: false });
        const songViewBox = await page.evaluate(() => {
          const ytWrap = document.querySelector('[class*="aspect-ratio"]');
          if (!ytWrap) return null;
          const r = ytWrap.getBoundingClientRect();
          return {
            w: r.width,
            h: r.height,
            vpW: window.innerWidth,
            overflow: r.right > window.innerWidth + 1 || r.left < -1,
          };
        });
        results.steps.push({ step: 'songview', shot: shot3, songViewBox });
      }
    }

    results.consoleErrors = consoleErrors;
    results.pageErrors = pageErrors;
  } catch (err) {
    results.error = err.message;
    results.consoleErrors = consoleErrors;
    results.pageErrors = pageErrors;
  } finally {
    await context.close();
  }

  return results;
}

const browser = await chromium.launch();
const all = [];
for (const vp of viewports) {
  console.log(`Running ${vp.name}...`);
  const r = await runOne(browser, vp);
  all.push(r);
}
await browser.close();

console.log('\n=== RESULTS ===');
console.log(JSON.stringify(all, null, 2));

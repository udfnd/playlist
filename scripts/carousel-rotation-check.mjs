import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const OUT_DIR = '.moai/reports/carousel-rotation';
await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 14'] });
const page = await ctx.newPage();

const TARGET = process.env.TARGET_URL || 'https://onrepeat.cc/';
await page.goto(TARGET, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1500);

// Click demo button
await page.getByRole('button', { name: /demo playlist/i }).click();
await page.waitForTimeout(3500);

// State 1: initial
await page.screenshot({ path: `${OUT_DIR}/01-initial.png` });

// Drag to rotate carousel a bit (simulate swipe)
const vp = page.viewportSize();
const cx = vp.width / 2;
const cy = vp.height * 0.6;

for (let step = 1; step <= 4; step++) {
  await page.mouse.move(cx + 100, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 50, cy, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT_DIR}/0${step + 1}-after-drag.png` });
}

await browser.close();
console.log('Screenshots saved to', OUT_DIR);

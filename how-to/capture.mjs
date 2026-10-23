// Takes the how-tos' screenshots of the real desk in the sandbox (fake data
// only), with the numbered pins measured from the page itself, so a moved
// button moves its pin. Needs the sandbox running on 4197 and Chrome.
//   node how-to/capture.mjs <slug>
// reads how-to/<slug>/shots.json: [{ name, url, alt, before: [actions], crop:
// selector | null, pad, pins: [{ selector, label, nth }] }] and writes
// how-to/<slug>/shots/<name>.png and <name>.json. Actions: { click }, { fill:
// [selector, value] }, { press }, { wait }, { waitFor }, { hover }, { eval }.
// A locked page is signed in with the sandbox's own fake password.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const PLAYWRIGHT = process.env.PLAYWRIGHT_CORE || '/Users/KateBarnes/.npm-global/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
const { chromium } = await import(PLAYWRIGHT);
const slug = process.argv[2];
const only = process.argv[3] || '';
const here = p => new URL(`./${p}`, import.meta.url);
const shots = JSON.parse(readFileSync(here(`${slug}/shots.json`), 'utf8')).filter(s => !only || s.name === only);
mkdirSync(here(`${slug}/shots`), { recursive: true });

const W = 1280, H = 900, DPR = 2;
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: DPR });
const fails = [];

async function signInIfAsked() {
  const field = page.locator('input[type="password"]').first();
  if (await field.isVisible().catch(() => false) && await page.locator('.signin-box, form.signin, [class*="signin"]').first().isVisible().catch(() => false)) {
    await field.fill('sandbox');   // the sandbox's own fake password, never a real one
    await field.press('Enter');
    await page.waitForTimeout(1500);
  }
}

for (const s of shots) {
  try {
    await page.goto(`http://localhost:4197${s.url.startsWith('/') ? '' : '/'}${s.url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await signInIfAsked();
    for (const a of s.before ?? []) {
      if (a.click) await page.locator(a.click).first().click();
      else if (a.fill) await page.locator(a.fill[0]).first().fill(a.fill[1]);
      else if (a.press) await page.keyboard.press(a.press);
      else if (a.hover) await page.locator(a.hover).first().hover();
      else if (a.waitFor) await page.locator(a.waitFor).first().waitFor({ timeout: 8000 });
      else if (a.eval) await page.evaluate(a.eval);
      if (a.wait) await page.waitForTimeout(a.wait);
      else await page.waitForTimeout(300);
    }
    await page.mouse.move(0, 0);
    // The I need help! button is not part of any step.
    await page.addStyleTag({ content: '.problem-fab, .problem-panel { display: none !important; }' });
    await page.waitForTimeout(300);
    // The crop: an element and a margin, or the whole window.
    let crop = { x: 0, y: 0, width: W, height: H };
    if (s.crop) {
      const el = page.locator(s.crop).first();
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const b = await el.boundingBox();
      if (!b) throw new Error(`crop ${s.crop} not found`);
      const pad = s.pad ?? 16;
      const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
      crop = { x, y, width: Math.min(W - x, b.width + 2 * pad), height: Math.min(H - y, b.height + 2 * pad) };
    }
    const pins = [];
    for (const p of s.pins ?? []) {
      const el = page.locator(p.selector).nth(p.nth ?? 0);
      const b = await el.boundingBox();
      if (!b) { fails.push(`${slug}/${s.name}: pin ${p.selector} not found`); continue; }
      const px = (p.at === 'left' ? b.x + 10 : b.x + b.width / 2), py = b.y + b.height / 2;
      pins.push({ x: +(((px - crop.x) / crop.width) * 100).toFixed(1), y: +(((py - crop.y) / crop.height) * 100).toFixed(1), label: p.label });
    }
    await page.screenshot({ path: here(`${slug}/shots/${s.name}.png`).pathname });
    const meta = { iw: W * DPR, ih: H * DPR, cx: Math.round(crop.x * DPR), cy: Math.round(crop.y * DPR), cw: Math.round(crop.width * DPR), ch: Math.round(crop.height * DPR), alt: s.alt, pins };
    writeFileSync(here(`${slug}/shots/${s.name}.json`), `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`ok ${slug}/${s.name}: ${pins.length} pins`);
  } catch (err) {
    fails.push(`${slug}/${s.name}: ${err.message.split('\n')[0]}`);
  }
}
await browser.close();
if (fails.length) { console.log(fails.join('\n')); process.exitCode = 1; }

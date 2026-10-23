// Records the Submit content how-to's two recordings of the real desk in the
// sandbox, and a poster for each (Oct 23: the ones from Sep 30 showed the
// team page before the six hubs). fill-in.webm types in one practice event
// and adds it; bulk.webm drops a spreadsheet on the bulk door, lists its rows
// and adds them. The items are Aggie jokes on example.org, kept in the
// sandbox's memory only. Each video is one run, so it holds only the pauses
// written here. Needs the sandbox running on 4197 and Chrome.
//   node how-to/record-submit.mjs [fill-in | bulk]
// writes how-to/submit-content/fill-in.webm with its poster 1-form.png, and
// bulk.webm with its poster 5-bulk-list.png.
import { readFileSync } from 'node:fs';

const PLAYWRIGHT = process.env.PLAYWRIGHT_CORE || '/Users/KateBarnes/.npm-global/lib/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
const { chromium } = await import(PLAYWRIGHT);
const only = process.argv[2] || '';
const here = p => new URL(`./submit-content/${p}`, import.meta.url).pathname;
// The form's own width with the page's 40px gutters, so the words stay big in
// the slide, at the shape of the Sep 30 recordings (1280 by 1100). The page is
// drawn at twice its size (Z): a recording keeps the window's own pixels, so
// this is how it stays sharp on a fine screen.
const W = 920, H = 790, Z = 2;
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// The spreadsheet's rows as the desk's /api/bulk hands them back: a
// spreadsheet is mapped row by row, with no model call.
const ROWS = [
  { type: 'event', subtype: 'Webinar-Online', title: 'Whoop Webinar: Counting Thumbs in Remote Classrooms', link: 'https://example.org/aggie/whoop-webinar', blurb: 'An hour on what a thumbs-up count says about attendance in an online class.', original_text: '' },
  { type: 'opportunity', subtype: 'Funding & Grants', title: 'Gig Em Foundation Small Research Grants', link: 'https://example.org/aggie/gig-em-grants', blurb: 'Up to $5,000 for a study of Texas school policy. Apply by December 4.', original_text: '' },
  { type: 'headline', subtype: 'Texas', title: 'Reveille Named Honorary Superintendent of Aggieland ISD', link: 'https://example.org/aggie/reveille-superintendent', blurb: '', original_text: '' },
];

const browser = await chromium.launch({ channel: 'chrome' });

async function open() {
  const page = await browser.newPage({ viewport: { width: W * Z, height: H * Z } });
  // An earlier run's practice items stay in the sandbox's memory; left in
  // view, the form would ask "Already in the queue" instead of adding.
  await page.route('**/api/sheet', async route => {
    if (route.request().method() !== 'GET') return route.fallback();
    const res = await route.fetch();
    const body = await res.json();
    body.rows = (body.rows ?? []).filter(r => !String(r.link ?? '').startsWith('https://example.org/aggie/'));
    await route.fulfill({ status: res.status(), json: body });
  });
  // The sandbox's own note on a save ("Sandbox: saved in memory only.") is never on the live desk.
  await page.route('**/api/submit', async route => {
    const res = await route.fetch();
    const body = await res.json();
    body.warnings = (body.warnings ?? []).filter(w => !/^Sandbox/.test(w));
    await route.fulfill({ status: res.status(), json: body });
  });
  await page.route('**/api/bulk', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    await new Promise(t => setTimeout(t, 1400));   // the zone reads the file's name meanwhile
    await route.fulfill({ json: { ok: true, counts: { event: 1, opportunity: 1, headline: 1 }, warnings: [], items: ROWS } });
  });
  await page.goto('http://localhost:4197/#team', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  // I need help!, in the top bar, is not part of any step. The page's
  // full-window height is a window again under the zoom, and the form's box
  // keeps a gap under it when it is scrolled to the foot of the window.
  await page.addStyleTag({ content: `html { zoom: ${Z}; } body, .desk { min-height: calc(100vh / ${Z}) !important; } .problem-top, .problem-fab, .problem-panel { display: none !important; } .form-box { scroll-margin-bottom: 24px; }` });
  await rest(page);
  return page;
}

const record = (page, name) => page.screencast.start({ path: here(name), size: { width: W * Z, height: H * Z } });
// The pointer off to the corner, so no control is left lit by it.
const rest = page => page.mouse.move(W * Z - 8, H * Z - 8);
// Brings the foot of the form's box to the foot of the window, in a smooth scroll unless told otherwise.
async function toFoot(page, behavior = 'smooth') {
  await page.evaluate(b => document.querySelector('.form-box').scrollIntoView({ block: 'end', behavior: b }), behavior);
  await page.waitForTimeout(behavior === 'smooth' ? 800 : 100);
}

async function fillIn() {
  const page = await open();
  await record(page, 'fill-in.webm');
  await page.waitForTimeout(1000);
  const link = page.getByLabel('Paste a link');
  await link.click();
  await page.waitForTimeout(400);
  await link.fill('https://example.org/aggie/policy-trivia-night');   // pasted, as the step says
  await page.waitForTimeout(800);
  await page.getByLabel(/^Title/).pressSequentially('Howdy Policy Trivia Night', { delay: 45 });
  await page.waitForTimeout(500);
  await toFoot(page);
  await page.getByLabel(/^Description/).pressSequentially('Teams of four answer questions on Texas education policy, with Reveille as the judge. Tuesday, November 10, 6:00 PM CT, MSC 2400.', { delay: 16 });
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Event', exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'A&M', exact: true }).click();
  await page.waitForTimeout(400);
  await toFoot(page);   // the subtypes pushed the form's foot down
  await page.locator('#sf-submitter').pressSequentially('RV', { delay: 140 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: here('1-form.png') });   // the poster: the form filled in
  await page.getByRole('button', { name: 'Add to the queue' }).click();
  await rest(page);
  await page.getByText('Added to').waitFor();
  await page.waitForTimeout(3200);
  await page.screencast.stop();
  await page.close();
}

async function bulk() {
  const page = await open();
  // The door in view at the foot of the window; the page follows it down as it opens.
  await toFoot(page, 'instant');
  await record(page, 'bulk.webm');
  await page.waitForTimeout(1000);
  await page.getByText('Add a doc or spreadsheet', { exact: true }).click();
  await rest(page);
  await page.waitForTimeout(500);
  await toFoot(page);
  // The spreadsheet dragged over the drop zone, then dropped on it.
  const bytes = [...readFileSync(new URL('../templates/erc-upload-template.xlsx', import.meta.url))];
  const file = await page.evaluateHandle(([b, type]) => {
    const t = new DataTransfer();
    t.items.add(new File([new Uint8Array(b)], 'howdy-list.xlsx', { type }));
    return t;
  }, [bytes, XLSX]);
  const zone = page.locator('.bulk-drop');
  await zone.dispatchEvent('dragenter', { dataTransfer: file });
  await zone.dispatchEvent('dragover', { dataTransfer: file });
  await page.waitForTimeout(900);
  await zone.dispatchEvent('drop', { dataTransfer: file });
  await page.locator('.bulk-review:not([hidden])').waitFor();
  await page.waitForTimeout(300);
  await toFoot(page);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: here('5-bulk-list.png') });   // the poster: the rows listed
  await page.getByRole('button', { name: 'Add 3 to the queue' }).click();
  await rest(page);
  await page.getByText('Added all 3 to the queue').waitFor();
  await page.waitForTimeout(3200);
  await page.screencast.stop();
  await page.close();
}

try {
  if (!only || only === 'fill-in') { await fillIn(); console.log('ok fill-in.webm, 1-form.png'); }
  if (!only || only === 'bulk') { await bulk(); console.log('ok bulk.webm, 5-bulk-list.png'); }
} finally {
  await browser.close();
}

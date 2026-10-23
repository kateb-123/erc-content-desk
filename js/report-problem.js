/**
 * Report a problem (Kate, Oct 22, 2026, the handoff): a button in the corner
 * of every desk page; Kathy types what went wrong and Send drops it into
 * Kate's Google Form in her personal Drive, whose answers go to a Sheet there
 * and email her. No server of ours is involved.
 *
 * To turn it on: make the form with three short-answer or paragraph
 * questions (What went wrong? / Which page? / Your name), then in the form
 * choose the three-dot menu, "Get pre-filled link", type WHAT, PAGE and WHO
 * in the three answers, "Get link", and paste that link below. Until then
 * the button does not show: no dead ends.
 */
export const PROBLEM_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScUL7E2SJzPA_6yeaRKnHEwQ-83Id5wHBF1jafzq8RpYqTtwg/viewform?usp=pp_url&entry.1596946882=WHAT&entry.1057870924=PAGE&entry.739829798=WHO';   // Kate's form, ERC Content Desk problems, in her personal Drive (Oct 23)

/** The form's address to post to and its three answer keys, from the pre-filled link; null without one. */
export function parsePrefill(url = PROBLEM_FORM_URL) {
  if (!url) return null;
  let u;
  try { u = new URL(url); } catch { return null; }
  const keys = {};
  for (const [k, v] of u.searchParams) {
    if (!k.startsWith('entry.')) continue;
    if (v === 'WHAT') keys.what = k;
    else if (v === 'PAGE') keys.page = k;
    else if (v === 'WHO') keys.who = k;
  }
  if (!keys.what) return null;
  return { action: `${u.origin}${u.pathname.replace(/\/viewform$/, '/formResponse')}`, fields: keys, open: url };
}

/** The answers as the form takes them. */
export function problemBody({ what, page, who }, fields) {
  const body = new URLSearchParams();
  body.set(fields.what, what);
  if (fields.page) body.set(fields.page, page);
  if (fields.who) body.set(fields.who, who);
  return body;
}

/** Draws the corner button and its panel on a desk page; nothing while there is no form. */
export function mountProblemButton(doc = document, url = PROBLEM_FORM_URL) {
  const form = parsePrefill(url);
  if (!form || doc.querySelector('.problem-fab')) return;
  if (!doc.querySelector('link[href^="/css/problem.css"]')) {
    const sheet = doc.createElement('link');
    sheet.rel = 'stylesheet'; sheet.href = '/css/problem.css?v=1';
    doc.head.append(sheet);
  }
  const fab = doc.createElement('button');
  fab.type = 'button';
  fab.className = 'problem-fab';
  fab.textContent = 'Report a problem';
  const panel = doc.createElement('form');
  panel.className = 'problem-panel';
  panel.hidden = true;
  panel.innerHTML = `<label for="problem-what">What went wrong?</label>
    <textarea id="problem-what" rows="4" required></textarea>
    <label for="problem-who">Your name</label>
    <input id="problem-who" type="text">
    <p class="problem-note">The page you are on is sent with it.</p>
    <div class="problem-actions"><button type="submit" class="problem-send">Send</button><button type="button" class="problem-cancel">Cancel</button></div>
    <p class="problem-said" role="status"></p>`;
  const what = panel.querySelector('#problem-what');
  const who = panel.querySelector('#problem-who');
  const said = panel.querySelector('.problem-said');
  try { who.value = localStorage.getItem('desk.problemWho') || ''; } catch { /* no storage, no memory */ }
  fab.addEventListener('click', () => { panel.hidden = !panel.hidden; said.textContent = ''; if (!panel.hidden) what.focus(); });
  panel.querySelector('.problem-cancel').addEventListener('click', () => { panel.hidden = true; fab.focus(); });
  panel.addEventListener('submit', async event => {
    event.preventDefault();
    if (!what.value.trim()) { said.textContent = 'Say what went wrong first.'; what.focus(); return; }
    try { localStorage.setItem('desk.problemWho', who.value.trim()); } catch { /* fine */ }
    const page = `${location.href}`;
    try {
      await fetch(form.action, { method: 'POST', mode: 'no-cors', body: problemBody({ what: what.value.trim(), page, who: who.value.trim() }, form.fields) });
      what.value = '';
      said.textContent = 'Sent.';
    } catch {
      said.innerHTML = '';
      const a = doc.createElement('a');
      a.href = form.open.replace('WHAT', encodeURIComponent(what.value.trim())).replace('PAGE', encodeURIComponent(page)).replace('WHO', encodeURIComponent(who.value.trim()));
      a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Open the form instead';
      said.append("Couldn't send from here. ", a);
    }
  });
  doc.body.append(panel, fab);
}

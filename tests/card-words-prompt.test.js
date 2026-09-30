import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import { CARD_SCHEMA, cardItems, buildCardPrompt, normalizeCards } from '../api/_lib/card-words.js';
import { hubRows } from '../api/_lib/highlights.js';
import { CSV_COLUMNS } from '../js/schema.js';

// The card words (Kate, Sep 30) are asked of the model at /api/rewrite when a
// highlight pick is an event, an ERC event or an opportunity: the item is
// found by its link on the desk (going out now) or on the live Exchange.

const HEADER = CSV_COLUMNS.join(',');
const CSV = `${HEADER}
2026-09-01,NAEP 2026,https://x.org/naep,research,Report,NAGB,,A research blurb.,,,,,,
2026-10-30,Rural Schools Symposium,https://x.org/rural,event,A&M,TAMU,,"The symposium returns to Rudder Tower. Sessions run all day, and lunch is provided.",,,,10:00 AM,Rudder Tower,
,SDP Fellowship,https://x.org/sdp,opportunity,Fellowships & Programs,Harvard,,A year in a district data office.,2026-11-01,,,,,
`;
const kept = o => blankRow({ status: 'kept', send_to: 'both', ...o });

test('cardItems finds each link on the desk first, then on the live Exchange, and only the card types', () => {
  const rows = [
    kept({ id: 'a', link: 'https://x.org/erc', headline: 'ERC workshop', type: 'erc_event', date: '2026-09-30', blurb: 'Come along.', original_text: 'The original page text.' }),
    kept({ id: 'b', link: 'https://x.org/naep2', headline: 'Research', type: 'research', subtype: 'Report', blurb: 'Findings.' }),
    kept({ id: 'c', link: 'https://x.org/rural', headline: 'Desk copy of the symposium', type: 'event', subtype: 'A&M', blurb: 'The desk knows it too.', published_at: '2026-09-01T00:00:00.000Z' }),
  ];
  const items = cardItems(['https://x.org/erc', 'https://x.org/naep2', 'https://x.org/rural', 'https://x.org/sdp', 'https://x.org/naep', 'https://x.org/nowhere', ''], { rows, hub: hubRows(CSV) });
  assert.deepEqual(items.map(i => [i.link, i.type, i.headline]), [
    ['https://x.org/erc', 'erc_event', 'ERC workshop'],
    ['https://x.org/rural', 'event', 'Desk copy of the symposium'],   // the desk's own row wins, published or not
    ['https://x.org/sdp', 'opportunity', 'SDP Fellowship'],
  ]);
  assert.equal(items[0].original_text, 'The original page text.');
  assert.equal(items[2].deadline, '2026-11-01');
});

test('the prompt carries the card rules and every item by its link', () => {
  const items = cardItems(['https://x.org/rural', 'https://x.org/sdp'], { rows: [], hub: hubRows(CSV) });
  const prompt = buildCardPrompt(items);
  assert.ok(prompt.includes('180'));
  assert.ok(prompt.includes('80'));
  assert.ok(/stars/i.test(prompt));
  assert.ok(/This study|Join us/.test(prompt));
  assert.ok(prompt.includes('link: https://x.org/rural'));
  assert.ok(prompt.includes('Rudder Tower'));
  assert.ok(prompt.includes('deadline: 2026-11-01'));
  assert.equal(CARD_SCHEMA.additionalProperties, false);
  assert.deepEqual(CARD_SCHEMA.properties.cards.items.required, ['link', 'title', 'summary']);
});

test('normalizeCards keeps one answer a known link, fitted to the card, and falls back to the item\'s own words', () => {
  const items = cardItems(['https://x.org/rural', 'https://x.org/sdp'], { rows: [], hub: hubRows(CSV) });
  const { cards, warnings } = normalizeCards({ cards: [
    { link: 'https://x.org/rural', title: 'Rural Schools Symposium', summary: 'Rural superintendents meet in Rudder Tower on October 30. '.repeat(5) },
    { link: 'https://x.org/rural', title: 'Again', summary: 'Second answer.' },
    { link: 'https://x.org/nowhere', title: 'x', summary: 'y' },
    { link: 'https://x.org/sdp', title: '', summary: '' },
  ] }, items);
  assert.deepEqual(cards.map(c => c.link), ['https://x.org/rural', 'https://x.org/sdp']);
  assert.ok(cards[0].summary.length <= 180);
  assert.ok(cards[0].summary.startsWith('Rural superintendents meet in Rudder Tower on October 30.'));
  assert.deepEqual(cards[1], { link: 'https://x.org/sdp', title: 'SDP Fellowship', summary: 'A year in a district data office.' });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /nowhere/);
});

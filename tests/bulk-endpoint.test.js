import test from 'node:test';
import assert from 'node:assert/strict';

// The endpoint constructs an Anthropic client at import; the spreadsheet
// paths under test never call it.
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';
const { default: handler } = await import('../api/bulk.js');

function fakeRes() {
  return {
    code: 0, body: null,
    status(code) { this.code = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

test('a .csv splits into row-mapped items with no model call', async () => {
  const res = fakeRes();
  await handler({
    method: 'POST',
    body: { name: 'sept-items.csv', text: 'Title,Description,URL,Type\nFall conference,Registration open.,https://x.org/c,event\nMystery,,,\n' },
  }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.items.length, 2);
  assert.equal(res.body.items[0].title, 'Fall conference');
  assert.equal(res.body.items[0].type, 'event');
  assert.equal(res.body.items[1].type, '');
  assert.equal(res.body.counts.untyped, 1);
});

test('a .xlsx upload round-trips through the real parser', async () => {
  const XLSX = await import('xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Headline', 'Link', 'Category', 'When'],
    ['Data symposium', 'https://x.org/s', 'Events', 'Sept 12'],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Items');
  const b64 = XLSX.write(book, { type: 'base64', bookType: 'xlsx' });
  const res = fakeRes();
  await handler({ method: 'POST', body: { name: 'draft.xlsx', file: b64 } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].title, 'Data symposium');
  assert.equal(res.body.items[0].type, 'event');
  assert.equal(res.body.items[0].original_text, 'When: Sept 12');
});

test('an oversized upload is refused before any parsing', async () => {
  const res = fakeRes();
  await handler({
    method: 'POST',
    body: { name: 'big.xlsx', file: Buffer.alloc(4 * 1024 * 1024).toString('base64') },
  }, res);
  assert.equal(res.code, 400);
  assert.match(res.body.error, /too big/);
});

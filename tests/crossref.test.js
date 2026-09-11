import test from 'node:test';
import assert from 'node:assert/strict';
import { doiFromUrl, crossrefText } from '../api/_lib/crossref.js';

test('doiFromUrl finds the DOI in publisher links and doi.org links, and nothing elsewhere', () => {
  assert.equal(doiFromUrl('https://journals.sagepub.com/doi/full/10.3102/0013189X261457389'), '10.3102/0013189X261457389');
  assert.equal(doiFromUrl('https://journals.sagepub.com/doi/10.1177/08959048261461454'), '10.1177/08959048261461454');
  assert.equal(doiFromUrl('https://direct.mit.edu/edfp/article/doi/10.1162/EDFP.a.446/135976/Changing-Buses'), '10.1162/EDFP.a.446');
  assert.equal(doiFromUrl('https://doi.org/10.3102/01623737261445984'), '10.3102/01623737261445984');
  assert.equal(doiFromUrl('https://www.nber.org/papers/w35670'), '');
  assert.equal(doiFromUrl(''), '');
});

const reply = {
  status: 'ok',
  message: {
    title: ['Identifying Structural Inequity During COVID-19'],
    author: [{ given: 'Motoko', family: 'Akiba' }, { given: 'Xiaonan', family: 'Jiang' }, { family: 'Ikoma' }],
    'container-title': ['Educational Researcher'],
    publisher: 'American Educational Research Association (AERA)',
    issued: { 'date-parts': [[2026, 6, 23]] },
    abstract: '<jats:p>The COVID-19 pandemic has <jats:italic>disproportionately</jats:italic> affected students.</jats:p>',
  },
};
const fakeFetch = (status, body) => async (url, opts) => ({ ok: status === 200, status, json: async () => body, _url: url, _opts: opts });

test('crossrefText turns a Crossref record into the plain text the reader files from', async () => {
  const calls = [];
  const text = await crossrefText('10.3102/0013189X261457389', async (url, opts) => { calls.push([url, opts]); return fakeFetch(200, reply)(url, opts); });
  assert.equal(calls[0][0], 'https://api.crossref.org/works/10.3102%2F0013189X261457389');
  assert.match(calls[0][1].headers['User-Agent'], /ERC Content Desk/);
  assert.match(text, /^Title: Identifying Structural Inequity During COVID-19$/m);
  assert.match(text, /^Authors: Motoko Akiba, Xiaonan Jiang, Ikoma$/m);
  assert.match(text, /^Published: 2026-06-23$/m);
  assert.match(text, /^Journal: Educational Researcher$/m);
  assert.match(text, /^Abstract: The COVID-19 pandemic has disproportionately affected students\.$/m);
  assert.doesNotMatch(text, /jats/);
});

test('crossrefText is empty when Crossref has no record, errors, or a month-only date is all it knows', async () => {
  assert.equal(await crossrefText('10.3102/nothing', fakeFetch(404, { status: 'error' })), '');
  assert.equal(await crossrefText('10.3102/boom', async () => { throw new Error('network'); }), '');
  const partial = { status: 'ok', message: { title: ['T'], issued: { 'date-parts': [[2026, 6]] } } };
  const text = await crossrefText('10.3102/partial', fakeFetch(200, partial));
  assert.match(text, /^Published: 2026-06$/m);
  assert.doesNotMatch(text, /Authors:/);
});

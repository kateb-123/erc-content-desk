import test from 'node:test';
import assert from 'node:assert/strict';
import { isFetchableUrl, pageTextFromHtml, truncateForPrompt, fetchPageText } from '../api/_lib/fetch-page.js';

test('isFetchableUrl allows public http(s) and nothing else', () => {
  assert.equal(isFetchableUrl('https://example.org/a'), true);
  assert.equal(isFetchableUrl('http://tea.texas.gov/x'), true);
  assert.equal(isFetchableUrl('javascript:alert(1)'), false);
  assert.equal(isFetchableUrl('ftp://example.org'), false);
  assert.equal(isFetchableUrl('https://localhost/admin'), false);
  assert.equal(isFetchableUrl('https://foo.localhost/x'), false);
  assert.equal(isFetchableUrl('https://192.168.1.10/x'), false);
  assert.equal(isFetchableUrl('https://[::1]/x'), false);
  assert.equal(isFetchableUrl('not a url'), false);
  assert.equal(isFetchableUrl(''), false);
});

test('pageTextFromHtml strips markup and scripts, decodes entities, collapses whitespace', () => {
  const html = '<html><head><style>p{color:red}</style><script>evil()</script></head>' +
    '<body><h1>Teacher   Pipeline</h1><p>Report &amp; findings &#39;2026&#39;&nbsp;here.</p></body></html>';
  assert.equal(pageTextFromHtml(html), "Teacher Pipeline Report & findings '2026' here.");
  assert.equal(pageTextFromHtml(''), '');
});

test('truncateForPrompt caps long text and passes short text through', () => {
  assert.equal(truncateForPrompt('abc', 5), 'abc');
  assert.equal(truncateForPrompt('abcdefgh', 5), 'abcde');
});

test('fetchPageText returns readable text from an HTML response', async () => {
  const fake = async () => new Response('<p>Hello <b>world</b></p>',
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  assert.equal(await fetchPageText('https://example.org/x', fake), 'Hello world');
});

test('fetchPageText returns empty on any failure path', async () => {
  const notOk = async () => new Response('nope', { status: 404, headers: { 'Content-Type': 'text/html' } });
  const wrongType = async () => new Response('%PDF-1.4', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
  const throws = async () => { throw new Error('network down'); };
  assert.equal(await fetchPageText('https://example.org/x', notOk), '');
  assert.equal(await fetchPageText('https://example.org/x', wrongType), '');
  assert.equal(await fetchPageText('https://example.org/x', throws), '');
  assert.equal(await fetchPageText('javascript:alert(1)', async () => new Response('hi')), '');
});

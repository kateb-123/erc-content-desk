import test from 'node:test';
import assert from 'node:assert/strict';
import { isFetchableUrl, pageTextFromHtml, truncateForPrompt, fetchPageText, resolvesPublic } from '../api/_lib/fetch-page.js';

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

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
  assert.equal(await fetchPageText('https://example.org/x', fake, publicLookup), 'Hello world');
});

test('fetchPageText returns empty on any failure path', async () => {
  const notOk = async () => new Response('nope', { status: 404, headers: { 'Content-Type': 'text/html' } });
  const wrongType = async () => new Response('%PDF-1.4', { status: 200, headers: { 'Content-Type': 'application/pdf' } });
  const throws = async () => { throw new Error('network down'); };
  assert.equal(await fetchPageText('https://example.org/x', notOk, publicLookup), '');
  assert.equal(await fetchPageText('https://example.org/x', wrongType, publicLookup), '');
  assert.equal(await fetchPageText('https://example.org/x', throws, publicLookup), '');
  assert.equal(await fetchPageText('javascript:alert(1)', async () => new Response('hi'), publicLookup), '');
});

test('resolvesPublic accepts a public address and rejects private/loopback/link-local ones', async () => {
  assert.equal(await resolvesPublic('example.org', publicLookup), true);
  assert.equal(await resolvesPublic('x', async () => [{ address: '10.0.0.5', family: 4 }]), false);
  assert.equal(await resolvesPublic('x', async () => [{ address: '169.254.169.254', family: 4 }]), false);
  assert.equal(await resolvesPublic('x', async () => [{ address: '::1', family: 6 }]), false);
  assert.equal(await resolvesPublic('x', async () => [{ address: 'fe80::1', family: 6 }]), false);
  assert.equal(await resolvesPublic('x', async () => [{ address: '::ffff:10.0.0.1', family: 6 }]), false);
  assert.equal(await resolvesPublic('x', async () => { throw new Error('nxdomain'); }), false);
  assert.equal(await resolvesPublic('x', async () => []), false);
});

test('fetchPageText follows one redirect to a fetchable public URL and returns its text', async () => {
  const fake = async (url) => {
    if (url === 'https://example.org/start') {
      return new Response(null, { status: 302, headers: { Location: 'https://example.org/final' } });
    }
    return new Response('<p>Landed</p>', { status: 200, headers: { 'Content-Type': 'text/html' } });
  };
  assert.equal(await fetchPageText('https://example.org/start', fake, publicLookup), 'Landed');
});

test('fetchPageText returns empty when a redirect points at a host that resolves private', async () => {
  const fake = async (url) => {
    if (url === 'https://example.org/start') {
      return new Response(null, { status: 302, headers: { Location: 'https://internal.example/final' } });
    }
    return new Response('<p>Should not reach here</p>', { status: 200, headers: { 'Content-Type': 'text/html' } });
  };
  const lookupImpl = async (host) => (host === 'internal.example'
    ? [{ address: '169.254.169.254', family: 4 }]
    : [{ address: '93.184.216.34', family: 4 }]);
  assert.equal(await fetchPageText('https://example.org/start', fake, lookupImpl), '');
});

test('fetchPageText returns empty after more than 5 redirect hops', async () => {
  let calls = 0;
  const fake = async () => {
    calls += 1;
    return new Response(null, { status: 302, headers: { Location: `https://example.org/hop${calls}` } });
  };
  assert.equal(await fetchPageText('https://example.org/start', fake, publicLookup), '');
  assert.equal(calls, 5);
});

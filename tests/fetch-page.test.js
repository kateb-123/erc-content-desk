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

test('resolvesPublic rejects the widened IPv4 blocklist and an fc00::/7 ULA address', async () => {
  assert.equal(await resolvesPublic('x', async () => [{ address: '240.0.0.1', family: 4 }]), false);
  assert.equal(await resolvesPublic('x', async () => [{ address: '255.255.255.255', family: 4 }]), false);
  assert.equal(await resolvesPublic('x', async () => [{ address: '198.18.0.5', family: 4 }]), false);
  assert.equal(await resolvesPublic('x', async () => [{ address: '198.19.0.5', family: 4 }]), false);
  assert.equal(await resolvesPublic('x', async () => [{ address: '192.0.0.10', family: 4 }]), false);
  assert.equal(await resolvesPublic('x', async () => [{ address: 'fd12::1', family: 6 }]), false);
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

test('fetchPageText enforces a shared time budget and bails before spending it', async () => {
  const realNow = Date.now;
  let calls = 0;
  // First Date.now() call records the start; every call after that reports
  // the budget as already blown, so no hop should ever call fetchImpl.
  Date.now = () => { calls += 1; return calls === 1 ? 0 : 999999; };
  const fake = async () => { throw new Error('fetchImpl should never be called once the budget is spent'); };
  try {
    assert.equal(await fetchPageText('https://example.org/x', fake, publicLookup), '');
  } finally {
    Date.now = realNow;
  }
});

test('fetchPageText rejects a response whose content-length exceeds the memory cap', async () => {
  const fake = async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('<p>short</p>')); controller.close(); },
  }), { status: 200, headers: { 'Content-Type': 'text/html', 'Content-Length': '5000000' } });
  assert.equal(await fetchPageText('https://example.org/x', fake, publicLookup), '');
});

test('fetchPageText reads a streaming body incrementally and truncates rather than hanging', async () => {
  const chunk = '<p>' + 'x'.repeat(1000) + '</p>';
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      if (cancelled) return;
      controller.enqueue(new TextEncoder().encode(chunk));
    },
    cancel() { cancelled = true; },
  });
  const fake = async () => new Response(stream, { status: 200, headers: { 'Content-Type': 'text/html' } });
  const result = await fetchPageText('https://example.org/x', fake, publicLookup);
  assert.ok(result.length > 0);
  assert.ok(result.length <= 12000);
  assert.equal(cancelled, true);
});

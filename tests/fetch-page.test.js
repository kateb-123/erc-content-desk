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

// The family is spelled out, never derived from the address: resolvesPublic
// branches on family === 6 for the IPv6 rules.
const PRIVATE = [
  ['10.0.0.5', 4], ['169.254.169.254', 4], ['240.0.0.1', 4], ['255.255.255.255', 4],
  ['198.18.0.5', 4], ['198.19.0.5', 4], ['192.0.0.10', 4],
  ['::1', 6], ['fe80::1', 6], ['::ffff:10.0.0.1', 6], ['fd12::1', 6],
];

test('resolvesPublic takes a public address and refuses every private, loopback, link-local, ULA and reserved one', async () => {
  assert.equal(await resolvesPublic('example.org', publicLookup), true);
  for (const [address, family] of PRIVATE) {
    assert.equal(await resolvesPublic('x', async () => [{ address, family }]), false, address);
  }
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

// Kate, Oct 6: a paper's page (EdWorkingPapers among them) carries the whole
// abstract in its description tag; the reader can take it from there.
test('pageDescription: the description tag, either attribute order, entities decoded; og:description as a fallback', async () => {
  const { pageDescription } = await import('../api/_lib/fetch-page.js');
  assert.equal(pageDescription('<meta name="description" content="Heat &amp; learning: it&#39;s real &#8212; in math." />'), "Heat & learning: it's real — in math.");
  assert.equal(pageDescription('<meta content="Order flipped." name="Description">'), 'Order flipped.');
  assert.equal(pageDescription('<meta property="og:description" content="From the card.">'), 'From the card.');
  assert.equal(pageDescription('<p>No tags</p>'), '');
});

// Kate's dry run, Oct 6: on some EdWorkingPapers pages the description tag is
// a shorter summary; the whole abstract is the page's body block (Drupal's
// field--name-body), and a journal's sits in an "abstract" block or its
// citation_abstract tag.
test('pageAbstracts: the body block, an abstract block, citation_abstract, then the description, each as text', async () => {
  const { pageAbstracts } = await import('../api/_lib/fetch-page.js');
  const drupal = '<meta name="description" content="Short summary."><div class="clearfix text-formatted field field--name-body field--type-text-with-summary"><p>How do changes in immigration policy affect attendance?</p><p>We find large effects &amp; no spillovers.</p></div><div class="field--name-field-wp-keywords">Keywords</div>';
  assert.deepEqual(pageAbstracts(drupal), ['How do changes in immigration policy affect attendance? We find large effects & no spillovers.', 'Short summary.']);
  assert.deepEqual(pageAbstracts('<section class="abstract"><h2>Abstract</h2><p>We study tutoring.</p></section>'), ['We study tutoring.'], 'the block\'s own heading is not the abstract');
  assert.deepEqual(pageAbstracts('<meta name="citation_abstract" content="A journal abstract.">'), ['A journal abstract.']);
  assert.deepEqual(pageAbstracts('<div class="field--name-body"><p>Site banner.</p></div><div class="field--name-body"><p>The paper\'s abstract.</p></div>'), ['Site banner.', "The paper's abstract."], 'every block, so the match can pick');
  assert.deepEqual(pageAbstracts('<div class="field--name-body"><div class="inner">Wrapper.</div><div class="field--name-body"><p>Nested abstract.</p></div></div>'), ['Wrapper.', 'Nested abstract.'], 'a block inside another is still read');
  assert.deepEqual(pageAbstracts('<p>Nothing marked</p>'), []);
});

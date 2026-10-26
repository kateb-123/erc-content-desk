// tests/scraper-sources.test.js: Add a source, the owner's pick "feeds run on
// their own" (Oct 24, 2026; .superpowers/tmp/oct23-options/data/sources.md,
// Option 2). Anyone on the open Content queue names a source; the desk checks
// the address for an RSS or Atom feed and writes a row to the Scraper sources
// Sheet through the Sheet's own script: a feed and switched on, no feed and
// off, or an email newsletter and off. Each run asks the desk for the Sheet's
// switched-on feeds (GET /api/bulk?sources=feeds, behind SCRAPER_TOKEN). The
// page is open, so the address is checked hard: http(s) only, never a private
// or local address, nor a name that resolves to one, and a time limit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import {
  sourceChecks, addressProblem, blockedIp, publicLookup, looksLikeFeed, feedLinks, findFeed, safeGet, fetchHop,
  addressKey, yamlSources, sourceObjects, feedSources, SOURCES_HEADER, COMMON_FEED_PATHS,
} from '../api/_lib/sources.js';
import { createScraperHandler } from '../api/_lib/scraper.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

function fakeRes() {
  return {
    code: 0, body: null,
    status(code) { this.code = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

const RSS = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Howdy Gazette</title><item><title>a</title></item></channel></rss>';
const ATOM = '﻿<?xml version="1.0"?><!-- made by hand --><feed xmlns="http://www.w3.org/2005/Atom"><title>Reveille Reads</title></feed>';
const RDF = '<?xml version="1.0"?><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><channel/></rdf:RDF>';
const PAGE = '<!doctype html><html><head><title>Howdy</title><link rel="stylesheet" href="/a.css"><link type="application/rss+xml" href="/news/feed/?x=1&amp;y=2" rel="alternate" title="News"></head><body>Gig em</body></html>';

/* ---- the form's fields ------------------------------------------------ */

test('sourceChecks: a name, a web address, a kind and what it posts, cleaned', () => {
  assert.deepEqual(sourceChecks({ name: '  Howdy   Policy Gazette ', address: ' example.org/howdy/feed/ ', kind: 'feed', type: 'headline' }),
    { name: 'Howdy Policy Gazette', address: 'https://example.org/howdy/feed/', kind: 'feed', type: 'headline' });
  assert.equal(sourceChecks({ name: 'Reveille Reads', address: 'http://example.org/news#top', kind: 'email', type: 'research' }).address, 'http://example.org/news', 'no fragment');
  const no = (body, field, words) => {
    const got = sourceChecks({ name: 'Howdy Gazette', address: 'https://example.org/feed/', kind: 'feed', type: 'event', ...body });
    assert.equal(got.field, field, JSON.stringify(body));
    assert.match(got.problem, words, JSON.stringify(body));
  };
  no({ name: '' }, 'name', /name/i);
  no({ name: 'x'.repeat(81) }, 'name', /80/);
  no({ name: '=HYPERLINK("https://evil.example")' }, 'name', /letter or a number/);
  no({ name: '@cmd' }, 'name', /letter or a number/);
  no({ name: 'Howdy\u0007Gazette' }, 'name', /name/i);
  no({ address: '' }, 'address', /address/i);
  no({ address: `https://example.org/${'a'.repeat(500)}` }, 'address', /too long/);
  no({ address: 'news@example.org' }, 'address', /web address, not its email address/);
  no({ address: 'mailto:news@example.org' }, 'address', /web address, not its email address/);
  no({ address: 'javascript:alert(1)' }, 'address', /http/);
  no({ address: 'ftp://example.org/feed' }, 'address', /http/);
  no({ address: 'file:///etc/passwd' }, 'address', /http/);
  no({ address: 'https://user:pass@example.org/feed' }, 'address', /public web address/);
  no({ address: 'https://example.org:8081/feed' }, 'address', /public web address/);
  no({ type: '' }, 'type', /what it posts/i);
  no({ type: 'gossip' }, 'type', /what it posts/i);
  no({ kind: 'carrier pigeon' }, 'kind', /kind/i);
});

test('addressProblem: never localhost, a private range, a link-local one or a name with no dot', () => {
  for (const url of [
    'http://localhost/feed', 'http://LOCALHOST./feed', 'http://feeds.localhost/', 'http://printer.local/', 'http://db.internal/', 'http://router.home.arpa/',
    'http://intranet/', 'http://127.0.0.1/', 'http://127.8.9.10/', 'http://10.0.0.5/', 'http://172.16.0.1/', 'http://172.31.255.255/',
    'http://192.168.1.1/', 'http://169.254.169.254/latest/meta-data/', 'http://0.0.0.0/', 'http://[::1]/', 'http://[::]/',
    'http://[::ffff:127.0.0.1]/', 'http://[fd00::1]/', 'http://[fe80::1]/', 'http://2130706433/', 'http://0x7f.0.0.1/', 'http://100.64.0.1/',
    'http://[::ffff:0:127.0.0.1]/', 'http://[fec0::1]/',
  ]) assert.ok(addressProblem(url), url);
  for (const url of ['https://example.org/feed/', 'http://www.example.org/rss.xml', 'https://example.org:443/feed', 'http://172.15.0.1/', 'http://172.32.0.1/', 'http://8.8.8.8/'])
    assert.equal(addressProblem(url), '', url);
});

test('blockedIp: every private, loopback, link-local and special range, in both families', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.5', '172.31.0.1', '192.168.0.10', '169.254.1.1', '0.0.0.0', '100.64.3.3', '224.0.0.1', '255.255.255.255',
    '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a00:1', 'fc00::1', 'fdab::2', 'fe80::1%en0', 'ff02::1', '64:ff9b::7f00:1', '2002:7f00:1::',
    // the IPv4-translated form of a private address, the old site-local range, Teredo and the discard prefix
    '::ffff:0:7f00:1', '::ffff:0:a9fe:a9fe', 'fec0::1', 'feff::1', '2001:0:4136:e378:8000:63bf:3fff:fdd2', '100::1', 'not an ip'])
    assert.equal(blockedIp(ip), true, ip);
  for (const ip of ['8.8.8.8', '93.184.216.34', '172.15.255.255', '172.32.0.0', '192.169.0.1', '2606:4700::1111', '::ffff:8.8.8.8', '2001:4860:4860::8888'])
    assert.equal(blockedIp(ip), false, ip);
});

test('publicLookup: a name that resolves to a private address is refused at connect, both ways Node asks', async () => {
  const dns = answers => (host, opts, cb) => cb(null, answers);
  const ask = (lookup, opts) => new Promise(resolve => lookup('feeds.example.org', opts, (err, ...rest) => resolve({ err, rest })));
  const bad = await ask(publicLookup(dns([{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.7', family: 4 }])), { all: true });
  assert.equal(bad.err?.code, 'EBLOCKED', 'one private answer is enough to refuse');
  const good = await ask(publicLookup(dns([{ address: '93.184.216.34', family: 4 }])), { all: true });
  assert.equal(good.err, null);
  assert.deepEqual(good.rest[0], [{ address: '93.184.216.34', family: 4 }]);
  const single = await ask(publicLookup(dns([{ address: '93.184.216.34', family: 4 }])), {});
  assert.deepEqual(single.rest, ['93.184.216.34', 4], 'the one-address form for a caller without all');
  const none = await ask(publicLookup((host, opts, cb) => cb(Object.assign(new Error('nope'), { code: 'ENOTFOUND' }))), {});
  assert.equal(none.err.code, 'ENOTFOUND');
});

/* ---- finding the feed ------------------------------------------------- */

test('looksLikeFeed: RSS, Atom and RDF, past a byte order mark, the declaration and comments; a page is not one', () => {
  assert.equal(looksLikeFeed(RSS), true);
  assert.equal(looksLikeFeed(ATOM), true);
  assert.equal(looksLikeFeed(RDF), true);
  assert.equal(looksLikeFeed(PAGE), false);
  assert.equal(looksLikeFeed('{"version": "https://jsonfeed.org/version/1"}'), false);
  assert.equal(looksLikeFeed(''), false);
});

test('feedLinks: a page\'s RSS and Atom links, whatever the attribute order, made whole against the page', () => {
  assert.deepEqual(feedLinks(PAGE, 'https://example.org/howdy/'), ['https://example.org/news/feed/?x=1&y=2']);
  const two = "<link rel='alternate' type='application/atom+xml' href='https://feeds.example.net/atom'><link rel=alternate type=application/rss+xml href=rss.xml><link rel=\"alternate\" type=\"text/html\" href=\"/es/\">";
  assert.deepEqual(feedLinks(two, 'https://example.org/blog/'), ['https://feeds.example.net/atom', 'https://example.org/blog/rss.xml']);
  assert.deepEqual(feedLinks('<link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">', 'https://example.org/'), [], 'only web addresses');
});

/** A fake web: address -> { status, text } or a redirect, recording each ask. */
function web(pages) {
  const asked = [];
  const get = async (url, { deadline } = {}) => {
    asked.push({ url, deadline });
    const page = pages[url];
    if (!page) return { status: 404, text: '', url };
    if (page.error) throw page.error;
    return { status: page.status ?? 200, text: page.text ?? '', url: page.url ?? url };
  };
  return { get, asked };
}

test('findFeed: the address itself, then the page\'s own feed link, then the usual places', async () => {
  const itself = web({ 'https://example.org/feed/': { text: RSS } });
  assert.deepEqual(await findFeed('https://example.org/feed/', { get: itself.get }), { feed: 'https://example.org/feed/' });

  const moved = web({ 'https://example.org/feed': { text: ATOM, url: 'https://example.org/feed/atom/' } });
  assert.deepEqual(await findFeed('https://example.org/feed', { get: moved.get }), { feed: 'https://example.org/feed/atom/' }, 'where a redirect landed');

  const linked = web({ 'https://example.org/howdy/': { text: PAGE }, 'https://example.org/news/feed/?x=1&y=2': { text: RSS } });
  assert.deepEqual(await findFeed('https://example.org/howdy/', { get: linked.get }), { feed: 'https://example.org/news/feed/?x=1&y=2' });

  assert.deepEqual(COMMON_FEED_PATHS, ['/feed/', '/rss.xml', '/feed.xml']);
  const usual = web({ 'https://example.org/about': { text: '<html><head></head></html>' }, 'https://example.org/rss.xml': { text: RSS } });
  assert.deepEqual(await findFeed('https://example.org/about', { get: usual.get }), { feed: 'https://example.org/rss.xml' });
  assert.deepEqual(usual.asked.map(a => a.url), ['https://example.org/about', 'https://example.org/feed/', 'https://example.org/rss.xml'], 'stops at the first feed');

  const none = web({ 'https://example.org/about': { text: '<html></html>' } });
  assert.deepEqual(await findFeed('https://example.org/about', { get: none.get }), { feed: '' });
  assert.equal(none.asked.length, 4, 'the page and the three usual places, nothing more');
});

test('findFeed: an address that does not answer, answers not found, or leads somewhere private is refused, not saved', async () => {
  const down = web({ 'https://example.org/': { error: Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }) } });
  assert.deepEqual(await findFeed('https://example.org/', { get: down.get }), { refused: 'unreachable' });
  const gone = web({});
  assert.deepEqual(await findFeed('https://example.org/missing', { get: gone.get }), { refused: 'missing' });
  const sneaky = web({ 'https://example.org/': { error: Object.assign(new Error('not public'), { code: 'EBLOCKED' }) } });
  assert.deepEqual(await findFeed('https://example.org/', { get: sneaky.get }), { refused: 'private' });
  // A page that turns robots away (403) is still a real site: the usual places are tried, then it is saved with no feed.
  const shy = web({ 'https://example.org/': { status: 403, text: 'no' } });
  assert.deepEqual(await findFeed('https://example.org/', { get: shy.get }), { feed: '' });
});

test('findFeed: one deadline for every ask, and it stops when the time is up', async () => {
  let clock = 1000;
  const pages = { 'https://example.org/about': { text: '<html></html>' } };
  const asked = [];
  const get = async (url, { deadline }) => { asked.push(deadline); clock += 6000; const p = pages[url]; return p ? { status: 200, text: p.text, url } : { status: 404, text: '', url }; };
  assert.deepEqual(await findFeed('https://example.org/about', { get, now: () => clock, budgetMs: 10000 }), { feed: '' });
  assert.ok(asked.every(d => d === 11000), 'the same deadline throughout');
  assert.equal(asked.length, 2, 'the page, one usual place, then the time is up');
});

test('safeGet: follows a redirect only to another public address, checking each hop before it is asked', async () => {
  const hops = [];
  const hop = async url => {
    hops.push(url);
    if (url === 'https://example.org/feed') return { status: 301, location: '/feed/', text: '' };
    if (url === 'https://example.org/feed/') return { status: 302, location: 'http://169.254.169.254/latest/', text: '' };
    return { status: 200, text: RSS };
  };
  await assert.rejects(safeGet('https://example.org/feed', { hop, deadline: Date.now() + 5000 }), err => err.code === 'EBLOCKED');
  assert.deepEqual(hops, ['https://example.org/feed', 'https://example.org/feed/'], 'the private hop is never asked');
  const loop = async url => ({ status: 302, location: url + 'x', text: '' });
  await assert.rejects(safeGet('https://example.org/', { hop: loop, deadline: Date.now() + 5000 }), /redirect/i);
  const ok = await safeGet('https://example.org/a', { hop: async url => (url.endsWith('/a') ? { status: 301, location: 'https://example.org/b', text: '' } : { status: 200, text: RSS }), deadline: Date.now() + 5000 });
  assert.equal(ok.url, 'https://example.org/b');
  assert.equal(ok.status, 200);
  await assert.rejects(safeGet('http://localhost/', { hop, deadline: Date.now() + 5000 }), err => err.code === 'EBLOCKED');
});

test('fetchHop: a name that resolves to this machine is refused on the real http stack, before any connection', async () => {
  const toHere = publicLookup((host, opts, cb) => cb(null, [{ address: '127.0.0.1', family: 4 }]));
  await assert.rejects(fetchHop('http://feeds.example.org/feed', { lookup: toHere, timeoutMs: 2000 }), err => err.code === 'EBLOCKED');
  const toMetadata = publicLookup((host, opts, cb) => cb(null, [{ address: '169.254.169.254', family: 4 }]));
  await assert.rejects(fetchHop('https://feeds.example.org/feed', { lookup: toMetadata, timeoutMs: 2000 }), err => err.code === 'EBLOCKED');
});

/** A stand-in for http.request: answers from a table, so the reading can be checked offline. */
function transport(answers) {
  const asked = [];
  const request = (u, options, onResponse) => {
    asked.push({ url: u.href, options });
    const req = new EventEmitter();
    req.destroyed = false;
    req.destroy = () => { req.destroyed = true; };
    req.end = () => {
      const a = answers[u.pathname];
      if (a.wait) return;   // never answers
      const res = Readable.from(a.chunks ?? [Buffer.from(a.body ?? '')]);
      res.statusCode = a.status ?? 200;
      res.headers = a.headers ?? {};
      onResponse(res);
    };
    return req;
  };
  return { request, asked };
}

test('fetchHop: reads a capped body, unzips it, hands back a redirect, and gives up on a slow answer', async () => {
  const t = transport({
    '/gz': { headers: { 'content-encoding': 'gzip' }, body: gzipSync(RSS) },
    '/big': { chunks: [Buffer.alloc(800, 'x'), Buffer.alloc(800, 'y')] },
    '/moved': { status: 301, headers: { location: '/gz' } },
    '/slow': { wait: true },
  });
  const base = 'https://feeds.example.org';
  assert.equal((await fetchHop(`${base}/gz`, { request: t.request })).text, RSS);
  const big = await fetchHop(`${base}/big`, { request: t.request, maxBytes: 1000 });
  assert.equal(big.text.length, 1000, 'read up to the cap, then the connection is dropped');
  const moved = await fetchHop(`${base}/moved`, { request: t.request });
  assert.deepEqual([moved.status, moved.location], [301, '/gz'], 'a redirect is handed back, not followed');
  await assert.rejects(fetchHop(`${base}/slow`, { request: t.request, timeoutMs: 50 }), err => err.code === 'ETIMEDOUT');
  assert.ok(t.asked.every(a => a.options.lookup && a.options.agent === false && /ERC Content Desk/.test(a.options.headers['User-Agent'])), 'every ask carries the guarded lookup and says who is asking');
});

/* ---- duplicates ------------------------------------------------------- */

test('addressKey: one address however it was typed', () => {
  assert.equal(addressKey('https://www.Example.org/Feed/'), addressKey('http://example.org/Feed'));
  assert.equal(addressKey('https://example.org/feed/#top'), addressKey('https://example.org/feed'));
  assert.notEqual(addressKey('https://example.org/feed?cat=2'), addressKey('https://example.org/feed'));
});

test('yamlSources: every listed source\'s name and address, switched on or parked, flow or block style', () => {
  const yaml = [
    'output_dir: "/tmp"',
    'education_keywords:',
    '  - school',
    'sources:',
    '  # ---------------- Events ----------------',
    '  - {name: Kinder Institute events, type: event, route: html, url: https://kinder.rice.edu/events, enabled: false, reason: "loads by script"}',
    '  - name: RAND events',
    '    type: event',
    '    route: feed',
    '    url: https://www.rand.org/events.xml',
    '    selectors:',
    '      item_url: "a.more"',
    '  - name: "AERA Open"',
    '    type: research',
    '    route: crossref',
    '    issn: 2332-8584',
    '  - {name: \'Brookings, events\', type: event, route: feed, url: "https://www.brookings.edu/?s=&post_type=event&feed=rss2"}',
  ].join('\n');
  assert.deepEqual(yamlSources(yaml), [
    { name: 'Kinder Institute events', url: 'https://kinder.rice.edu/events' },
    { name: 'RAND events', url: 'https://www.rand.org/events.xml' },
    { name: 'AERA Open', url: '' },
    { name: 'Brookings, events', url: 'https://www.brookings.edu/?s=&post_type=event&feed=rss2' },
  ]);
  assert.deepEqual(yamlSources(''), []);
});

test('sourceObjects and feedSources: the Sheet read by its own header; only switched-on feeds go to the run', () => {
  const sheet = {
    header: ['Source', 'Type', 'Subtype', 'Address', 'How it is read', 'Switched on', 'Why off'],
    rows: [
      ['Hechinger Report', 'headline', 'National', 'https://hechingerreport.org/feed/', 'feed', 'yes', ''],
      ['Howdy Gazette', 'Headlines', '', 'https://example.org/howdy/feed/', 'Feed', 'Yes', ''],
      ['Reveille Reads', 'research', '', 'https://example.org/reveille', 'no feed', 'no', 'No feed found'],
      ['Maroon Memo', 'event', '', 'https://example.org/memo', 'email newsletter', 'no', 'Arrives by email'],
      ['Parked feed', 'event', '', 'https://example.org/parked/feed', 'feed', 'no', 'too noisy'],
      ['Odd type', 'gossip', '', 'https://example.org/odd/feed', 'feed', 'yes', ''],
      ['No address', 'research', '', '', 'feed', 'yes', ''],
      ['AERA Open', 'research', 'Peer-Reviewed', '', 'crossref', 'yes', ''],
    ],
  };
  const objects = sourceObjects(sheet);
  assert.equal(objects[0].Source, 'Hechinger Report');
  assert.equal(objects[0]['How it is read'], 'feed');
  const reordered = sourceObjects({ header: ['Address', 'source', 'TYPE'], rows: [['https://example.org/x', 'X', 'event']] });
  assert.deepEqual([reordered[0].Source, reordered[0].Type, reordered[0].Address], ['X', 'event', 'https://example.org/x'], 'by the header\'s names, any case, any order');
  assert.deepEqual(sourceObjects({ header: [], rows: [['Y', 'event', '', 'https://example.org/y', 'feed', 'yes', '']] })[0].Address, 'https://example.org/y', 'no header: the seven columns in order');

  const { sources, unusable } = feedSources(objects);
  assert.deepEqual(sources, [
    { name: 'Hechinger Report', type: 'headline', subtype: 'National', url: 'https://hechingerreport.org/feed/', route: 'feed' },
    { name: 'Howdy Gazette', type: 'headline', subtype: '', url: 'https://example.org/howdy/feed/', route: 'feed' },
  ]);
  assert.deepEqual(unusable, [{ name: 'Odd type', why: 'Type is not event, research, headline or opportunity.' }, { name: 'No address', why: 'No web address.' }]);
  assert.deepEqual(SOURCES_HEADER, ['Source', 'Type', 'Subtype', 'Address', 'How it is read', 'Switched on', 'Why off']);
});

/* ---- the door: POST /api/bulk { action: 'source' } -------------------- */

const SHEET = {
  header: SOURCES_HEADER,
  rows: [['Hechinger Report', 'headline', 'National', 'https://hechingerreport.org/feed/', 'feed', 'yes', '']],
};
const YAML = 'sources:\n  - {name: RAND events, type: event, route: feed, url: https://www.rand.org/events.xml}\n';
const FORM = { action: 'source', name: 'Howdy Gazette', address: 'https://example.org/howdy/', kind: 'feed', type: 'headline' };
const DESK = { origin: 'https://erc-content-desk.vercel.app', host: 'erc-content-desk.vercel.app' };

function door({ sheet = SHEET, yaml = YAML, found = { feed: 'https://example.org/howdy/feed/' }, list, add } = {}) {
  const added = [];
  const looked = [];
  const handler = createScraperHandler({
    env: { SCRAPER_TOKEN: 'shared-secret' },
    listSources: list ?? (async () => sheet),
    addSource: add ?? (async source => { added.push(source); return { ok: true, added: true }; }),
    findFeed: async address => { looked.push(address); return found; },
    readYaml: async () => yaml,
  });
  const ask = async (body, headers = DESK) => {
    const res = fakeRes();
    assert.equal(handler.handles({ method: 'POST', query: {}, body, headers }), true);
    await handler.handle({ method: 'POST', query: {}, body, headers }, res);
    return res;
  };
  return { ask, added, looked, handler };
}

test('source: a feed found is written switched on, with the feed\'s own address', async () => {
  const d = door();
  const res = await d.ask(FORM);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { ok: true, outcome: 'feed', feed: 'https://example.org/howdy/feed/' });
  assert.deepEqual(d.looked, ['https://example.org/howdy/']);
  assert.deepEqual(d.added, [{ Source: 'Howdy Gazette', Type: 'headline', Subtype: '', Address: 'https://example.org/howdy/feed/', 'How it is read': 'feed', 'Switched on': 'yes', 'Why off': '' }]);
});

test('source: no feed is written switched off with the address typed; an email newsletter is never fetched', async () => {
  const none = door({ found: { feed: '' } });
  const res = await none.ask(FORM);
  assert.deepEqual(res.body, { ok: true, outcome: 'no feed', feed: '' });
  assert.deepEqual(none.added, [{ Source: 'Howdy Gazette', Type: 'headline', Subtype: '', Address: 'https://example.org/howdy/', 'How it is read': 'no feed', 'Switched on': 'no', 'Why off': 'No feed found' }]);

  const mail = door();
  const res2 = await mail.ask({ ...FORM, kind: 'email', address: 'https://example.org/signup' });
  assert.deepEqual(res2.body, { ok: true, outcome: 'email', feed: '' });
  assert.deepEqual(mail.looked, [], 'nothing is fetched for an email newsletter');
  assert.deepEqual(mail.added, [{ Source: 'Howdy Gazette', Type: 'headline', Subtype: '', Address: 'https://example.org/signup', 'How it is read': 'email newsletter', 'Switched on': 'no', 'Why off': 'Arrives by email' }]);
});

test('source: an address already in the Sheet or in sources.yaml says so, and nothing is written', async () => {
  const inSheet = door();
  const res = await inSheet.ask({ ...FORM, address: 'http://www.hechingerreport.org/feed' });
  assert.equal(res.code, 409);
  assert.equal(res.body.error, "Already on the scraper's list, as Hechinger Report.");
  assert.equal(res.body.field, 'address');
  assert.deepEqual(inSheet.looked, [], 'no fetch for a known address');
  assert.deepEqual(inSheet.added, []);

  const inYaml = door({ found: { feed: 'https://www.rand.org/events.xml' } });
  const res2 = await inYaml.ask({ ...FORM, address: 'https://www.rand.org/events/' });
  assert.equal(res2.code, 409, 'the feed it led to is on the list already');
  assert.equal(res2.body.error, "Already on the scraper's list, as RAND events.");
  assert.deepEqual(inYaml.added, []);

  const raced = door({ add: async () => ({ ok: true, added: false, duplicate: 'Howdy Gazette' }) });
  const res3 = await raced.ask(FORM);
  assert.equal(res3.code, 409, 'the script\'s own check, under its lock');
  assert.equal(res3.body.error, "Already on the scraper's list, as Howdy Gazette.");
});

test('source: before Code.gs is pasted, or with no SOURCES_SHEET_ID, the desk says the sheet is not connected', async () => {
  for (const message of [
    'Sheet API error: Unknown action: listSources',
    'Sheet API error: Server is not configured: the SOURCES_SHEET_ID script property is not set.',
    'SHEET_API_URL must be set',
  ]) {
    const d = door({ list: async () => { throw new Error(message); } });
    const res = await d.ask(FORM);
    assert.equal(res.code, 503, message);
    assert.equal(res.body.error, 'The sources sheet is not connected yet.');
    assert.deepEqual(d.looked, [], 'nothing fetched while there is nowhere to write');
  }
  const d = door({ list: async () => { throw new Error('Sheet API error: Couldn\'t get a lock'); } });
  const res = await d.ask(FORM);
  assert.equal(res.code, 502);
  assert.match(res.body.error, /sources sheet/);
  const late = door({ add: async () => { throw new Error('Sheet API error: Unknown action: addSource'); } });
  assert.equal((await late.ask(FORM)).body.error, 'The sources sheet is not connected yet.');
  // No GitHub token: the Sheet is still checked, the run dedupes against sources.yaml itself.
  const noYaml = door({ yaml: '' });
  assert.equal((await noYaml.ask(FORM)).code, 200);
});

test('source: a bad field, a page from elsewhere, or an address that will not answer is refused with words for the form', async () => {
  const d = door();
  const bad = await d.ask({ ...FORM, address: 'http://192.168.1.1/feed' });
  assert.equal(bad.code, 400);
  assert.equal(bad.body.field, 'address');
  assert.match(bad.body.error, /public web address/);
  const empty = await d.ask({ ...FORM, name: '' });
  assert.equal(empty.body.field, 'name');
  const away = await d.ask(FORM, { origin: 'https://evil.example', host: 'erc-content-desk.vercel.app' });
  assert.equal(away.code, 403);
  const bare = await d.ask(FORM, { host: 'erc-content-desk.vercel.app' });
  assert.equal(bare.code, 403, 'no origin at all is not the desk either');
  const local = await d.ask(FORM, { origin: 'http://localhost:4197', host: 'localhost:4197' });
  assert.equal(local.code, 200, 'the sandbox');
  assert.equal(d.added.length, 1);

  for (const [refused, words] of [['unreachable', /couldn't reach/i], ['missing', /Nothing is at that address/], ['private', /public web address/]]) {
    const r = door({ found: { refused } });
    const res = await r.ask(FORM);
    assert.equal(res.code, 422, refused);
    assert.match(res.body.error, words);
    assert.equal(res.body.field, 'address');
    assert.deepEqual(r.added, [], 'nothing saved');
  }
});

/* ---- the run's door: GET /api/bulk?sources=feeds ---------------------- */

test('sources=feeds: the token in the Authorization header, then the switched-on feeds and the rows the run cannot use', async () => {
  const sheet = { header: SOURCES_HEADER, rows: [...SHEET.rows, ['Reveille Reads', 'research', '', 'https://example.org/r', 'no feed', 'no', 'No feed found'], ['Odd type', 'gossip', '', 'https://example.org/odd/feed', 'feed', 'yes', '']] };
  const d = door({ sheet });
  const get = async headers => {
    const req = { method: 'GET', query: { sources: 'feeds' }, body: {}, headers };
    assert.equal(d.handler.handles(req), true);
    const res = fakeRes();
    await d.handler.handle(req, res);
    return res;
  };
  assert.equal((await get({})).code, 401);
  assert.equal((await get({ authorization: 'Bearer wrong' })).code, 401);
  const ok = await get({ authorization: 'Bearer shared-secret' });
  assert.equal(ok.code, 200);
  assert.deepEqual(ok.body, {
    ok: true,
    sources: [{ name: 'Hechinger Report', type: 'headline', subtype: 'National', url: 'https://hechingerreport.org/feed/', route: 'feed' }],
    unusable: [{ name: 'Odd type', why: 'Type is not event, research, headline or opportunity.' }],
  });
  const quiet = door({ list: async () => { throw new Error('Sheet API error: Unknown action: listSources'); } });
  const res = fakeRes();
  await quiet.handler.handle({ method: 'GET', query: { sources: 'feeds' }, body: {}, headers: { authorization: 'Bearer shared-secret' } }, res);
  assert.equal(res.code, 503);
  assert.equal(res.body.error, 'The sources sheet is not connected yet.');
  const noSecret = createScraperHandler({ env: {}, listSources: async () => SHEET });
  const res2 = fakeRes();
  await noSecret.handle({ method: 'GET', query: { sources: 'feeds' }, body: {}, headers: { authorization: 'Bearer ' } }, res2);
  assert.equal(res2.code, 401, 'an unset secret refuses everything');
});

/* ---- the wiring ------------------------------------------------------- */

test('the bulk door, the Sheet wrappers and the script carry the two new actions; the sheet id is a script property', () => {
  const bulk = read('../api/bulk.js');
  assert.match(bulk, /import \{ saveFile, appendScrape, listSources, addSource \} from '\.\/_lib\/sheets\.js';/);
  assert.match(bulk, /createScraperHandler\(\{ saveFile, appendScrape, readSchedule, listSources, addSource \}\)/);
  const sheets = read('../api/_lib/sheets.js');
  assert.match(sheets, /export async function listSources\(/);
  assert.match(sheets, /callSheetApi\('listSources'/);
  assert.match(sheets, /export async function addSource\(/);
  assert.match(sheets, /callSheetApi\('addSource'/);
  const gs = read('../apps-script/Code.gs');
  assert.match(gs, /case 'listSources':/);
  assert.match(gs, /case 'addSource':\s*\n\s*return withLock\(/, 'the write holds the lock, so two adds cannot both pass the duplicate check');
  assert.match(gs, /SOURCES_SHEET_ID/);
  assert.doesNotMatch(gs, /19gAAU4OTxGrfYqitBS3Nx9KjfIbE4qW_7C51Lq_pZhw/, 'the id lives in the script property, never in the file');
  const add = gs.slice(gs.indexOf('function handleAddSource'), gs.indexOf('function handleAddSource') + 3000);
  assert.match(add, /sourceKey\(/, 'the script checks the address against every row');
  assert.match(add, /plainCell\(/, 'every cell is written as plain text');
  assert.doesNotMatch(gs.slice(gs.indexOf('function handleListSources')), /deleteRow|clearContent|setTrashed/, 'the sources code never removes anything');
  assert.match(gs, /\/\^\[=\+\\-@\]\//, 'a cell that would start a formula is written as text');
  const readme = read('../README.md');
  assert.ok(readme.includes('SOURCES_SHEET_ID'), 'README names SOURCES_SHEET_ID');
  const connections = read('../docs/handbook/connections.md');
  assert.match(connections, /Scraper sources/);
  assert.match(connections, /SOURCES_SHEET_ID/);
  assert.match(connections, /sources=feeds/);
});

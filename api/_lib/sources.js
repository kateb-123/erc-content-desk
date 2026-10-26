/**
 * Add a source, the owner's pick "feeds run on their own" (Oct 24, 2026;
 * .superpowers/tmp/oct23-options/data/sources.md, Option 2).
 *
 * Anyone on the Content queue names a source for the scraper to watch. The
 * desk checks the address for an RSS or Atom feed (the address itself, the
 * page's own feed link, then /feed/, /rss.xml and /feed.xml) and writes one
 * row to the Scraper sources Sheet through the Sheet's own script (Code.gs,
 * addSource): a feed and switched on, no feed and off, or an email newsletter
 * and off, since an email newsletter cannot be scraped (docs/inbox-idea.md is
 * the parked plan for those). Each run asks the desk for the Sheet's
 * switched-on feeds and reads them as plain feeds, no code.
 *
 * The Content queue is open, so the address is held hard: http(s) only, the
 * usual ports, no name or password in it, never localhost, a private, a
 * link-local or a special range, and never a name that resolves to one. The
 * resolve is checked where the socket connects (publicLookup), so a name
 * cannot point somewhere else between the check and the fetch, and every
 * redirect is checked again before it is asked. One time limit covers every
 * ask, and a page is read up to a cap.
 *
 * Server-side only. Nothing here holds a secret.
 */
import http from 'node:http';
import https from 'node:https';
import { lookup as dnsLookup } from 'node:dns';
import { isIP } from 'node:net';
import zlib from 'node:zlib';

/** The Sheet's columns (sources.md A1), and the run's four types. */
export const SOURCES_HEADER = ['Source', 'Type', 'Subtype', 'Address', 'How it is read', 'Switched on', 'Why off'];
export const SOURCE_TYPE_KEYS = ['event', 'research', 'headline', 'opportunity'];
export const SOURCE_KIND_KEYS = ['feed', 'email'];
/** Where a site keeps its feed when its page does not say (sources.md, Option 2). */
export const COMMON_FEED_PATHS = ['/feed/', '/rss.xml', '/feed.xml'];

const MAX_NAME = 80;
const MAX_ADDRESS = 500;
const FEED_BUDGET_MS = 10000;   // every ask for one source, together
const HOP_MS = 5000;            // one ask
const MAX_BYTES = 1024 * 1024;  // a feed's start or a page's head is all the check needs
const MAX_REDIRECTS = 4;
const USER_AGENT = 'ERC Content Desk feed check (+https://erc-content-desk.vercel.app)';
const LOCAL_NAMES = /(^|\.)(localhost|local|internal|lan|home\.arpa)$/;

export const PUBLIC_ONLY = 'Use a public web address, like https://example.org/feed.';
export const WEB_ONLY = 'Use a web address that starts with http:// or https://.';

const refused = (message, code = 'EBLOCKED') => Object.assign(new Error(message), { code });

/* ---- addresses -------------------------------------------------------- */

function v4Blocked([a, b, c]) {
  return a === 0 || a === 10 || a === 127
    || (a === 100 && b >= 64 && b <= 127)     // carrier-grade NAT
    || (a === 169 && b === 254)               // link-local, the cloud's metadata
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;                              // multicast and reserved
}

/** An IPv6 address as its eight numbers; a dotted IPv4 tail is folded in. */
function hextets(ip) {
  let text = ip;
  const tail = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (tail) {
    const [a, b, c, d] = tail[1].split('.').map(Number);
    text = `${text.slice(0, -tail[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, rest] = text.split('::');
  const left = head ? head.split(':') : [];
  const right = rest === undefined ? [] : (rest ? rest.split(':') : []);
  const fill = rest === undefined ? [] : Array(8 - left.length - right.length).fill('0');
  return [...left, ...fill, ...right].map(h => parseInt(h || '0', 16));
}

const embeddedV4 = (hi, lo) => [hi >> 8, hi & 255, lo >> 8, lo & 255];

/** True for anything the desk must never ask: private, loopback, link-local,
 *  multicast and the other special ranges, in both families, and anything
 *  that is not an address at all. */
export function blockedIp(address) {
  const ip = String(address ?? '').replace(/^\[|\]$/g, '').split('%')[0];
  const family = isIP(ip);
  if (family === 4) return v4Blocked(ip.split('.').map(Number));
  if (family !== 6) return true;
  const h = hextets(ip.toLowerCase());
  if (h.length !== 8 || h.some(n => Number.isNaN(n))) return true;
  if (h.slice(0, 7).every(n => n === 0) && h[7] <= 1) return true;                       // :: and ::1
  if (h.slice(0, 5).every(n => n === 0) && (h[5] === 0xffff || h[5] === 0)) return v4Blocked(embeddedV4(h[6], h[7]));   // mapped, compatible
  if (h.slice(0, 4).every(n => n === 0) && h[4] === 0xffff && h[5] === 0) return v4Blocked(embeddedV4(h[6], h[7]));    // IPv4-translated
  if (h[0] === 0x64 && h[1] === 0xff9b) return v4Blocked(embeddedV4(h[6], h[7]));          // NAT64
  if (h[0] === 0x2002) return v4Blocked(embeddedV4(h[1], h[2]));                          // 6to4
  if (h[0] === 0x2001 && h[1] === 0) return true;                                         // Teredo
  if (h[0] === 0x0100 && h.slice(1, 4).every(n => n === 0)) return true;                  // discard
  if ((h[0] & 0xfe00) === 0xfc00) return true;                                            // unique local
  if ((h[0] & 0xff80) === 0xfe80) return true;                                            // link-local and the old site-local
  if ((h[0] & 0xff00) === 0xff00) return true;                                            // multicast
  if (h[0] === 0x2001 && h[1] === 0x0db8) return true;                                    // documentation
  return false;
}

/** '' when the desk may ask this address, else why not. The URL parser has
 *  already folded 0x7f.0.0.1 and 2130706433 into 127.0.0.1. */
export function addressProblem(url) {
  let u;
  try { u = new URL(String(url ?? '')); } catch { return WEB_ONLY; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return WEB_ONLY;
  if (u.username || u.password) return PUBLIC_ONLY;
  if (u.port && !['80', '443'].includes(u.port)) return PUBLIC_ONLY;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return WEB_ONLY;
  if (host.startsWith('[') || isIP(host)) return blockedIp(host) ? PUBLIC_ONLY : '';
  if (!host.includes('.') || LOCAL_NAMES.test(host)) return PUBLIC_ONLY;
  return '';
}

/** The address as typed, made whole: a bare "example.org/feed" gets https://,
 *  a fragment goes; a mailto:, a javascript: and the like are not web addresses. */
function webAddress(text) {
  const raw = String(text ?? '').trim();
  if (!raw.includes('://') && /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(raw)) return { problem: WEB_ONLY };
  const full = raw.includes('://') ? raw : `https://${raw}`;
  const problem = addressProblem(full);
  if (problem) return { problem };
  const u = new URL(full);
  u.hash = '';
  return { address: u.href };
}

/** What is wrong with the form, or the fields cleaned: { problem, field } or
 *  { name, address, kind, type }. */
export function sourceChecks(body) {
  const name = String(body?.name ?? '').replace(/\s+/g, ' ').trim();
  const say = (field, problem) => ({ field, problem });
  if (!name) return say('name', "Type the source's name.");
  if (/[\u0000-\u001f\u007f]/.test(String(body?.name ?? '').replace(/[\t\n\r]/g, ' '))) return say('name', 'Type the name as plain words.');
  if (name.length > MAX_NAME) return say('name', `Keep the name under ${MAX_NAME} characters.`);
  if (!/^[\p{L}\p{N}]/u.test(name)) return say('name', 'Start the name with a letter or a number.');
  const typed = String(body?.address ?? '').trim();
  if (!typed) return say('address', 'Type its address.');
  if (typed.length > MAX_ADDRESS) return say('address', 'That address is too long.');
  if (/^(mailto:)?[^\s@/:]+@[^\s@/]+\.[^\s@/]+$/i.test(typed)) return say('address', "Use the newsletter's web address, not its email address.");
  const { address, problem } = webAddress(typed);
  if (problem) return say('address', problem);
  const type = String(body?.type ?? '');
  if (!SOURCE_TYPE_KEYS.includes(type)) return say('type', 'Pick what it posts.');
  const kind = String(body?.kind ?? '');
  if (!SOURCE_KIND_KEYS.includes(kind)) return say('kind', 'Pick a kind: site or feed, or email newsletter.');
  return { name, address, kind, type };
}

/** One address however it was typed: scheme, www, a fragment and trailing
 *  slashes do not make a different source; the path and query do. */
export function addressKey(url) {
  return String(url ?? '').trim().toLowerCase()
    .replace(/#.*$/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
}

/* ---- asking the web --------------------------------------------------- */

/** A DNS lookup for http.request that refuses at connect time when any answer
 *  is not public, in the one-address and the all-addresses forms Node uses. */
export function publicLookup(dnsImpl = dnsLookup) {
  return (hostname, options, callback) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    dnsImpl(hostname, { all: true, family: options?.family ?? 0 }, (err, answers) => {
      if (err) return callback(err);
      const list = Array.isArray(answers) ? answers : [];
      if (!list.length) return callback(refused(`No address for ${hostname}.`, 'ENOTFOUND'));
      if (list.some(a => blockedIp(a.address))) return callback(refused(`${hostname} is not a public address.`));
      if (options?.all) return callback(null, list);
      return callback(null, list[0].address, list[0].family);
    });
  };
}

const guardedLookup = publicLookup();

/** One GET, no redirect followed: { status, location, text }. The connection
 *  goes only where publicLookup allows; the body is read up to maxBytes,
 *  unzipped when the server zipped it. `request` is http.request (a test
 *  hands in a stand-in, since a test may not open a port). */
const nodeRequest = (u, options, onResponse) => (u.protocol === 'https:' ? https : http).request(u, options, onResponse);

export function fetchHop(url, { lookup = guardedLookup, timeoutMs = HOP_MS, maxBytes = MAX_BYTES, request = nodeRequest } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { reject(refused(WEB_ONLY, 'EBADURL')); return; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') { reject(refused(WEB_ONLY, 'EBADURL')); return; }
    let settled = false;
    const finish = (fn, value) => { if (!settled) { settled = true; clearTimeout(timer); fn(value); } };
    const req = request(u, {
      method: 'GET', agent: false, lookup,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, text/html;q=0.8, */*;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    }, res => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        finish(resolve, { status, location: String(res.headers.location), text: '' });
        return;
      }
      const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase();
      const unzip = encoding.includes('gzip') ? zlib.createGunzip() : encoding === 'deflate' ? zlib.createInflate() : encoding === 'br' ? zlib.createBrotliDecompress() : null;
      const stream = unzip ? res.pipe(unzip) : res;
      const chunks = [];
      let size = 0;
      const done = () => finish(resolve, { status, location: '', text: Buffer.concat(chunks).toString('utf8') });
      stream.on('data', chunk => {
        if (settled) return;
        const room = maxBytes - size;
        chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
        size += Math.min(chunk.length, room);
        if (size >= maxBytes) { done(); req.destroy(); }
      });
      stream.on('end', done);
      stream.on('error', err => finish(reject, err));
    });
    const timer = setTimeout(() => { finish(reject, refused('The site timed out.', 'ETIMEDOUT')); req.destroy(); }, timeoutMs);
    req.on('error', err => finish(reject, err));
    req.end();
  });
}

/** A GET that follows redirects by hand, checking each address before it is
 *  asked, all inside one deadline: { status, text, url } where url is where it landed. */
export async function safeGet(url, { hop = fetchHop, deadline = Date.now() + FEED_BUDGET_MS, now = Date.now } = {}) {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const problem = addressProblem(current);
    if (problem) throw refused(problem);
    const left = deadline - now();
    if (left <= 0) throw refused('The site timed out.', 'ETIMEDOUT');
    const reply = await hop(current, { timeoutMs: Math.min(HOP_MS, left) });
    if (reply.location) {
      try { current = new URL(reply.location, current).href; } catch { throw refused(WEB_ONLY, 'EBADURL'); }
      continue;
    }
    return { status: reply.status, text: reply.text ?? '', url: current };
  }
  throw refused('Too many redirects.', 'EREDIRECTS');
}

/* ---- feeds ------------------------------------------------------------ */

/** RSS, Atom or RDF: the first element after the declaration, comments and a doctype. */
export function looksLikeFeed(text) {
  const head = String(text ?? '').slice(0, 4000).replace(/^﻿/, '')
    .replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<!DOCTYPE[^>]*>/gi, '').trimStart();
  return /^<(rss|feed|rdf:RDF)[\s>]/i.test(head);
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = s => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

/** A page's own RSS and Atom links (<link rel="alternate" type=...>), whole. */
export function feedLinks(html, base) {
  const out = [];
  for (const tag of String(html ?? '').match(/<link\b[^>]*>/gi) ?? []) {
    const attrs = {};
    for (const m of tag.matchAll(/([a-z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    if (!String(attrs.rel ?? '').toLowerCase().split(/\s+/).includes('alternate')) continue;
    if (!/^application\/(rss|atom)\+xml/i.test(String(attrs.type ?? '').trim())) continue;
    let url;
    try { url = new URL(decode(String(attrs.href ?? '').trim()), base); } catch { continue; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
    url.hash = '';
    if (!out.includes(url.href)) out.push(url.href);
  }
  return out;
}

const blockedError = err => err?.code === 'EBLOCKED';

/** The feed behind an address: { feed } (the feed's address, or '' when there
 *  is none), or { refused } when the address cannot be used at all:
 *  'private' (it leads somewhere private), 'unreachable', or 'missing' (404). */
export async function findFeed(address, { get = safeGet, now = Date.now, budgetMs = FEED_BUDGET_MS } = {}) {
  const deadline = now() + budgetMs;
  const ask = async url => { try { return await get(url, { deadline }); } catch (error) { return { error }; } };
  const first = await ask(address);
  if (first.error) return { refused: blockedError(first.error) ? 'private' : 'unreachable' };
  if (first.status === 404 || first.status === 410) return { refused: 'missing' };
  const answered = first.status < 400;
  if (answered && looksLikeFeed(first.text)) return { feed: first.url };
  const landed = first.url || address;
  const tried = new Set([addressKey(address), addressKey(landed)]);
  const candidates = [
    ...(answered ? feedLinks(first.text, landed).slice(0, 3) : []),
    ...COMMON_FEED_PATHS.map(path => new URL(path, landed).href),
  ];
  for (const url of candidates) {
    if (tried.has(addressKey(url))) continue;
    tried.add(addressKey(url));
    if (now() >= deadline) break;
    const reply = await ask(url);
    if (!reply.error && reply.status < 400 && looksLikeFeed(reply.text)) return { feed: reply.url };
  }
  return { feed: '' };
}

/* ---- the lists the desk checks against -------------------------------- */

const unquote = v => String(v ?? '').trim().replace(/^"(.*)"$/s, '$1').replace(/^'(.*)'$/s, '$1').trim();

/** sources.yaml's sources, switched on or parked, as { name, url } (url '' for
 *  the ones read another way). Read by line, not a YAML library: the file's
 *  list items are "  - " at the list's indent, in flow or block style. */
export function yamlSources(text) {
  const lines = String(text ?? '').split('\n');
  const start = lines.findIndex(l => /^sources:\s*$/.test(l));
  if (start < 0) return [];
  const entries = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;   // the next top-level key
    if (/^ {2}- /.test(line)) entries.push([line.slice(4)]);
    else if (entries.length && /^ {4}\S/.test(line)) entries.at(-1).push(line.slice(4));
  }
  const field = (entry, key) => {
    const first = entry[0];
    if (first.startsWith('{')) {
      const m = new RegExp(`(?:^\\{|,)\\s*${key}:\\s*("[^"]*"|'[^']*'|[^,}]+)`).exec(first);
      return m ? unquote(m[1]) : '';
    }
    for (const line of entry) {
      const m = new RegExp(`^${key}:\\s*(.*)$`).exec(line);
      if (m) return unquote(m[1]);
    }
    return '';
  };
  return entries.map(e => ({ name: field(e, 'name'), url: field(e, 'url') }));
}

/** The Sheet's rows as objects under SOURCES_HEADER, read by the Sheet's own
 *  header in any order and case; with no header, the seven columns in order. */
export function sourceObjects({ header = [], rows = [] } = {}) {
  const names = (header ?? []).map(h => String(h ?? '').trim().toLowerCase());
  const at = SOURCES_HEADER.map((h, i) => (names.some(Boolean) ? names.indexOf(h.toLowerCase()) : i));
  return (rows ?? []).map(values => Object.fromEntries(SOURCES_HEADER.map((h, i) => [h, at[i] >= 0 ? String(values?.[at[i]] ?? '').trim() : ''])));
}

const TYPE_WORDS = { event: 'event', events: 'event', research: 'research', 'new ed policy research': 'research', headline: 'headline', headlines: 'headline', opportunity: 'opportunity', opportunities: 'opportunity' };
const SWITCHED_ON = /^(yes|y|true|on)$/i;

/** What a run reads from the Sheet: the rows read as a feed and switched on,
 *  as plain feed sources, and the ones it cannot use with why. */
export function feedSources(objects) {
  const sources = [];
  const unusable = [];
  for (const o of objects) {
    if (o['How it is read'].toLowerCase() !== 'feed' || !SWITCHED_ON.test(o['Switched on'])) continue;
    const type = TYPE_WORDS[o.Type.toLowerCase()];
    if (!o.Source) { unusable.push({ name: o.Address || '(no name)', why: 'No name.' }); continue; }
    if (!type) { unusable.push({ name: o.Source, why: 'Type is not event, research, headline or opportunity.' }); continue; }
    if (!/^https?:\/\/\S+$/i.test(o.Address)) { unusable.push({ name: o.Source, why: 'No web address.' }); continue; }
    sources.push({ name: o.Source, type, subtype: o.Subtype, url: o.Address, route: 'feed' });
  }
  return { sources, unusable };
}

/** The row the form writes (sources.md A1's columns). */
export function sourceRow({ name, type, address, how, on, why }) {
  return { Source: name, Type: type, Subtype: '', Address: address, 'How it is read': how, 'Switched on': on, 'Why off': why };
}

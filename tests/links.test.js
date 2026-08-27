import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeLink, safeHref } from '../js/links.js';

test('isSafeLink accepts http and https only', () => {
  assert.equal(isSafeLink('https://example.org/a'), true);
  assert.equal(isSafeLink('http://example.org/a'), true);
  assert.equal(isSafeLink('HTTPS://EXAMPLE.ORG'), true);
  assert.equal(isSafeLink('  https://example.org  '), true);
});

test('isSafeLink rejects script and data schemes, however they are dressed up', () => {
  assert.equal(isSafeLink('javascript:alert(1)'), false);
  assert.equal(isSafeLink('JaVaScRiPt:alert(1)'), false);
  assert.equal(isSafeLink('  javascript:alert(1)'), false);
  assert.equal(isSafeLink('java\tscript:alert(1)'), false);
  assert.equal(isSafeLink('data:text/html,<script>alert(1)</script>'), false);
  assert.equal(isSafeLink('vbscript:msgbox(1)'), false);
});

test('isSafeLink rejects blanks, non-strings, and schemeless values', () => {
  assert.equal(isSafeLink(''), false);
  assert.equal(isSafeLink('   '), false);
  assert.equal(isSafeLink(undefined), false);
  assert.equal(isSafeLink(null), false);
  assert.equal(isSafeLink(42), false);
  assert.equal(isSafeLink('example.org'), false);
  assert.equal(isSafeLink('//example.org'), false);
  assert.equal(isSafeLink('/relative/path'), false);
});

test('safeHref returns the trimmed link when safe and an empty string otherwise', () => {
  assert.equal(safeHref('  https://example.org/a  '), 'https://example.org/a');
  assert.equal(safeHref('javascript:alert(1)'), '');
  assert.equal(safeHref(undefined), '');
});

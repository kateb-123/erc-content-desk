// tests/markdown-lite.test.js: the draft as reading text (Kate, Oct 22, her
// pick A: "I wish the proof was easier to read like just on the webpage").
// A small renderer for the markdown the desk itself writes: headings,
// paragraphs with bold, italics and line breaks, lists, tables, links, the
// cover lines folded into one, and every character escaped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../js/markdown-lite.js';

test('headings, paragraphs and inline marks', () => {
  assert.equal(renderMarkdown('# Title\n\n## Executive Summary\n\nWords with *italics*, **bold** and a [link](https://x.y/z).\n\n### Finding 1\n\nMore.'),
    '<h1>Title</h1><h2>Executive Summary</h2><p>Words with <em>italics</em>, <strong>bold</strong> and a <a href="https://x.y/z" target="_blank" rel="noopener">link</a>.</p><h3>Finding 1</h3><p>More.</p>');
});

test('a single newline inside a paragraph is a line break, the way the highlights are written', () => {
  assert.equal(renderMarkdown('**01. Greeted students felt more at home.**\nBelonging was 12 percentage points higher.'),
    '<p><strong>01. Greeted students felt more at home.</strong><br>Belonging was 12 percentage points higher.</p>');
});

test('the cover lines fold into one muted line and the rule disappears', () => {
  assert.equal(renderMarkdown('# T\n\n**ERC Research Brief | October 2026**\n\n**Study authors:** A · B\n**Research Brief author:** Kate Barnes\n\n---\n\n## Executive Summary\n\nX.'),
    '<h1>T</h1><p class="brief-cover">ERC Research Brief | October 2026 · Study authors: A · B · Research Brief author: Kate Barnes</p><h2>Executive Summary</h2><p>X.</p>');
});

test('numbered and bulleted lists, with bold inside', () => {
  assert.equal(renderMarkdown('1. **Review timing.**\nWhy it matters.\n2. **Count courses.**\nBecause.'),
    '<ol><li><strong>Review timing.</strong><br>Why it matters.</li><li><strong>Count courses.</strong><br>Because.</li></ol>');
  assert.equal(renderMarkdown('- one\n- two'), '<ul><li>one</li><li>two</li></ul>');
});

test('a table becomes a table, the separator row dropped, cells escaped', () => {
  assert.equal(renderMarkdown('| Group | Courses |\n|---|---|\n| Never EL | 2.60 |\n| Middle <school> | 1.51 |'),
    '<table><thead><tr><th>Group</th><th>Courses</th></tr></thead><tbody><tr><td>Never EL</td><td>2.60</td></tr><tr><td>Middle &lt;school&gt;</td><td>1.51</td></tr></tbody></table>');
});

test('nothing the model writes can become markup: tags and attributes are text', () => {
  const html = renderMarkdown('<script>alert(1)</script> and a [bad](javascript:alert(1)) link and "quotes" & ampersands');
  assert.ok(!/<script>/.test(html));
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.ok(!/javascript:/.test(html), 'a link that is not http(s) is plain text');
  assert.match(html, /&quot;quotes&quot; &amp; ampersands/);
});

test('empty and odd input', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown(null), '');
  assert.equal(renderMarkdown('plain words\n\n\n\nmore'), '<p>plain words</p><p>more</p>');
});

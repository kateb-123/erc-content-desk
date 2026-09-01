// editpath.test.js
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { getField, setField } from '../js/editpath.js';
import { parseMarkdown, _resetIds } from '../js/parser.js';
import { readFileSync } from 'node:fs';
const issue = () => { _resetIds(); return parseMarkdown(readFileSync(new URL('../fixtures/full-issue.md', import.meta.url),'utf8')).issue; };
test('get/set a field by section+item+field', () => {
  const i = issue(); const item = i.sections.events.items[0];
  setField(i, {section:'events', item:item.id, field:'title'}, 'NEW T');
  assert.equal(getField(i, {section:'events', item:item.id, field:'title'}), 'NEW T');
});
test('get/set intro', () => {
  const i = issue(); setField(i, {section:'intro', field:'intro'}, 'hi'); assert.equal(i.intro, 'hi');
});

// editpath.test.js
import { test } from 'node:test'; import assert from 'node:assert/strict';
import { getField, setField } from '../js/editpath.js';
import { createEmptyIssue } from '../js/model.js';
const issue = () => {
  const i = createEmptyIssue();
  i.sections.events.items.push({ id: 'itm_1', group: 'tamu', fields: { title: 'An event', url: 'https://x.org/e' } });
  i.sections.events.enabled = true;
  return i;
};
test('get/set a field by section+item+field', () => {
  const i = issue(); const item = i.sections.events.items[0];
  setField(i, {section:'events', item:item.id, field:'title'}, 'NEW T');
  assert.equal(getField(i, {section:'events', item:item.id, field:'title'}), 'NEW T');
});
test('get/set intro', () => {
  const i = issue(); setField(i, {section:'intro', field:'intro'}, 'hi'); assert.equal(i.intro, 'hi');
});

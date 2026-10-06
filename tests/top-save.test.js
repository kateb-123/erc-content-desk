import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Kate, Oct 6: "when you click and edit anything, I want a save options up
// top too on the box." Her pick: every edit box with a Save gets Save and
// Cancel at its top as well as its foot, doing the same thing. Both build
// the DOM, so they are read.
const form = readFileSync(new URL('../js/edit-form.js', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../builder/js/app.js', import.meta.url), 'utf8');

test("the desk's edit box (Finalize, Next issue, Publish) has Save and Cancel at its top and its foot, one action each", () => {
  assert.match(form, /el\('div', 'f-edit-actions f-edit-top'\)/);
  assert.match(form, /wrap\.prepend\(top\)/);
  assert.match(form, /focus: 'edit-save-top', onClick: doSave/);
  assert.match(form, /focus: 'edit-cancel-top', onClick: doCancel/);
  assert.match(form, /focus: 'edit-save',\s*onClick: doSave/);
});

test("the builder's cards with a Save carry it at the top too: the item, the callout, the introduction", () => {
  assert.match(builder, /function topActions\(card\)/);
  for (const fn of ['openItemEditor', 'openCalloutEditor', 'openPanelInDrawer']) {
    const body = builder.match(new RegExp(`function ${fn}\\([\\s\\S]*?\\n\\}`))?.[0] ?? '';
    assert.match(body, /topActions\(card\)/, fn);
  }
});

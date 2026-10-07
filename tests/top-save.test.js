import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Kate, Oct 6: "when you click and edit anything, I want a save options up
// top too on the box." Her pick: every edit box with a Save gets Save and
// Cancel at its top as well as its foot, doing the same thing. The desk's
// edit box keeps that. The builder's cards changed on Oct 7 ("Done up top"):
// every edit there is live, so one Done in the head closes a card, and the
// foot holds the quiet words (Remove, Use original, Undo changes); an Add
// card takes an × and its own Add to the issue. Both build the DOM, so they
// are read.
const form = readFileSync(new URL('../js/edit-form.js', import.meta.url), 'utf8');
const builder = readFileSync(new URL('../builder/js/app.js', import.meta.url), 'utf8');

test("the desk's edit box (Finalize, Next issue, Publish) has Save and Cancel at its top and its foot, one action each", () => {
  assert.match(form, /el\('div', 'f-edit-actions f-edit-top'\)/);
  assert.match(form, /wrap\.prepend\(top\)/);
  assert.match(form, /focus: 'edit-save-top', onClick: doSave/);
  assert.match(form, /focus: 'edit-cancel-top', onClick: doCancel/);
  assert.match(form, /focus: 'edit-save',\s*onClick: doSave/);
});

test("the builder's cards close with one Done in the head (Kate, Oct 7): the item, the callout and the introduction; an Add card takes an × and its own Add to the issue", () => {
  assert.match(builder, /function drawerCard\(name, \{ closeWord = 'Done' \} = \{\}\)/);
  assert.match(builder, /button\(closeWord, 'btn btn-primary drawer-card-done', \{ onClick: closeDrawer \}\)/);
  const bodyOf = (fn) => builder.match(new RegExp(`function ${fn}\\([\\s\\S]*?\\n\\}`))?.[0] ?? '';
  for (const fn of ['openItemEditor', 'openCalloutEditor']) {
    const body = bodyOf(fn);
    assert.match(body, /drawerCard\(name\)/, `${fn}: Done in the head`);
    assert.doesNotMatch(body, /'Save'|'Cancel'/, `${fn}: no Save or Cancel, the edits are live`);
    assert.match(body, /' Undo changes'/, fn);
    assert.match(body, /' Use original'/, fn);
  }
  for (const fn of ['openPanelInDrawer', 'openAddCalloutCard']) {
    const body = bodyOf(fn);
    assert.match(body, /closeWord: ''/, `${fn}: an × in the head`);
    assert.match(body, /button\('Cancel', 'ghost-btn ghost-btn--muted'/, fn);
    assert.match(body, /Add to the issue|addon-primary/, `${fn}: its own Add at the foot`);
  }
  assert.doesNotMatch(builder, /topActions|drawer-card-top/, 'the top Save pair is gone');
});

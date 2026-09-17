/**
 * The one edit form (audit round two, e11). Sort's card and Finalize's card
 * open the same thing: the fields the row's type uses, then the link and the
 * media, on the grey edit box, dates as date inputs. It opens with editBase,
 * so a description prefilled from the original text is no change until it is
 * edited (e8), and it knows when it holds unsaved typing, so any way out of it
 * can hold instead of throwing the typing away (e4).
 */
import { editFields, editBase, editChanges, dateField } from './finalize-view.js';
import { buildImageControl } from './item-image.js';
import { withScheme } from './links.js';

const FIELD_TITLES = {
  headline: 'Title', date: 'Date', source: 'Source', topic: 'Topic',
  blurb: 'Description', deadline: 'Deadline', authors: 'Authors',
  time: 'Time', location: 'Location', link: 'Link',
};
// A title, a source, the authors, a description or a link needs the whole row to be read.
const WIDE = new Set(['headline', 'source', 'authors', 'blurb', 'link']);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** The form for one row. onSave gets only the fields that changed. */
export function buildEditForm(row, { onSave, onCancel }) {
  const base = editBase(row);
  const fields = editFields(row.type);
  let dirty = false;
  const wrap = el('div', 'f-edit-card');
  const grid = el('div', 'f-edit-grid');
  const inputs = {};
  for (const field of fields) {
    const label = el('label', WIDE.has(field) ? 'f-edit-wide' : '', FIELD_TITLES[field] ?? field);
    const input = field === 'blurb' ? el('textarea') : el('input');
    if (field === 'blurb') input.rows = 4;
    else input.type = dateField(field) ? 'date' : field === 'link' ? 'url' : 'text';
    input.value = base[field] ?? '';
    inputs[field] = input;
    label.append(input);
    grid.append(label);
  }
  // Any item can carry a picture or a flyer (Kate, Sep 17). A div, not a
  // label: a label would forward stray clicks to the upload button.
  const media = el('div', 'f-edit-media f-edit-wide', 'Media');
  const imgCtl = buildImageControl(row.infographic, () => { dirty = true; });
  media.append(imgCtl.el);
  grid.append(media);
  wrap.append(grid);
  wrap.addEventListener('input', () => { dirty = true; });

  const actions = el('div', 'f-edit-actions');
  const save = el('button', 'primary', 'Save');
  save.type = 'button';
  save.dataset.focus = 'edit-save';
  save.addEventListener('click', () => {
    const values = Object.fromEntries(fields.map(field => [field, inputs[field].value]));
    if ('link' in values) values.link = withScheme(values.link);
    dirty = false;
    onSave(editChanges(row, { ...values, infographic: imgCtl.get() }, base));
  });
  const cancel = el('button', 'btn-outline', 'Cancel');
  cancel.type = 'button';
  cancel.dataset.focus = 'edit-cancel';
  cancel.addEventListener('click', () => { dirty = false; onCancel(); });
  actions.append(save, cancel);
  wrap.append(actions);
  return { el: wrap, isDirty: () => dirty };
}

/** A way out of an open, edited form holds instead: the card says so in
 *  place and the typing stays (design audit b1, every exit since round two).
 *  True when it held. */
export function holdIfDirty(form, card) {
  if (!form?.isDirty()) return false;
  if (card && !card.querySelector('.edit-warn')) {
    const note = el('p', 'field-error edit-warn', 'Save or cancel this edit first.');
    note.setAttribute('role', 'status');
    card.prepend(note);
  }
  card?.querySelector('input, textarea')?.focus({ preventScroll: true });
  return true;
}

/**
 * The one edit form. Sort's card and Finalize's card
 * open the same thing: the fields the row's type uses, then the link and the
 * media, on the grey edit box, dates as date inputs. It opens with editBase,
 * so a description prefilled from the original text is no change until it is
 * edited, and it knows when it holds unsaved typing, so any way out of it
 * can hold instead of throwing the typing away.
 */
import { editFields, editBase, editChanges, dateField, sendToChange } from './finalize-view.js';
import { TYPES, typeDisplay, subtypesFor } from './schema.js';
import { sendTo } from './workflow.js';
import { buildImageControl } from './item-image.js';
import { withScheme } from './links.js';
import { el, button } from './ui-aids.js';

const FIELD_TITLES = {
  headline: 'Title', date: 'Date', source: 'Source', topic: 'Topic',
  blurb: 'Description', deadline: 'Deadline', authors: 'Authors',
  time: 'Time', location: 'Location', link: 'Link',
};
// A title, a source, the authors, a description or a link needs the whole row to be read.
const WIDE = new Set(['headline', 'source', 'authors', 'blurb', 'link']);

/** The form for one row. onSave gets only the fields that changed. */
export function buildEditForm(row, { onSave, onCancel }) {
  const base = editBase(row);
  const fields = editFields(row.type, row.subtype);
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
  // Where it sits and where it goes (review, Oct 23): after a Keep, the type,
  // the subtype and the Send it to box were reachable nowhere, so a mistake
  // could only be deleted. A changed type keeps the fields drawn; Save stores it.
  const typeLabel = el('label', '', 'Type');
  const typeSel = el('select');
  typeSel.dataset.focus = 'edit-type';
  for (const key of ['', ...Object.keys(TYPES)]) {
    const o = el('option', '', key ? typeDisplay(key) : 'Pick one');
    o.value = key;
    if (key === (row.type ?? '')) o.selected = true;
    typeSel.append(o);
  }
  typeLabel.append(typeSel);
  const subLabel = el('label', '', 'Subtype');
  const subSel = el('select');
  subSel.dataset.focus = 'edit-subtype';
  const fillSubtypes = () => {
    const list = subtypesFor(typeSel.value);
    subSel.replaceChildren(...['', ...list].map(v => { const o = el('option', '', v || (list.length ? 'Pick one' : 'None')); o.value = v; return o; }));
    subSel.value = list.includes(row.subtype) && typeSel.value === row.type ? row.subtype : '';
    subSel.disabled = !list.length;
  };
  fillSubtypes();
  typeSel.addEventListener('change', () => { fillSubtypes(); dirty = true; });
  subLabel.append(subSel);
  const onlyLabel = el('label', 'check f-edit-wide');
  const onlyBox = el('input');
  onlyBox.type = 'checkbox';
  onlyBox.checked = !sendTo(row).exchange;
  onlyBox.dataset.focus = 'edit-newsletter-only';
  onlyLabel.append(onlyBox, ' ERC Newsletter only');
  grid.append(typeLabel, subLabel, onlyLabel);
  // Any item can carry a picture or a flyer. A div, not a
  // label: a label would forward stray clicks to the upload button.
  const media = el('div', 'f-edit-media f-edit-wide', 'Media');
  const imgCtl = buildImageControl(row.infographic, () => { dirty = true; });
  media.append(imgCtl.el);
  grid.append(media);
  wrap.append(grid);
  wrap.addEventListener('input', () => { dirty = true; });

  const doSave = () => {
    const values = Object.fromEntries(fields.map(field => [field, inputs[field].value]));
    if ('link' in values) values.link = withScheme(values.link);
    dirty = false;
    const where = editChanges(row, { type: typeSel.value, subtype: subSel.value });
    onSave({ ...editChanges(row, { ...values, infographic: imgCtl.get() }, base), ...where, ...sendToChange(row, onlyBox.checked) });
  };
  const doCancel = () => { dirty = false; onCancel(); };
  const actions = el('div', 'f-edit-actions');
  const save = button('Save', 'primary', {
    focus: 'edit-save',
    onClick: doSave,
  });
  const cancel = button('Cancel', 'btn-outline', { focus: 'edit-cancel', onClick: doCancel });
  actions.append(save, cancel);
  wrap.append(actions);
  // The same pair at the box's top (Kate, Oct 6: "a save options up top too"),
  // so a long form saves without a trip to its foot.
  const top = el('div', 'f-edit-actions f-edit-top');
  top.append(button('Save', 'primary', { focus: 'edit-save-top', onClick: doSave }), button('Cancel', 'btn-outline', { focus: 'edit-cancel-top', onClick: doCancel }));
  wrap.prepend(top);
  return { el: wrap, isDirty: () => dirty };
}

/** A way out of an open, edited form holds instead: the card says so in
 *  place and the typing stays. True when it held. */
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

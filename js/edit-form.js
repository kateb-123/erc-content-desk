/**
 * The one edit form. Sort's card and Finalize's card
 * open the same thing: the fields the row's type uses, then the link and the
 * media, on the grey edit box, dates as date inputs. It opens with editBase,
 * so a description prefilled from the original text is no change until it is
 * edited, and it knows when it holds unsaved typing, so any way out of it
 * can hold instead of throwing the typing away.
 *
 * Since Oct 23 it also carries the Type, the Subtype and ERC Newsletter only,
 * so a kept item's routing can be fixed after Keep. The review of that day
 * shaped it: a new type redraws the fields it uses (what was typed carries
 * over), Save waits for a real type and subtype, and the box follows a type
 * change until she touches it.
 */
import { editFields, editBase, editChanges, dateField, sendToChange } from './finalize-view.js';
import { TYPES, typeDisplay, subtypesFor, isValidType, isValidSubtype } from './schema.js';
import { sendTo, sendToValue } from './workflow.js';
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
  let dirty = false;
  const wrap = el('div', 'f-edit-card');
  const grid = el('div', 'f-edit-grid');
  const fieldBox = el('div', 'f-edit-fields');
  fieldBox.style.display = 'contents';
  let inputs = {};
  let fields = [];

  // The fields the type uses; what was typed carries over to a field both types use.
  const drawFields = (type, subtype) => {
    const typed = Object.fromEntries(Object.entries(inputs).map(([k, input]) => [k, input.value]));
    fields = editFields(type, subtype);
    inputs = {};
    fieldBox.replaceChildren();
    for (const field of fields) {
      const label = el('label', WIDE.has(field) ? 'f-edit-wide' : '', FIELD_TITLES[field] ?? field);
      const input = field === 'blurb' ? el('textarea') : el('input');
      if (field === 'blurb') input.rows = 4;
      else input.type = dateField(field) ? 'date' : field === 'link' ? 'url' : 'text';
      input.value = field in typed ? typed[field] : (base[field] ?? '');
      inputs[field] = input;
      label.append(input);
      fieldBox.append(label);
    }
  };
  drawFields(row.type, row.subtype);
  grid.append(fieldBox);

  // Where it sits and where it goes.
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
  subLabel.append(subSel);
  const onlyLabel = el('label', 'check f-edit-wide');
  const onlyBox = el('input');
  onlyBox.type = 'checkbox';
  onlyBox.checked = !sendTo(row).exchange;
  onlyBox.dataset.focus = 'edit-newsletter-only';
  let boxTouched = false;
  onlyBox.addEventListener('change', () => { boxTouched = true; });
  onlyLabel.append(onlyBox, ' ERC Newsletter only');
  const whereError = el('p', 'field-error f-edit-wide');
  whereError.hidden = true;
  whereError.setAttribute('role', 'alert');
  // A new type or subtype: the fields it uses, and the box's default for it until she touches the box.
  const retyped = () => {
    whereError.hidden = true;
    drawFields(typeSel.value, subSel.value);
    if (!boxTouched) onlyBox.checked = !sendTo({ ...row, type: typeSel.value, subtype: subSel.value, send_to: '' }).exchange;
    dirty = true;
  };
  typeSel.addEventListener('change', () => { fillSubtypes(); retyped(); });
  subSel.addEventListener('change', retyped);
  grid.append(typeLabel, subLabel, onlyLabel, whereError);

  // Any item can carry a picture or a flyer. A div, not a
  // label: a label would forward stray clicks to the upload button.
  const media = el('div', 'f-edit-media f-edit-wide', 'Media');
  const imgCtl = buildImageControl(row.infographic, () => { dirty = true; });
  media.append(imgCtl.el);
  grid.append(media);
  wrap.append(grid);
  wrap.addEventListener('input', () => { dirty = true; });

  const doSave = () => {
    // A kept item never loses its place by accident: a real type and subtype first.
    if (!isValidType(typeSel.value) || !isValidSubtype(typeSel.value, subSel.value)) {
      whereError.textContent = isValidType(typeSel.value) ? 'Pick a subtype first.' : 'Pick a type first.';
      whereError.hidden = false;
      (isValidType(typeSel.value) ? subSel : typeSel).focus();
      return;
    }
    const values = Object.fromEntries(fields.map(field => [field, inputs[field].value]));
    if ('link' in values) values.link = withScheme(values.link);
    const where = editChanges(row, { type: typeSel.value, subtype: subSel.value });
    // A changed type writes the box out, so the routing she sees is the one stored.
    const box = Object.keys(where).length
      ? (String(row.send_to ?? '') === sendToValue({ newsletter: true, exchange: !onlyBox.checked }) ? {} : { send_to: sendToValue({ newsletter: true, exchange: !onlyBox.checked }) })
      : sendToChange(row, onlyBox.checked);
    dirty = false;
    onSave({ ...editChanges(row, { ...values, infographic: imgCtl.get() }, base), ...where, ...box });
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

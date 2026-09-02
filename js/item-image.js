/**
 * Picture upload for desk items — the same loop the builder uses for
 * newsletter items (its app.js keeps a local copy): PNG/JPG/GIF/WebP go up
 * as-is, a PDF's first page is rasterized in-browser first, and the value
 * is the public URL POST /api/newsletter-image hands back. On desk rows the
 * URL lives in the `infographic` column, which rides the hub CSV on publish
 * and becomes the newsletter item's picture on pull.
 */
import { dotsLoader, loadingLabel } from './icons.js';

/** PDF flyers become a PNG in the browser (first page) so email clients can
 *  show them — pdf.js loads lazily from the CDN only when a PDF arrives. */
async function pdfFirstPageToPng(file) {
  const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await doc.getPage(1);
  const scale = 1200 / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  // intent 'print' keeps the raster off requestAnimationFrame, which browsers
  // pause in a background tab — otherwise switching tabs mid-upload leaves the
  // conversion stuck on "Converting the PDF" until you come back.
  await page.render({ canvasContext: canvas.getContext('2d'), viewport, intent: 'print' }).promise;
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Couldn't convert that PDF."))), 'image/png'));
}

const IMAGE_EXTS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

/** Upload one picture (PNG/JPG/GIF/WebP, or a PDF's first page) → public URL. */
async function uploadItemImage(file, onStatus) {
  let blob = file;
  let ext = IMAGE_EXTS[file.type];
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    onStatus('Converting the PDF…');
    blob = await pdfFirstPageToPng(file);
    ext = 'png';
  }
  if (!ext) throw new Error("Use a PNG, JPG, or PDF.");
  if (blob.size > 2.5 * 1024 * 1024) throw new Error('Too big — keep it under 2.5 MB.');
  onStatus('Uploading…');
  const b64 = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(blob);
  });
  const res = await fetch('/api/newsletter-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: file.name, type: ext, file: b64 }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'upload failed');
  return data.url;
}

/** The picture control: Upload (or Replace) + Remove picture; the value is a
 *  URL. The button hides while a file is in flight — no double uploads. */
export function buildImageControl(initial, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'img-upload';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.png,.jpg,.jpeg,.gif,.webp,.pdf';
  fileInput.hidden = true;
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'btn-outline';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'linkish skip-link';
  removeBtn.textContent = 'Remove media';
  const status = document.createElement('span');
  status.className = 'img-status';
  let value = initial || '';
  const sync = () => {
    pick.textContent = value ? 'Replace media' : 'Upload media';
    removeBtn.hidden = !value;
  };
  const setStatus = (msg, busy = false) => {
    if (busy && msg) status.replaceChildren(dotsLoader(true), loadingLabel(msg));
    else status.textContent = msg;
  };
  pick.addEventListener('click', () => fileInput.click());
  removeBtn.addEventListener('click', () => {
    value = '';
    onChange('');
    setStatus('');
    sync();
  });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    pick.hidden = true;
    removeBtn.hidden = true;
    try {
      value = await uploadItemImage(file, msg => setStatus(msg, true));
      onChange(value);
      setStatus('Added.');
    } catch (err) {
      setStatus(err.message);
    }
    fileInput.value = '';
    pick.hidden = false;
    sync();
  });
  sync();
  wrap.append(pick, removeBtn, status, fileInput);
  return {
    el: wrap,
    get: () => value,
    set: (v) => { value = v || ''; setStatus(''); sync(); },
  };
}

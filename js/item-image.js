/**
 * Picture upload for desk items and the builder's newsletter items alike.
 * New pictures are shrunk before they go up (Kate, Sep 17): a photo, a
 * flyer or a PDF's first page becomes a JPG at most MAX_WIDTH wide, any
 * see-through part on white (her pick: a cut-out shows a white margin in a
 * dark inbox, 1.9 MB became 137 KB); a GIF goes as it is. The value is the
 * public URL POST /api/newsletter-image hands back. On desk rows the URL
 * lives in the `infographic` column, which rides the hub CSV on publish and
 * becomes the newsletter item's picture on pull.
 */
import { busyWords } from './icons.js';
import { jsonInit } from './sheet-client.js';

/** Twice the widest the email shows a picture (552px), so it stays sharp. */
export const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.85;

/** The size a picture goes up at: its own, or MAX_WIDTH wide when wider. */
export function fitWidth(width, height) {
  if (width <= MAX_WIDTH) return { width, height };
  return { width: MAX_WIDTH, height: Math.round(height * MAX_WIDTH / width) };
}

/** A JPG or PNG that needed no shrinking stays as it is when its JPG comes
 *  out bigger. A WebP always goes as a JPG: not every inbox shows WebP. */
export function keepOriginal({ type, width, size }, jpegSize) {
  return (type === 'image/jpeg' || type === 'image/png') && width <= MAX_WIDTH && size <= jpegSize;
}

/** The canvas as a JPG; `failure` is the sentence when the browser can't. */
const toJpeg = (canvas, failure) => new Promise((resolve, reject) =>
  canvas.toBlob(b => (b ? resolve(b) : reject(new Error(failure))), 'image/jpeg', JPEG_QUALITY));

/** The picture as a JPG at most MAX_WIDTH wide, on white, or null to send
 *  the file as it is: a GIF (it may move), a small JPG or PNG its JPG would
 *  only make bigger (a tiny logo keeps its see-through ground that way), or
 *  one the browser can't redraw. */
async function shrinkPicture(file) {
  if (file.type === 'image/gif') return null;
  try {
    const bitmap = await createImageBitmap(file);
    const original = { type: file.type, width: bitmap.width, size: file.size };
    const { width, height } = fitWidth(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';   // what a see-through part shows in the email anyway
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const jpeg = await toJpeg(canvas);
    return keepOriginal(original, jpeg.size) ? null : jpeg;
  } catch {
    return null;
  }
}

/** PDF flyers become a picture in the browser (the first page, on white) so
 *  email clients can show them; pdf.js loads lazily from the CDN only when a
 *  PDF arrives. */
async function pdfFirstPage(file) {
  const pdfjs = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const page = await doc.getPage(1);
  const scale = MAX_WIDTH / page.getViewport({ scale: 1 }).width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  // intent 'print' keeps the raster off requestAnimationFrame, which browsers
  // pause in a background tab; otherwise switching tabs mid-upload leaves the
  // conversion stuck on "Converting the PDF" until you come back.
  await page.render({ canvasContext: canvas.getContext('2d'), viewport, intent: 'print' }).promise;
  return canvas;
}

const IMAGE_EXTS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

/** Upload one picture (PNG/JPG/GIF/WebP, or a PDF's first page) → public URL. */
async function uploadItemImage(file, onStatus) {
  const pdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  let blob = file;
  let ext = IMAGE_EXTS[file.type];
  if (!pdf && !ext) throw new Error('Use a PNG, JPG, GIF, WebP or PDF.');
  if (pdf) {
    onStatus('Converting the PDF…');
    blob = await toJpeg(await pdfFirstPage(file), "Couldn't convert that PDF.");
    ext = 'jpg';
    onStatus('Uploading…');
  } else {
    onStatus('Uploading…');   // shrinking takes a moment too
    const jpeg = await shrinkPicture(file);
    if (jpeg) { blob = jpeg; ext = 'jpg'; }
  }
  if (blob.size > 2.5 * 1024 * 1024) throw new Error('Too big. Keep it under 2.5 MB.');
  const b64 = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(new Error("Couldn't read that file."));
    r.readAsDataURL(blob);
  });
  const res = await fetch('/api/newsletter-image', jsonInit({ name: file.name, type: ext, file: b64 }));
  // A server page instead of JSON (a 502, a timeout) becomes a sentence, not parser noise.
  if (!res.ok) throw new Error(`The desk couldn't upload that file (server error ${res.status}). Try again.`);
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.error || "The desk couldn't upload that file. Try again.");
  return data.url;
}

/** The picture control: Add (or Replace) + Remove media; the value is a
 *  URL. The button hides while a file is in flight, so nothing goes up twice. */
export function buildImageControl(initial, onChange) {
  const wrap = document.createElement('div');
  wrap.className = 'img-upload';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.png,.jpg,.jpeg,.gif,.webp,.pdf';
  fileInput.hidden = true;
  const pick = document.createElement('button');
  pick.type = 'button';
  pick.className = 'linkish media-add';
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'linkish skip-link';
  removeBtn.textContent = 'Remove media';
  const status = document.createElement('span');
  status.className = 'img-status';
  status.setAttribute('role', 'status');
  // What is attached, in view: a small thumbnail beside the words.
  const thumb = document.createElement('img');
  thumb.className = 'img-thumb';
  thumb.alt = '';
  let value = initial || '';
  const sync = () => {
    pick.textContent = value ? 'Replace media' : 'Add media';
    removeBtn.hidden = !value;
    thumb.hidden = !value;
    if (value) thumb.src = value;
  };
  const setStatus = (msg, busy = false) => {
    if (busy && msg) status.replaceChildren(busyWords(msg));
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
  wrap.append(thumb, pick, removeBtn, status, fileInput);
  return {
    el: wrap,
    get: () => value,
    set: (v) => { value = v || ''; setStatus(''); sync(); },
    focus: () => pick.focus(),
  };
}

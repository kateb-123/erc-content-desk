import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePreviewScale } from '../js/preview.js';

// Wide layout: plenty of room → capped at maxScale (0.95).
test('caps at maxScale when there is ample room', () => {
  const s = computePreviewScale({ layoutWidth: 1152, columnWidth: 340, gap: 20, stagePad: 24 });
  assert.strictEqual(s, 0.95);
});

// Narrow layout: not enough room for 95% → scales down to fit exactly.
test('scales down to fit the available width', () => {
  // available = 900 - 340 - 20 - 48 = 492 ; 492/705 ≈ 0.6979
  const s = computePreviewScale({ layoutWidth: 900, columnWidth: 340, gap: 20, stagePad: 24 });
  assert.ok(Math.abs(s - 492 / 705) < 1e-9, `got ${s}`);
});

// Subtracts BOTH sides of the stage padding (the clipping bug: padding was ignored).
test('subtracts both sides of the stage padding', () => {
  const withPad = computePreviewScale({ layoutWidth: 900, columnWidth: 0, gap: 0, stagePad: 24, maxScale: 5 });
  const noPad = computePreviewScale({ layoutWidth: 900, columnWidth: 0, gap: 0, stagePad: 0, maxScale: 5 });
  assert.ok(withPad < noPad);
  assert.ok(Math.abs(withPad - (900 - 48) / 705) < 1e-9);
});

// Layout not measured yet (hidden step): non-positive available → 0.
test('returns 0 when available width is non-positive', () => {
  assert.strictEqual(computePreviewScale({ layoutWidth: 0, columnWidth: 340, gap: 20, stagePad: 24 }), 0);
  assert.strictEqual(computePreviewScale({ layoutWidth: 300, columnWidth: 340, gap: 20, stagePad: 24 }), 0);
});

// Honors custom sheetWidth + maxScale.
test('honors custom sheetWidth and maxScale', () => {
  const s = computePreviewScale({ layoutWidth: 1000, columnWidth: 0, gap: 0, stagePad: 0, sheetWidth: 500, maxScale: 1.5 });
  assert.strictEqual(s, 1.5); // 1000/500 = 2, capped at 1.5
});

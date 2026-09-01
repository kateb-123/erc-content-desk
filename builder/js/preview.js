/**
 * Compute the `zoom` scale for the newsletter sheet in the Preview & Edit step.
 * The sheet (sheetWidth px, true size) is scaled to fit the horizontal space
 * left in the edit layout after reserving the persistent edit column, the
 * inter-column gap, and BOTH sides of the stage padding. Capped at maxScale so
 * the sheet is never enlarged past it; scales down on narrow windows so the
 * column always fits and there's never a horizontal scrollbar.
 *
 * @param {object} o
 * @param {number} o.layoutWidth  - clientWidth of the .edit-layout flex row
 * @param {number} o.columnWidth  - width of the persistent edit column (px)
 * @param {number} o.gap          - flex gap between preview and column (px)
 * @param {number} o.stagePad     - horizontal padding on ONE side of the stage (px)
 * @param {number} [o.sheetWidth=705] - true newsletter width (px)
 * @param {number} [o.maxScale=0.95]  - never scale larger than this
 * @returns {number} scale factor, or 0 if there isn't measurable room yet
 */
export function computePreviewScale({ layoutWidth, columnWidth, gap, stagePad, sheetWidth = 705, maxScale = 0.95 }) {
  const available = layoutWidth - columnWidth - gap - stagePad * 2;
  if (available <= 0) return 0;
  return Math.min(maxScale, available / sheetWidth);
}

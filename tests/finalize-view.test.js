import test from 'node:test';
import assert from 'node:assert/strict';
import { blankRow } from '../js/schema.js';
import { needsRewrite } from '../js/finalize-ui.js';

const kept = o => blankRow({ status: 'kept', ...o });

test('events, opportunities, and description-less research need the ERC voice', () => {
  assert.equal(needsRewrite(kept({ type: 'event', blurb: 'x' })), true);
  assert.equal(needsRewrite(kept({ type: 'event', blurb: '' })), true);
  assert.equal(needsRewrite(kept({ type: 'opportunity', blurb: 'x' })), true);
  assert.equal(needsRewrite(kept({ type: 'research', blurb: '' })), true);
  assert.equal(needsRewrite(kept({ type: 'research', blurb: 'an abstract' })), false);
  assert.equal(needsRewrite(kept({ type: 'headline', blurb: 'x' })), false);
  assert.equal(needsRewrite(kept({ type: '', blurb: '' })), false);
});

test('a checked rewrite never needs rewriting again — the state survives reload', () => {
  assert.equal(needsRewrite(kept({ type: 'event', blurb: 'x', rewrite_checked: '2026-08-31T00:00:00.000Z' })), false);
  assert.equal(needsRewrite(kept({ type: 'opportunity', blurb: 'x', rewrite_checked: 'TRUE' })), false);
  assert.equal(needsRewrite(kept({ type: 'research', blurb: '', rewrite_checked: '2026-08-31T00:00:00.000Z' })), false);
  // blank and whitespace stamps don't count
  assert.equal(needsRewrite(kept({ type: 'event', blurb: 'x', rewrite_checked: '  ' })), true);
});

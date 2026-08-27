/**
 * The one submit form, shared by /submit and the desk Home screen: the
 * structured single-item form (radio type/subtype) plus the bulk "whole doc"
 * door. All DOM work lives inside renderSubmitForm (added with the renderer)
 * so the pure helpers stay importable under node --test.
 */
import { TYPES } from './schema.js';

/** Display order Kate approved in the mockup — not Object.keys(TYPES) order. */
export const TYPE_ORDER = ['research', 'event', 'opportunity', 'headline'];

export const TYPE_LABELS = {
  research: 'New Ed Policy Research', event: 'Event',
  opportunity: 'Opportunity', headline: 'Headline',
};

/** Picking a type clears the subtype; re-picking the current type is a no-op. */
export function pickType(selection, type) {
  return selection.type === type ? selection : { type, subtype: '' };
}

/**
 * Temporary operational flags, shared by the frontend and the api routes.
 *
 * PUBLISH_PAUSED closes the desk → Exchange door during the team trial: the
 * "Publish to the Exchange" button is replaced with a note, and /api/publish
 * refuses even if the endpoint is hit directly — so a curious click can't push
 * trial content to the live hub. The rest of the desk (submit, Sort, Finalize,
 * Send to Newsletter) works normally. Flip to false and bump the cache-busters
 * to reopen publishing.
 */
export const PUBLISH_PAUSED = true;
export const PUBLISH_PAUSED_MESSAGE =
  'Publishing is paused for the team trial — nothing goes to the Exchange yet.';

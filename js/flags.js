/**
 * Temporary operational flags, shared by the frontend and the api routes.
 *
 * PUBLISH_PAUSED closes the desk → Exchange door during the team trial: the
 * Publish button runs a mock (a "paused" beat, then a trial receipt) and
 * never calls the endpoint, and /api/publish refuses even if it is hit
 * directly — so a curious click can't push trial content to the live hub. The rest of the desk (submit, Sort, Finalize,
 * Send to Newsletter) works normally. Flip to false and bump the cache-busters
 * to reopen publishing.
 */
export const PUBLISH_PAUSED = true;
export const PUBLISH_PAUSED_MESSAGE =
  'Publishing is paused for the team trial — nothing goes to the Exchange yet.';

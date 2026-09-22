/**
 * Operational flags, shared by the frontend and the api routes.
 *
 * PUBLISH_PAUSED closes the desk to Exchange door: the Publish button runs a
 * mock (a "paused" beat, then a trial receipt) and never calls the endpoint,
 * and /api/publish refuses even if it is hit directly. It held from the team
 * trial of Sep 10 until Kate reopened publishing on Sep 22, 2026, after the
 * old kept pool was scrapped. Flip to true and bump the cache-busters to
 * pause it again.
 */
export const PUBLISH_PAUSED = false;

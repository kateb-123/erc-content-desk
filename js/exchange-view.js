/**
 * The Policy Exchange hub's status (Kate's drawn map, Oct 6, 2026), pure so
 * node --test can hold it: whether the site answers, when it last changed,
 * and how many wait to publish.
 *   preview    the Exchange check, or null until it lands
 *   hubUpdated the live site's last change, YYYY-MM-DD; '' when it did not
 *              answer; null while asked
 */
import { readyToPublish } from './workflow.js';
import { isoToShort } from './queue-view.js';
import { todayCentral } from './today.js';

/** When the Exchange last changed: the later of the site's own date and the
 *  desk's last publish (Central), so a publish this visit shows at once,
 *  before the site's redeploy is done (review, Oct 6). '' when neither is known. */
export function lastUpdated(rows, hubUpdated) {
  const published = rows.map(r => String(r.published_at ?? '')).filter(Boolean).sort().at(-1);
  const desk = published && !Number.isNaN(Date.parse(published)) ? todayCentral(new Date(published)) : '';
  return [hubUpdated || '', desk].sort().at(-1);
}

export function exchangeStatus({ rows = [], today = '', loaded = false, preview = null, hubUpdated = null }) {
  const site = hubUpdated === null ? 'Checking' : hubUpdated ? 'Live' : "Didn't answer just now";
  const updated = lastUpdated(rows, hubUpdated);
  return {
    site,
    updated: updated ? isoToShort(updated, today) : '',
    // What Publish would add, from the live check; until it lands, the kept rows ticked for the Exchange.
    waiting: loaded ? (preview ? preview.adding.length : readyToPublish(rows).length) : null,
  };
}

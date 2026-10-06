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

export function exchangeStatus({ rows = [], today = '', loaded = false, preview = null, hubUpdated = null }) {
  const site = hubUpdated === null ? 'Checking' : hubUpdated ? 'Live' : "Didn't answer just now";
  return {
    site,
    updated: hubUpdated ? isoToShort(hubUpdated, today) : '',
    // What Publish would add, from the live check; until it lands, the kept rows ticked for the Exchange.
    waiting: loaded ? (preview ? preview.adding.length : readyToPublish(rows).length) : null,
  };
}

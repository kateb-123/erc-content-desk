/**
 * The desk's "today": College Station's date, whatever clock the browser or
 * the server keeps (Kate, Sep 23, 2026: Central time always). The desk used
 * to take the UTC date, which ran a day ahead from 7 pm Central and moved
 * Next issue, Sends in N days, the Past group and the Schedule tab early.
 */
const CENTRAL = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Today in Central time, as YYYY-MM-DD. */
export function todayCentral(now = new Date()) {
  return CENTRAL.format(now);
}

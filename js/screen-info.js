/**
 * The screen-header info door (Kate's pick A, Sep 1): "View info" sits beside
 * the title and opens a tinted instruction panel. Open/closed is remembered
 * per screen for the visit — re-renders keep whatever state the reader chose.
 */
const openInfo = new Set();

export function titleWithInfo(title, key, text) {
  const row = document.createElement('div');
  row.className = 'title-row';
  const h2 = document.createElement('h2');
  h2.textContent = title;
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'info-toggle';
  const panel = document.createElement('div');
  panel.className = 'info-panel';
  panel.textContent = text;
  const sync = () => {
    panel.hidden = !openInfo.has(key);
    toggle.textContent = openInfo.has(key) ? 'Hide info' : 'View info';
  };
  toggle.addEventListener('click', () => {
    if (openInfo.has(key)) openInfo.delete(key);
    else openInfo.add(key);
    sync();
  });
  sync();
  row.append(h2, toggle);
  return { row, panel };
}

/**
 * The newsletter's HTML on the front page (Kate, Oct 8): three pages linked
 * from the Newsletter card, never downloads. The blank template and the
 * fictional sample are each drawn from the builder's own template the moment
 * they open (js/email-page.js), so a change to the template reaches the
 * builder and both pages at once; the read me says where that change goes.
 */
export const EMAIL_PAGES = [
  { key: 'readme', label: 'Read me', href: '/newsletter/read-me/' },   // first (Kate, Oct 8)
  { key: 'blank', label: 'Blank template', href: '/newsletter/template/' },
  { key: 'sample', label: 'Sample issue', href: '/newsletter/sample/' },
];

# The public pages

The share form (`submit/`) and the listserv sign-up (`listserv/`), standalone
at an address of their own. This folder is its own Vercel project (Root
Directory `public-pages`); the desk's deployment redirects the folder's
addresses here (its `vercel.json`). Not an ignore line: Vercel reads
`.vercelignore` at the repository root for every project built from the
repo, so that emptied this deploy too (Sep 22).

The pages post to their own `/api`. `vercel.json` forwards those calls
server-side, so the address of the team's desk is never written where a
visitor can read it. Each call carries `public: true` and a Turnstile token,
which the receiving end requires; the project's hostname has to be on the
Turnstile widget's list in Cloudflare or the human check will not load.

Outward look on purpose (maroon, Work Sans and Open Sans, `css/public.css`),
matching the newsletter and the Policy Exchange, not the desk.

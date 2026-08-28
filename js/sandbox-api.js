/**
 * SANDBOX BRANCH ONLY — never merge to main.
 * Answers /api/* inside the page from fixture data, so the deployed
 * preview has no backend at all. Mirrors .superpowers/sandbox/sandbox-server.mjs.
 */

export const SCHEDULE = ['2026-09-01', '2026-10-06'];

const blank = {
  date: '', headline: '', link: '', type: '', subtype: '', source: '', topic: '',
  blurb: '', deadline: '', medium: '', authors: '', time: '', location: '',
  infographic: '', id: '', status: 'new', submitter: '', submitted_at: '',
  spotlight_request: false, note: '', original_text: '', published_at: '',
  newsletter_issue: '',
};
const row = (n, o) => ({ ...blank, _rowNumber: n, id: `sbx_${String(n).padStart(3, '0')}`, ...o });

const FIXTURES = [
  // ---- queue (status: new) ----
  row(2, { status: 'new', type: 'research', subtype: 'Working Paper', headline: 'School Finance Reform and Student Outcomes: Evidence from Three States', link: 'https://www.edworkingpapers.com/ai24-0912', source: 'Annenberg EdWorkingPapers', authors: 'Chen, Rodriguez & Patel', blurb: 'Working paper comparing post-2019 school finance reforms in Texas, Tennessee, and Colorado. Finds achievement gains concentrated in districts that directed new funds to early-grade staffing. Includes district-level replication files.', submitter: 'MG', submitted_at: '2026-08-24T14:02:00Z' }),
  row(3, { status: 'new', type: 'research', subtype: 'Report', headline: 'The State of the Texas Teacher Pipeline, 2026', link: 'https://tea.texas.gov/reports/teacher-pipeline-2026', source: 'Texas Education Agency', blurb: 'Annual TEA report on certification, hiring, and attrition. Alternative certification now accounts for a majority of new hires in rural districts; first-year attrition ticked down for the second straight year.', submitter: 'KB', submitted_at: '2026-08-24T15:31:00Z' }),
  row(4, { status: 'new', type: 'event', subtype: 'Webinar-Online', date: '2026-09-18', time: '12:00 PM CT', headline: 'Measuring What Matters: New Approaches to School Accountability', link: 'https://www.brookings.edu/events/accountability-2026', source: 'Brookings', blurb: 'Panel on next-generation accountability systems, with state chiefs from Texas and Louisiana and researchers behind the new multi-measure dashboards. Free registration; recording posted afterward.', submitter: 'MG', submitted_at: '2026-08-25T09:12:00Z' }),
  row(5, { status: 'new', type: 'event', subtype: 'A&M', date: '2026-09-25', time: '3:30 PM CT', location: 'Harrington Tower 108', headline: 'ERC Fall Speaker Series: Dr. Elena Vasquez on Bilingual Program Access', link: 'https://education.tamu.edu/event/vasquez-fall-2026', source: 'TAMU College of Education', blurb: 'First talk of the fall series. Dr. Vasquez presents new ERC-linked findings on bilingual program access gaps across urban and rural Texas districts. Reception follows.', submitter: 'KB', submitted_at: '2026-08-25T10:44:00Z', spotlight_request: true }),
  row(6, { status: 'new', type: 'opportunity', subtype: 'Funding & Grants', deadline: '2026-10-15', headline: 'IES FY27 Education Research Grants (84.305A)', link: 'https://ies.ed.gov/funding/305a-fy27', source: 'Institute of Education Sciences', blurb: 'Annual IES competition across all education research topics. Letters of intent optional; applications due October 15, 2026. Program officer webinar September 10.', submitter: 'MG', submitted_at: '2026-08-25T11:20:00Z' }),
  row(7, { status: 'new', type: 'opportunity', subtype: 'Other', deadline: '2026-09-30', headline: 'Call for Reviewers: Texas Education Review Special Issue', link: 'https://review.education.texas.edu/reviewers-2026', source: 'Texas Education Review', blurb: 'The journal seeks doctoral students and early-career researchers as peer reviewers for a special issue on rural education. Short commitment; reviewer training provided.', submitter: 'AL', submitted_at: '2026-08-25T16:05:00Z' }),
  row(8, { status: 'new', type: 'headline', subtype: 'Texas', headline: 'Legislature Weighs Expansion of Early College High School Funding', link: 'https://www.texastribune.org/2026/08/25/early-college-funding', source: 'Texas Tribune', medium: 'news', submitter: 'KB', submitted_at: '2026-08-26T08:15:00Z' }),
  row(9, { status: 'new', type: '', subtype: '', headline: 'FWISD dual-credit dashboard (from the district newsletter — not sure where this goes)', link: 'https://www.fwisd.org/dual-credit-dashboard', blurb: 'Fort Worth ISD published an interactive dashboard tracking dual-credit enrollment and completion by campus.', submitter: 'AL', submitted_at: '2026-08-26T09:40:00Z' }),
  row(10, { status: 'new', type: 'headline', subtype: 'Texas', headline: 'Early College High School Funding Bill Advances (duplicate test)', link: 'https://www.texastribune.org/2026/08/25/early-college-funding', source: 'Texas Tribune', medium: 'news', submitter: 'MG', submitted_at: '2026-08-26T10:02:00Z' }),
  // ---- circle back ----
  row(11, { status: 'circleback', type: 'research', subtype: 'Peer-Reviewed', headline: 'Long-Run Effects of Pre-K: A Meta-Analysis', link: 'https://doi.org/10.3102/013189X26', source: 'Educational Researcher', authors: 'Nguyen & Osei', blurb: 'Meta-analysis of 47 pre-K studies with long-run follow-ups.', note: 'Waiting on the published version — preprint only right now.', submitter: 'KB', submitted_at: '2026-08-18T13:00:00Z' }),
  row(12, { status: 'circleback', type: 'event', subtype: 'Off-Campus', date: '2026-08-20', headline: 'UT Austin Ed Policy Works Symposium', link: 'https://edpolicyworks.utexas.edu/symposium', source: 'UT Austin', blurb: 'Annual symposium on Texas education policy research.', note: 'Check if recordings get posted.', submitter: 'MG', submitted_at: '2026-08-12T09:30:00Z' }),
  // ---- kept, not yet published ----
  row(13, { status: 'kept', type: 'event', subtype: 'Webinar-Online', date: '2026-09-09', time: '1:00 PM CT', headline: 'Chronic Absenteeism After the Pandemic: What Is Working', link: 'https://www.aei.org/events/absenteeism-2026', source: 'AEI', blurb: 'AEI hosts researchers and district leaders on attendance recovery strategies, including the Texas tutoring corps results and new work on family outreach messaging. The event will feature a moderated Q&A and will be recorded for later viewing on the AEI site.', submitter: 'KB', submitted_at: '2026-08-20T10:00:00Z' }),
  row(14, { status: 'kept', type: 'opportunity', subtype: 'Fellowships & Programs', deadline: '2026-11-01', headline: 'Strategic Data Project Fellowship, 2027 Cohort', link: 'https://sdp.cepr.harvard.edu/fellowship-2027', source: 'Harvard CEPR', blurb: 'Two-year data fellowship placing analysts in education agencies. Texas placements have included TEA and two large districts. Applications open now and close November 1, 2026.', submitter: 'MG', submitted_at: '2026-08-21T11:30:00Z' }),
  row(15, { status: 'kept', type: 'research', subtype: 'ERC Research', headline: 'ERC Brief: Course Access Gaps in Texas High Schools', link: 'https://erc.tamu.edu/briefs/course-access-2026', source: 'ERC', authors: 'Barnes, Vasquez & Kim', blurb: 'New ERC brief documenting advanced-course access gaps across Texas high schools, with district-level maps and policy options for expanding rural access.', submitter: 'KB', submitted_at: '2026-08-22T09:00:00Z', spotlight_request: true }),
  // ---- published (Build pool) ----
  row(16, { status: 'kept', type: 'research', subtype: 'Report', headline: 'NAEP 2026: Texas Results in Context', link: 'https://www.nagb.gov/naep-2026-texas', source: 'NAGB', blurb: 'State-level NAEP results with Texas trend lines since 2019, including subgroup breakdowns and urban district comparisons.', submitter: 'MG', submitted_at: '2026-08-15T10:00:00Z', published_at: '2026-08-20T16:00:00Z' }),
  row(17, { status: 'kept', type: 'headline', subtype: 'National', headline: 'Education Department Finalizes New Title I Reporting Rules', link: 'https://www.k12dive.com/news/title-i-reporting-2026', source: 'K-12 Dive', medium: 'news', submitter: 'AL', submitted_at: '2026-08-15T11:00:00Z', published_at: '2026-08-20T16:00:00Z' }),
  // ---- trashed ----
  row(18, { status: 'trashed', type: 'headline', subtype: 'National', headline: 'Ten Productivity Hacks for Busy Teachers (listicle)', link: 'https://example-edublog.com/productivity-hacks', submitter: 'AL', submitted_at: '2026-08-19T12:00:00Z' }),
];

export function fixtureRows() { return structuredClone(FIXTURES); }

export function createBackend(initial) {
  const state = initial ?? { rows: fixtureRows(), nextRowNumber: 19 };
  const ok = body => ({ status: 200, body: { ok: true, ...body } });

  async function handle(path, method, body) {
    if (path === '/api/sheet' && method === 'GET') return ok({ rows: state.rows, schedule: SCHEDULE });

    if (path === '/api/sheet' && method === 'PATCH') {
      const incoming = body.rows ?? [];
      const byId = new Map(state.rows.map(r => [r.id, r]));
      let saved = 0;
      for (const r of incoming) if (byId.has(r.id)) { Object.assign(byId.get(r.id), r); saved++; }
      return ok({ saved });
    }

    if (path === '/api/submit' && method === 'POST') {
      state.rows.push(row(state.nextRowNumber++, {
        status: 'new', headline: String(body.title ?? ''), blurb: String(body.blurb ?? ''),
        original_text: String(body.blurb ?? ''), link: String(body.link ?? ''),
        type: String(body.type ?? ''), subtype: String(body.subtype ?? ''),
        spotlight_request: Boolean(body.spotlight), submitter: String(body.submitter ?? ''),
        submitted_at: new Date().toISOString(),
      }));
      return ok({ warnings: ['Sandbox: saved in memory only.'] });
    }

    if (path === '/api/bulk' && method === 'POST') {
      return ok({
        counts: { headline: 2, event: 1 },
        warnings: ['Sandbox: canned split — the real thing reads your document with Claude.'],
        items: [
          { type: 'headline', subtype: 'Texas', title: 'Sandbox item: HISD Expands Tutoring Corps', link: 'https://example.org/hisd-tutoring', blurb: '', original_text: '' },
          { type: 'headline', subtype: 'National', title: 'Sandbox item: States Rethink Graduation Requirements', link: 'https://example.org/grad-requirements', blurb: '', original_text: '' },
          { type: 'event', subtype: 'Webinar-Online', title: 'Sandbox item: Urban Institute Data Talk', link: 'https://example.org/urban-data-talk', blurb: 'October webinar on linked education data.', original_text: '' },
        ],
      });
    }

    if (path === '/api/rewrite' && method === 'POST') {
      const cands = state.rows.filter(r => r.status === 'kept' && (r.type === 'event' || r.type === 'opportunity') && r.blurb && !r.published_at);
      return ok({
        warnings: cands.length ? [] : ['Nothing to rewrite in the sandbox data.'],
        rewrites: cands.slice(0, 2).map(r => ({ id: r.id, blurb: `${r.blurb.split('.')[0]}. (Sandbox rewrite: tightened to show the accept/keep flow — the real one uses your voice examples.)` })),
      });
    }

    if (path === '/api/publish' && method === 'GET') {
      const ready = state.rows.filter(r => r.status === 'kept' && !r.published_at);
      const okRows = ready.filter(r => r.type);
      return ok({ adding: okRows.map(r => ({ headline: r.headline })), skipped: [], notReady: ready.filter(r => !r.type).map(r => ({ headline: r.headline })), hubCount: 54 });
    }

    if (path === '/api/publish' && method === 'POST') {
      const ready = state.rows.filter(r => r.status === 'kept' && !r.published_at && r.type);
      const stamp = new Date().toISOString();
      for (const r of ready) r.published_at = stamp;
      return ok({ published: ready.length, skipped: 0, warning: 'Sandbox: nothing actually reached the Exchange.' });
    }

    return { status: 404, body: { ok: false, error: `No sandbox handler for ${method} ${path}` } };
  }

  return { state, handle };
}

// ---- browser install: wrap fetch, persist to sessionStorage ----
if (typeof window !== 'undefined') {
  const KEY = 'sandbox-desk-v1';
  let initial = null;
  try {
    const s = sessionStorage.getItem(KEY);
    initial = s ? JSON.parse(s) : null;
  } catch { initial = null; }
  const backend = createBackend(initial ?? undefined);
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(backend.state)); } catch { /* storage may be unavailable; sandbox still works per-load */ } };
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const path = new URL(url, window.location.origin).pathname;
    if (!path.startsWith('/api/')) return realFetch(input, init);
    const method = (init.method ?? 'GET').toUpperCase();
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch { body = {}; }
    const res = await backend.handle(path, method, body);
    save();
    return new Response(JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  };
}

/**
 * Real before/after pairs, hand-picked from Kate's "Newsletter Rewrite
 * Voice" Google Sheet, for diversity across hosts and item types: a
 * national think-tank symposium, a DC agency/Urban Institute webinar with a
 * long speaker list, a fellowship opportunity, and a TAMU campus lecture.
 * Wired into buildRewritePrompt (api/_lib/rewrite.js) as few-shot examples
 * of the ERC voice.
 *
 * CAVEAT — read before touching this file: Kate's human rewrites sometimes
 * add facts she looked up on the source page that are NOT present in the
 * "original" text shown here (e.g. speaker names, dollar amounts, exact
 * eligibility windows). That is a real editorial move she makes with
 * outside knowledge; it is NOT something the model should imitate. These
 * examples teach voice and compression only. The never-invent-a-fact rule
 * in ERC_VOICE and in the rewrite prompt stays authoritative — every fact
 * in a model-written rewrite must come from that item's own blurb, not
 * from anything modeled here.
 */
export const VOICE_EXAMPLES = [
  {
    original: `Artificial intelligence is reshaping how societies learn, work, communicate, and care for one another. It has entered homes, classrooms, and care settings through educational apps, toys, adaptive learning platforms, and developmental screening tools. Yet the needs and experiences of children under age 8 remain largely overlooked in global conversation about AI, despite this being the most critical period for brain development and the foundation for lifelong learning and well-being.

On September 9, the Center for Universal Education at Brookings and ZERO TO THREE will host a symposium exploring the opportunities and risks of AI-embedded technologies for children from birth to age 8. Bringing together researchers, technology leaders, and other key stakeholders, the symposium will examine how to ensure these technologies support rather than undermine healthy early childhood development and education.`,
    rewrite: `Artificial intelligence (AI) now reaches children through apps, toys, adaptive learning platforms, and developmental screening tools, yet children under age 8 are largely absent from policy debate. The Center for Universal Education at Brookings and ZERO TO THREE convene researchers, pediatricians, and technology leaders — including Dana Suskind, Jenny Radesky, and Ying Xu — on the risks and guardrails for birth-to-8 technology. Free online registration.`,
  },
  {
    original: `Without sufficient public investment, child care businesses in the United States have faced financial strains that contribute to low wages and high turnover among educators, heavy cost burdens passed on to families, and overall instability and insufficient supply.

To strengthen and stabilize the early childhood workforce and address these persistent challenges, DC's Office of the State Superintendent of Education (OSSE) launched a first-of-its-kind early educator compensation initiative. Funded through tax revenue, the compensation program alleviates financial strains by providing funding to participating providers to increase educator wages according to a salary scale based on role and education. Since the program's 2022 inception, Urban Institute researchers have partnered with OSSE to examine its implementation and outcomes.`,
    rewrite: `Since 2022, the District of Columbia's Office of the State Superintendent of Education (OSSE) has used tax revenue to raise early educator wages on a salary scale tied to role and education. Urban Institute researchers, who have studied the program with OSSE since its start, will present new evidence on workforce retention and families' access to affordable, higher-quality care, plus takeaways for policymakers elsewhere.`,
  },
  {
    original: `The NAEd/Spencer Postdoctoral Fellowship supports early career scholars working in critical areas of education research. Through professional development, funding, and mentorship from senior scholars, the fellowship enhances the career and research opportunities of the fellow.

As a highly competitive initiative, this fellowship annually identifies and supports 20 of the most exceptional researchers conducting postdoctoral studies relevant to education.`,
    rewrite: `The National Academy of Education and the Spencer Foundation offer 25 postdoctoral fellowships of $70,000 for early-career scholars pursuing research relevant to education. Eligible applicants earned a PhD or EdD between January 1, 2021 and December 31, 2025. Applications open August 1, 2026, worth flagging now so postdocs can prepare.`,
  },
  {
    original: `The Carter-Larke Black History and Education Lecture was established in 2017 to honor and continue the legacies of Dr. Norvella Carter and Dr. Patricia Larke upon their retirement as faculty in the Department of Teaching, Learning and Culture (TLAC) in the College of Education and Human Development (CEHD). This lecture has become a culminating event for Black History Month in the CEHD. These two trailblazing African American female faculty members used education and research to transform the lives of teachers and children.`,
    rewrite: `The Carter-Larke Black History and Education Lecture honors the legacies of Dr. Norvella Carter and Dr. Patricia Larke, two trailblazing faculty whose scholarship and teaching transformed generations of educators. Since 2017, it has grown into a signature Black History Month event in the College of Education and Human Development. This year's lecture, Nine Beats Strong: Rhythm, Resistance, and Renaissance, offers an engaging program exploring Black history, culture, and education through the lens of rhythm and resistance. Hear from keynote speaker Dr. Tony B. Watlington Sr., superintendent of the School District of Philadelphia, and join a campus-wide conversation on educational justice and renewal.`,
  },
];

/**
 * The four sample rewrites Kate approved word for word (Oct 8, 2026), one of
 * each kind the rewriter got wrong: an A&M talk whose page leads with the
 * speaker's career, a webinar with a speaker list, a research summary whose
 * page opens with filler, and a call for proposals. Each is an item in the
 * row's own fields with the text its page gave, then her rewrite, which adds
 * no fact the text lacks. buildRewritePrompt (api/_lib/rewrite.js) shows
 * each one in the shape of a real item, ahead of the items.
 *
 * Her approved text is kept in tests/fixtures/approved-voice-samples.json,
 * and a test holds each rewrite here to it byte for byte. The one change to
 * a source text: the AEFP call's dashes are commas, since no dash goes in
 * the prompt.
 */
export const VOICE_EXAMPLES = [
  {
    kind: 'A&M talk',
    headline: `Curtis D. Robert Distinguished Speaker Series with Dr. Eric Knuth`,
    type: 'event',
    subtype: 'A&M',
    source: `Texas A&M University`,
    date: '2026-10-13',
    time: '1:30 PM CT',
    location: 'Rudder Tower, Room 707',
    original_text: `Curtis D. Robert Distinguished Speaker Series in STEM Education Research

Speaker: Dr. Eric Knuth
Topic: The Role and Use of Examples in Proving-Related Activity

How can examples help students learn to think like a mathematician? Join us when Dr. Eric Knuth discusses how students can use examples to investigate mathematical ideas, test conjectures and strengthen their ability to construct proofs.

Abstract

Mathematicians often spend significant time carefully considering and analyzing examples during proving-related activities (e.g., developing conjectures, exploring conjectures, justifying conjectures). This effort often provides not only a deeper understanding of the underlying mathematics, but also insight into the development of a proof. In contrast, students often use examples in their proving-related activities, however, they typically spend very little time carefully considering and analyzing the examples they use. Taking the view that example use plays both a foundational and essential role in learning to prove, in this talk I will share research results from several inter-related projects that investigated example use in proving-related activities. The projects explore the nature of students’ example use and its relation to what they find convincing as well as the nature of students’, and mathematicians’ thinking about the examples they use during proving-related activities. Collectively, the results from these projects provide insight into the ways in which the productive use of examples in proving-related activities may facilitate the development of students learning to prove.


About the Speaker

Dr. Eric Knuth received a doctorate in mathematics education from the University of Colorado at Boulder, a master’s degree in mathematics from San Diego State University, and a bachelor’s degree in electrical engineering from the University of Illinois. He is currently serving as a visiting researcher at Halmstad University in Sweden. Most recently, he was a Program Director for the National Science Foundation’s STEM Education Directorate (EDU) where he served as program lead for EDU’s Core Research Program (ECR), and served in the Career, DRK-12, STEM K-12, and STEM Ed Postdoctoral Fellowship programs. Prior to joining NSF, he was a faculty member in the School of Education at the University of Wisconsin-Madison (18 years) and in the College of Education at the UT-Austin (5 years), where he also served as the Director of the College’s STEM Center. His program of research concerns the meaningful engagement of students in mathematical practices and their development of increasingly more sophisticated ways of engaging in those practices, with a particular focus on practices related to algebraic reasoning and learning to prove. Finally, he also served as co-chair of the AERA SIG for Research in Mathematics Education and as a member of the NCTM Research Committee.`,
    rewrite: `Mathematicians study examples closely when they work toward a proof; students rarely do. Eric Knuth shares results from several related projects on how students use examples to form, test, and justify conjectures, what they find convincing, and how better use of examples can help them learn to prove. Knuth is a former program director in the National Science Foundation's STEM Education Directorate.`,
  },
  {
    kind: 'webinar',
    headline: `The Latest on the Federal Scholarship Tax Credit: Opportunities and Challenges for Public Schools`,
    type: 'event',
    subtype: 'Webinar-Online',
    source: `FutureEd`,
    date: '2026-10-16',
    time: '3:00 PM CT',
    original_text: `Join leading experts for a briefing on the latest regulations governing the Trump administration's federal scholarship tax credit program and a discussion of the opportunities and challenges in using the program to support high-quality public school programs. The webinar, co-sponsored by FutureEd, the National Student Support Accelerator, and Accelerate and led by FutureEd Associate Director Maureen Tracey-Mooney, will feature: Narric Rome, managing director of government relations at Accelerate Kathy Bendheim, strategic advising director at National Student Support Accelerator, Stanford University Deborah Gist, former state superintendent and founder of the Future School Fund`,
    rewrite: `A briefing on the latest regulations for the Trump administration's federal scholarship tax credit, and on the opportunities and challenges of using the program to support high-quality public school programs. Speakers are Narric Rome of Accelerate, Kathy Bendheim of the National Student Support Accelerator at Stanford University, and Deborah Gist, former state superintendent and founder of the Future School Fund.`,
  },
  {
    kind: 'research summary whose page opens with filler',
    headline: `Insights for Action Research Summary: Professional Learning for Teachers`,
    type: 'research',
    subtype: 'Report',
    source: `Tennessee Education Research Alliance`,
    original_text: `Over the past decade, TERA has tackled some of Tennessee's most pressing educational challenges. We've examined teacher retention and pipeline development, investigated principal and leadership effectiveness, explored strategic staffing, supported early-career educators, and analyzed the drivers of student learning and well-being. Our research has illuminated pathways to postsecondary readiness and shaped how educational leaders think about their work. Over the next few months, we're recapping our research, the insights that have emerged, and how evidence-driven collaboration continues to reshape educational policy and practice in our state. We're excited to share this milestone, as we reflect on a decade of rigorous research and why this work matters. Key Insight #1: Professional learning is most effective when it is sustained, job-embedded, and responsive to teachers’ instructional needs . Key Insight #2: Individualized, content-focused supports such as coaching are historically less common but more likely to change practice. Key Insight #3: Collaboration improves teaching practice when it is evidence-based and requires teachers to examine and challenge their instructional decisions. Key Insight #4: School conditions affect whether professional learning translates into improved instruction. Key Insight #5: Improving teaching practice requires coherent systems of support that enable continuous growth over time.`,
    rewrite: `The Tennessee Education Research Alliance sums up a decade of its research on teacher professional learning in five findings: it works best when sustained, job-embedded, and tied to what teachers need in their own classrooms; coaching is less common but more likely to change practice; collaboration helps when teachers examine their own instructional decisions; school conditions shape whether it reaches instruction; and lasting growth needs a coherent system of support.`,
  },
  {
    kind: 'call for proposals',
    headline: `AEFP Annual Conference - Call for Proposals`,
    type: 'opportunity',
    subtype: 'Call for Proposals',
    source: `Association for Education Finance and Policy`,
    deadline: '2026-10-02',
    original_text: `The 2027 conference theme, Playing the Long Game: Cultivating Purpose for Durable Policy Impact, is motivated by the recognition that durable policy impacts don't happen overnight. Meaningful impacts may emerge only after multiple cycles of policy experimentation, implementation, research, and discussion, with many failures, directional shifts, conflicting findings, and other uncertainties along the way. Cultivating purpose in our work, not just what we are doing but why, collectively and as individuals, may help foster the focus, resolve, intellectual rigor, and collective insight needed to navigate these cycles and help steer them in the direction of progress.

We invite proposals from researchers, policymakers, and practitioners across a wide range of topics in education finance and policy. We encourage proposals that articulate how a given study furthers “the long game” of improving educational outcomes and equity. How do the findings fit within the existing research and policy landscape, and what might be learned from the study that could have relevance beyond the specific study context? We welcome proposals across a range of methodological approaches, across diverse educational contexts, and for a diversity of learners. Scholars studying education policy outside the United States or conducting comparative research are welcome.

This year's conference will offer the traditional conference sessions and poster session as well as “Policy Dialogues” which are sessions that`,
    rewrite: `The Association for Education Finance and Policy invites proposals for its 2027 conference from researchers, policymakers, and practitioners on any topic in education finance and policy. This year's theme, Playing the Long Game, favors studies that show how their findings add to long-run gains in outcomes and equity and what they offer beyond their own setting. All methods and settings are welcome, including research outside the United States.`,
  },
];

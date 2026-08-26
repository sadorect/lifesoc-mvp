// Server-only. Never import this file from client-bundled code — the full
// pool and answers must never reach the browser. `ref` is safe to expose
// (it only points to a section of the book, not the answer) and is sent to
// the client alongside the question text so they know where to look.
export const QUESTIONS = [
  { id: 'a1', ref: 'Appendix A, first RELATIONSHIPS prompt', q: 'Who currently has access to your emotional state, your time, and what else?', a: ['private self', 'self'] },
  { id: 'a2', ref: 'Appendix A, first CAREER & PURPOSE prompt', q: 'Was it deliberate navigation or accumulated ___?', a: ['gravity'] },
  { id: 'a3', ref: 'Appendix A, MENTAL & EMOTIONAL STATE prompt', q: 'Is it stable enough for good ___?', a: ['decisions', 'good decisions', 'decision', 'good decision'] },
  { id: 'a4', ref: 'Appendix A, FORGOTTEN SUBDOMAINS prompt', q: 'What areas of your life are connected to everything but currently ___?', a: ['unmonitored'] },
  { id: 'b1', ref: 'Appendix B, ZERO-DAYS DISCOVERED status options', q: 'What is the second of the three status options listed?', a: ['being traced', 'traced'] },
  { id: 'b2', ref: 'Appendix B, KNOWN & UNMANAGED section', q: 'What is asked about the cost of continued ___?', a: ['deferral'] },
  { id: 'c1', ref: 'Appendix C, ENERGY & MOTIVATION, second prompt', q: 'Things you have stopped looking ___ to?', a: ['forward'] },
  { id: 'c2', ref: 'Appendix C, IDENTITY SIGNALS section', q: 'What does it ask about opinions or preferences you have recently withheld or done what to?', a: ['softened'] },
  { id: 'c3', ref: 'Appendix C, FINANCIAL DRIFT, first prompt', q: 'Direction of the what, over the last three months?', a: ['savings rate', 'savings'] },
  { id: 'd1', ref: 'Appendix D, CONTAINMENT, decision triage prompt', q: 'Which decisions must happen now, which can ___?', a: ['wait'] },
  { id: 'd2', ref: 'Appendix D, IDENTIFICATION, failure modes', q: 'Denial, minimization, or ___?', a: ['catastrophization'] },
  { id: 'd3', ref: 'Appendix D, POST-INCIDENT REVIEW, "what failed"', q: 'What proved weaker than expected or ___ entirely?', a: ['absent'] },
  { id: 'd4', ref: 'Appendix D, RECOVERY section', q: 'Which type of recovery asks what is being deliberately rebuilt, and in what sequence?', a: ['structural', 'structural recovery'] },
  { id: 'e1', ref: 'Appendix E, ACCOUNTING prompt', q: 'What is the return on the access ___?', a: ['granted'] },
  { id: 'e2', ref: 'Appendix E, AUTHORIZATION prompt', q: 'Demonstrated trustworthiness or assumed by ___?', a: ['category'] },
  { id: 'e3', ref: 'Appendix E, framework name', q: 'What does the second A in the triple-A framework stand for?', a: ['authorization'] },
  { id: 'f1', ref: 'Appendix F, STARTING OUT, Atomic Habits', q: 'Who is listed as the author of Atomic Habits?', a: ['james clear', 'clear'] },
  { id: 'f2', ref: 'Appendix F, Antifragile description', q: 'The framework for building systems that gain from ___?', a: ['disorder'] },
  { id: 'f3', ref: 'Appendix F, NAVIGATING ADVERSITY, The Body Keeps the Score', q: 'Who is listed as the author?', a: ['bessel van der kolk', 'van der kolk'] },
  { id: 'f4', ref: 'Appendix F, Insight description', q: 'Genuine self-awareness versus the ___ of it?', a: ['illusion'] },
  { id: 'f5', ref: 'Appendix F, Deep Work description', q: 'Protects the cognitive capacity that which specific attack depletes?', a: ['denial of service'] },
  { id: 'f6', ref: 'Appendix F, BUILDING, Thinking Fast and Slow', q: 'Who is listed as the author?', a: ['daniel kahneman', 'kahneman'] },
  { id: 'f7', ref: 'Appendix F, Being Mortal description', q: 'What finitude asks of how we ___?', a: ['live'] },
  { id: 'g1', ref: 'Appendix G, trend guidance', q: 'A domain declining across three reviews is telling you something more important than any single ___?', a: ['number'] },
  { id: 'g2', ref: 'Appendix G, trend guidance', q: 'A domain improving is evidence that the ___ is deploying?', a: ['patch'] },
  { id: 'g3', ref: 'Appendix G, closing guidance', q: 'Use the comparison between reviews as the intelligence, not the review in ___?', a: ['isolation'] },
]

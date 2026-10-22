import { verifyAuth, clerk } from './audiobook/_auth.js'
import { QUESTIONS } from './_questions.js'
import { findReviewer } from './_reviewers.js'

const GENERIC_ERROR = "That didn't match — check your book and try again"

function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:]+$/, '')
    .trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = await verifyAuth(req, res)
  if (!userId) return

  const { code, questionId, answer } = req.body ?? {}

  // Reviewers skip the question, get indefinite access and audiobook downloads.
  const reviewer = findReviewer(code)
  if (reviewer) {
    await clerk.users.updateUserMetadata(userId, {
      privateMetadata: {
        bookRedeemed: true,
        redeemedAt: new Date().toISOString(),
        accessType: 'reviewer',
        reviewer: reviewer.name,
        reviewerCode: reviewer.code,
      },
      publicMetadata: { canDownload: true },
    })
    return res.json({ success: true })
  }

  const codeOk = normalize(code) === normalize(process.env.BOOK_ACCESS_CODE)
  const question = QUESTIONS.find(q => q.id === questionId)
  const answerOk = !!question && question.a.some(v => normalize(v) === normalize(answer))

  if (!codeOk || !answerOk) {
    return res.status(400).json({ error: GENERIC_ERROR })
  }

  await clerk.users.updateUserMetadata(userId, {
    // Metadata updates deep-merge, so clear any revoked reviewer fields explicitly.
    privateMetadata: {
      bookRedeemed: true,
      redeemedAt: new Date().toISOString(),
      accessType: null,
      reviewer: null,
      reviewerCode: null,
    },
  })

  res.json({ success: true })
}

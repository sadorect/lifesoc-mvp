import { verifyAuth } from './audiobook/_auth.js'
import { grantReader, grantReviewer } from './_store.js'
import { QUESTIONS } from './_questions.js'
import { findReviewer } from './_reviewers.js'
import { getBookAccessCode } from './_settings.js'
import { logUsage } from './_usage.js'

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
    grantReviewer(userId, reviewer)
    logUsage(userId, 'redeem')
    return res.json({ success: true })
  }

  const codeOk = normalize(code) === normalize(getBookAccessCode())
  const question = QUESTIONS.find(q => q.id === questionId)
  const answerOk = !!question && question.a.some(v => normalize(v) === normalize(answer))

  if (!codeOk || !answerOk) {
    return res.status(400).json({ error: GENERIC_ERROR })
  }

  grantReader(userId)
  logUsage(userId, 'redeem')

  res.json({ success: true })
}

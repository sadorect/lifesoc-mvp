import { verifyAuth } from './audiobook/_auth.js'
import { QUESTIONS } from './_questions.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const userId = await verifyAuth(req, res)
  if (!userId) return

  const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]
  res.json({ questionId: question.id, questionText: question.q, ref: question.ref })
}

import './_env.js'
import { verifyAuth }     from './audiobook/_auth.js'
import { getEntitlement } from './_entitlement.js'

// Cheap, no-API-call heuristic to short-circuit obvious off-topic abuse
// (using this as a free general-purpose assistant) before spending on a
// completion. Conservative by design: only blocks when a message matches
// a clear off-topic pattern AND contains none of the book's vocabulary.
const OFF_TOPIC_VERB = /\b(write|generate|debug|solve|translate)\b/i
const OFF_TOPIC_NOUN = /\b(function|script|program(me)?|code|sql|regex|homework|poem|song|story|essay)\b/i

const OFF_TOPIC_PATTERNS = [
  /```/,
  /\bwhat('s| is)\s+the\s+weather\b/i,
  /\bwho\s+won\s+the\s+(game|match|election)\b/i,
  /\blatest\s+news\b/i,
  /\brecipe\s+for\b/i,
  /\bcapital\s+of\s+\w+/i,
]

const ON_TOPIC_KEYWORDS = [
  'zero trust', 'attack surface', 'cve', 'vulnerab', 'threat', 'breach',
  'incident', 'patch', 'ioc', 'indicator', 'soc', 'security', 'hack',
  'red team', 'boundary', 'boundaries', 'trust', 'risk', 'resilien',
  'legacy code', 'social engineer', 'open port', 'access', 'exposure',
  'relationship', 'finance', 'career', 'health', 'reputation', 'emotional',
  'mental', 'domain', 'zero-day', 'fingerprint', 'defense', 'defence',
  'harden', 'recover', 'containment', 'eradication', 'red-team',
]

function isLikelyOffTopic(messages) {
  const last = [...messages].reverse().find(m => m.role === 'user')
  const text = (last?.content || '').toString().toLowerCase()
  const matchesOffTopic = OFF_TOPIC_PATTERNS.some(re => re.test(text))
    || (OFF_TOPIC_VERB.test(text) && OFF_TOPIC_NOUN.test(text))
  if (!matchesOffTopic) return false
  const matchesOnTopic = ON_TOPIC_KEYWORDS.some(kw => text.includes(kw))
  return !matchesOnTopic
}

const SYSTEM_PROMPT = `You are the LifeSOC AI Analyst — a personal security adviser operating within the Zero Trust framework for intentional living, based on "Zero Trust: A Hacker's Blueprint for a Secure Life."

THE FRAMEWORK
You apply ethical hacking methodology to human life. Every person is a system with architecture, vulnerabilities, and an attack surface. Security is a posture — continuous, imperfect, worth maintaining.

SIX LIFE DOMAINS
Relationships · Finances · Career & Purpose · Health · Reputation · Mental & Emotional State

KEY CONCEPTS
• Attack Surface: Every exposure point — connections, responsibilities, access channels never reviewed
• CVE Register: Personal vulnerability database — Managed (aware + addressing), Unmanaged (aware + deferring), Denial (present but disputed)
• Open Ports: Access channels to time, attention, money, emotional energy — need authentication, rate limiting, logging
• Legacy Code: Old psychological programming running in present-day contexts it wasn't written for
• Social Engineering Levers (Cialdini, 1984): Flattery, Urgency, Scarcity, Authority, Belonging, Reciprocity
• Patch Management: Deliberate incremental change — one Tuesday at a time, not all at once
• Indicators of Compromise (IoCs): Early signals — physical tension, energy depletion, relational friction, financial drift, identity erosion
• Incident Response: Identification → Containment → Eradication → Recovery → Post-Incident Review
• Red Teaming: Adversarial analysis of your own plans — how would this fail?
• SOC: Your inner circle — truth-tellers, pattern-recognisers, domain experts, accountability partners
• Zero-Day: A wound or pattern unknown until circumstances revealed it
• Fingerprinting: Reading character from behaviour under pressure, not from self-report

RULES OF ENGAGEMENT
1. Life truth always leads — the hacking metaphor serves, never the reverse
2. Be specific and actionable — no generic platitudes
3. Ask one clarifying question when ambiguous — not several
4. Be the truth-telling node in their SOC: warm, honest, never flattering
5. Never catastrophise, never minimise — accurate information is always the goal
6. Reference the user's specific situation when they share it

When analysing: Which domain is affected? Is this a known CVE or new zero-day? What attack vectors are present? What IoC pattern is this? What patch addresses the root cause?

SCOPE
You only discuss the Zero Trust framework as applied to the six life domains above. If asked about anything unrelated — writing code, general trivia, translation, homework, current events, or any other topic outside this framework — politely decline in one sentence and redirect back to their SOC/life-security context. Do not answer the off-topic request.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const userId = await verifyAuth(req, res)
  if (!userId) return

  const { status } = await getEntitlement(userId)
  if (status !== 'active') return res.status(403).json({ error: 'Book not redeemed or expired' })

  const { messages } = req.body
  if (!messages?.length) return res.status(400).json({ error: 'messages required' })

  if (isLikelyOffTopic(messages)) {
    return res.status(400).json({ error: "I'm scoped to your Zero Trust life-security coaching — that's outside what I help with here." })
  }

  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages
      })
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.error?.message || 'API error' })
    }

    const data = await response.json()
    res.json({ content: data.content[0].text })
  } catch (err) {
    console.error('Chat error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
}

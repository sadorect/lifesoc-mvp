import './_env.js'

const SCAN_PROMPT = `You are the LifeSOC IoC Scanner. Analyse the user's description for Indicators of Compromise (IoCs) — early warning signals that a life domain breach may be developing.

Respond ONLY with valid JSON in this exact structure:
{
  "riskLevel": "low" | "medium" | "high" | "critical",
  "summary": "1-2 sentence overview of what the scan found",
  "findings": [
    {
      "ioc": "Brief name of the indicator",
      "domain": "relationships" | "finances" | "career" | "health" | "reputation" | "mental",
      "severity": "low" | "medium" | "high" | "critical",
      "description": "What this indicator suggests in 1-2 sentences",
      "recommendation": "One specific, actionable next step"
    }
  ]
}

IoC categories to check for:
BODY: persistent physical tension, sleep changes, appetite disruption, chronic fatigue, unexplained physical symptoms
ENERGY: loss of engagement with previously meaningful activities, motivational flatness, enjoyment deficit
RELATIONAL: reduced communication ease, avoided conversations, shift in who you spend time with, increased conflict
FINANCIAL: direction of savings rate, changed spending patterns, avoided financial review, new financial obligations
IDENTITY: suppressed opinions, softened preferences in specific contexts, performance of a self that doesn't fit
COGNITIVE: difficulty concentrating, decision avoidance, circular thinking, black-and-white framing

Return 1-5 findings. If nothing concerning is present, return an empty findings array with riskLevel "low".
Do not include any text outside the JSON object.`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { input } = req.body
  if (!input?.trim()) return res.status(400).json({ error: 'input required' })

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
        system: SCAN_PROMPT,
        messages: [{ role: 'user', content: input }]
      })
    })

    if (!response.ok) {
      const err = await response.json()
      return res.status(response.status).json({ error: err.error?.message || 'API error' })
    }

    const data = await response.json()
    let text = data.content[0].text.trim()

    // Models sometimes wrap JSON in markdown code fences or add prose.
    // Strip fences and extract the outermost JSON object before parsing.
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1) text = text.slice(start, end + 1)

    let result
    try {
      result = JSON.parse(text)
    } catch (parseErr) {
      console.error('Scan JSON parse failed. Raw model output:', text)
      return res.status(502).json({ error: 'Scanner returned an unreadable response — please try again' })
    }
    res.json(result)
  } catch (err) {
    console.error('Scan error:', err)
    res.status(500).json({ error: 'Scan failed — check your input and try again' })
  }
}

const DEFAULT_MODEL = 'qwen/qwen3-32b'

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL

  if (!apiKey) {
    console.error('[groq-api] GROQ_API_KEY is not configured')
    return response.status(500).json({ error: 'GROQ_API_KEY is not configured' })
  }

  try {
    const { system, messages, max_tokens: maxTokens } = request.body || {}

    if (typeof system !== 'string' || !Array.isArray(messages)) {
      return response.status(400).json({ error: 'Invalid request body' })
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: maxTokens || 600,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    })

    const result = await groqResponse.json()
    if (!groqResponse.ok) {
      console.error('[groq-api] Groq request failed:', groqResponse.status, result)
    }

    return response.status(groqResponse.status).json(result)
  } catch (error) {
    console.error('[groq-api] Request failed:', error)
    return response.status(500).json({ error: 'Unable to reach Groq' })
  }
}
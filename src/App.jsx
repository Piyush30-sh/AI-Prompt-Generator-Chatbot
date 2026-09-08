import { useEffect, useRef, useState } from 'react'
import './App.css'

const SYSTEM_PROMPT = `You are Prompt Distillery, an expert prompt architect.
Turn the user's goal and answers into a precise, production-ready prompt.
Ask at most 2 focused questions, one per turn, then finish. Return JSON only.
Question JSON: {"type":"question","field":"role|tone|format|constraints","text":"...","chips":["up to 3 concise choices"]}
Final JSON: {"type":"final","prompt":"complete markdown prompt"}
For questions, return only the requested field. For the final response, include a complete prompt with role/objective, task interpretation, execution steps, output format, constraints, and a quality check. Never invent requirements.`

// In-memory cache for API requests to avoid duplicate API calls
const apiCache = new Map()



const QUESTIONS = [
  {
    field: 'role',
    label: 'Persona & Role',
    prompt: 'What persona or domain expertise should the AI take on?',
    chips: ['Senior Subject-Matter Expert', 'Direct & Action-Oriented Consultant', 'Supportive Coach / Mentor', 'Creative Strategist', 'Skip / Default Assistant']
  },
  {
    field: 'tone',
    label: 'Tone & Style',
    prompt: 'What tone or voice best fits this output?',
    chips: ['Professional & Authoritative', 'Friendly & Conversational', 'Concise & Bulleted', 'Technical & Precise', 'Persuasive & Engaging']
  },
  {
    field: 'format',
    label: 'Output Format',
    prompt: 'How should the output be structured?',
    chips: ['Structured Markdown with Headers', 'Bulleted Action Items', 'Step-by-Step SOP Guide', 'Clean Table Comparison', 'Ready-to-Paste Draft']
  },
  {
    field: 'constraints',
    label: 'Constraints & Rules',
    prompt: 'Any critical guardrails or negative constraints to avoid?',
    chips: ['No Fluff / Direct to Point', 'Keep under 300 words', 'Include actionable examples', 'Zero buzzwords/jargon', 'None / Flexible']
  },
]

const QUICK_STARTER_GOALS = [
  { label: '📧 Cold Outreach Email', task: 'Write a high-converting cold outreach email to B2B SaaS decision-makers' },
  { label: '📝 Blog / SEO Post', task: 'Write an in-depth, authoritative SEO blog post on modern cloud architecture' },
  { label: '🐛 Code Review & Refactor', task: 'Review and refactor complex React components for clean code and performance' },
  { label: '💡 Pitch Deck Structure', task: 'Create a 10-slide investor pitch deck outline for an AI startup' },
  { label: '🎯 Autonomous System Prompt', task: 'Create an autonomous agent system prompt with strict tool-calling rules' }
]

const FIELD_META = [
  { key: 'task', label: 'Goal', icon: '🎯' },
  { key: 'role', label: 'Persona', icon: '👤' },
  { key: 'tone', label: 'Tone', icon: '🎙️' },
  { key: 'format', label: 'Structure', icon: '📐' },
  { key: 'constraints', label: 'Guardrails', icon: '🛡️' }
]

function buildTemplatePrompt(fields) {
  const role = !fields.role || /^skip/i.test(fields.role.trim()) 
    ? 'an elite, highly experienced subject-matter expert' 
    : fields.role.trim()
  const tone = fields.tone?.trim() || 'clear, professional, and directly actionable'
  const format = fields.format?.trim() || 'cleanly structured markdown with headings, bullets, and concise sections'
  const rawConstraints = fields.constraints?.trim()
  const hasConstraints = rawConstraints && !/^none/i.test(rawConstraints)

  const task = normalizeTemplateTask(fields.task)

  let prompt = `Act as ${role}. Complete this task directly: ${task}.\n\n`
  prompt += `Requirements:\n- Follow every user requirement exactly.\n- Return the finished deliverable only, not a prompt, plan, or explanation of these instructions.\n- Do not repeat the task or use meta-introductions such as "Here is a prompt."\n- Use specific details, avoid unsupported claims, and state any necessary assumptions briefly.\n\n`
  prompt += `Tone: ${tone}\nFormat: ${format}\n\n`
  
  if (hasConstraints) {
    const constraintItems = rawConstraints
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean)
    prompt += `Constraints:\n${constraintItems.map(c => `- ${c}`).join('\n')}\n\n`
  } else {
    prompt += `Constraints:\n- Start with the deliverable; no filler or generic disclaimers.\n- Be specific, concise, and useful.\n- Do not claim work was completed if it was not performed.\n\n`
  }

  prompt += `Before sending, check that the response is the finished deliverable, fulfills the objective, follows all requirements and constraints, and contains no filler or repetition.`
  return prompt
}

function normalizeTemplateTask(value) {
  const task = value?.trim()
  if (!task) return 'Provide expert execution of the requested task'

  const directTask = task
    .replace(/^(?:build|create|write|generate|make)\s+(?:a|an|the)\s+prompt\s+for\s+(?:a|an|the)\s+(.+?)\s+that\s+(?:must\s+)?/i, 'Act as $1 and ')
    .replace(/^(?:create|write|generate|make)\s+(?:a|an|the)\s+(?:reusable\s+)?prompt\s+(?:(?:that|which)\s+)?(?:(?:instruct(?:s|ing)?|ask(?:s|ing)?|tell(?:s|ing)?)\s+)?(?:for\s+)?(?:(?:an?|the)\s+)?(?:ai\s+)?(?:assistant|model|gpt|chatgpt)\s+(?:to|for)\s+/i, '')
    .replace(/^(?:create|write|generate|make)\s+(?:a|an|the)\s+prompt\s+(?:for\s+)?(?:(?:an?|the)\s+)?(?:ai\s+)?(?:assistant|model|gpt|chatgpt)\s+(?:to|for)\s+/i, '')
    .replace(/^(?:create|write|generate|make)\s+(?:a|an|the)\s+prompt\s+(?:to|for)\s+/i, '')
    .replace(/^prompt\s+(?:for\s+)?(?:(?:an?|the)\s+)?(?:ai\s+)?(?:assistant|model|gpt|chatgpt)\s+(?:to|for)\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.:;\s]+|[,.:;\s]+$/g, '')

  return directTask || 'Provide expert execution of the requested task'
}

async function callGroq(history, isFinal = false) {
  const cacheKey = JSON.stringify(history) + (isFinal ? '_final' : '_q')
  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey)
  }

  try {
    const response = await fetch('/api/groq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: SYSTEM_PROMPT,
        messages: history,
        max_tokens: isFinal ? 700 : 240
      })
    })
    if (!response.ok) throw new Error('Groq request failed')
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)
    parsed._tokens = data.usage?.total_tokens || 0
    apiCache.set(cacheKey, parsed)
    return parsed
  } catch {
    return { type: 'error' }
  }
}

const welcomeMsg = {
  role: 'bot',
  text: "Welcome to Prompt Distillery. I'll help you engineer a battle-tested, production-ready AI prompt. What task do you want an AI to perform?",
  chips: QUICK_STARTER_GOALS.map(g => g.label)
}

function App() {
  const [mode, setMode] = useState('ai') // Default to high-powered AI mode
  const [messages, setMessages] = useState([welcomeMsg])
  const [input, setInput] = useState('')
  const [fields, setFields] = useState({ task: '', role: '', tone: '', format: '', constraints: '' })
  const [awaitingTask, setAwaitingTask] = useState(true)
  const [stageIndex, setStageIndex] = useState(-1)
  const [pendingField, setPendingField] = useState('role')
  const [apiHistory, setApiHistory] = useState([])
  const [finalPrompt, setFinalPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shortenUsed, setShortenUsed] = useState(false)
  const [activeTab, setActiveTab] = useState('preview') // 'preview' | 'breakdown'
  const [tokensUsed, setTokensUsed] = useState(0)
  const scrollRef = useRef(null)
  const requestVersion = useRef(0)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const resetAll = (nextMode = mode) => {
    requestVersion.current += 1
    setMode(nextMode)
    setMessages([welcomeMsg])
    setInput('')
    setFields({ task: '', role: '', tone: '', format: '', constraints: '' })
    setAwaitingTask(true)
    setStageIndex(-1)
    setPendingField('role')
    setApiHistory([])
    setFinalPrompt('')
    setLoading(false)
    setCopied(false)
    setShortenUsed(false)
    setActiveTab('preview')
    setTokensUsed(0)
  }

  const handleParsedAi = (parsed, history) => {
    if (parsed._tokens) {
      setTokensUsed((c) => c + parsed._tokens)
    }
    // Update spec fields from the AI's extraction if available
    if (parsed.extracted_fields && typeof parsed.extracted_fields === 'object') {
      setFields((current) => ({
        task: parsed.extracted_fields.task || current.task || 'Prompt Goal',
        role: parsed.extracted_fields.role || current.role || 'Senior Domain Specialist',
        tone: parsed.extracted_fields.tone || current.tone || 'Professional & Direct',
        format: parsed.extracted_fields.format || current.format || 'Structured Markdown',
        constraints: parsed.extracted_fields.constraints || current.constraints || 'Zero fluff, highly actionable'
      }))
    }

    if (parsed.type === 'question') {
      setApiHistory([...history, { role: 'assistant', content: JSON.stringify(parsed) }])
      setPendingField(parsed.field || 'constraints')
      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: parsed.text,
          chips: parsed.chips && parsed.chips.length > 0 ? parsed.chips : ['Skip / Keep standard', 'Surprise me', 'Default recommended']
        }
      ])
    } else if (parsed.type === 'final' && parsed.prompt) {
      setApiHistory([...history, { role: 'assistant', content: JSON.stringify(parsed) }])
      setFinalPrompt(parsed.prompt)
      setShortenUsed(false)

      // Ensure that when the final prompt is created, ALL 5 fields are guaranteed populated!
      setFields((current) => ({
        task: current.task || 'Core Goal Specification',
        role: current.role || 'Specialized AI Consultant',
        tone: current.tone || 'Professional, Actionable, High-Density',
        format: current.format || 'Structured Markdown with Headings',
        constraints: current.constraints || 'Zero filler, direct execution, negative guardrails'
      }))

      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: '✨ Your prompt is compiled and ready in the right panel! Click a fine-tune chip or type your adjustments below.',
          chips: ['Make it more concise', 'Add strict negative constraints', 'Make tone more authoritative', 'Add JSON output format']
        }
      ])
    } else {
      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: 'Notice: Could not reach Groq. Check your connection or switch to Quick mode above.',
          chips: ['Switch to Quick Mode', 'Retry last response']
        }
      ])
    }
  }

  const handleTemplateAnswer = (text) => {
    const field = QUESTIONS[stageIndex].field
    const updated = { ...fields, [field]: text }
    setFields(updated)
    const next = stageIndex + 1
    if (next < QUESTIONS.length) {
      setStageIndex(next)
      setMessages((current) => [
        ...current,
        { role: 'bot', text: QUESTIONS[next].prompt, chips: QUESTIONS[next].chips }
      ])
    } else {
      setFinalPrompt(buildTemplatePrompt(updated))
      setShortenUsed(false)
      setStageIndex(-1)
      setMessages((current) => [
        ...current,
        {
          role: 'bot',
          text: '✨ Your prompt has been generated! Copy it directly or pick a chip below to tweak.',
          chips: ['Make it more concise', 'Add strict constraints', 'Make tone technical']
        }
      ])
    }
  }

  const handleSend = async (overrideText) => {
    let text = (overrideText ?? input).trim()
    if (!text || loading) return

    // Quick goal starter chips matching
    const matchedStarter = QUICK_STARTER_GOALS.find(g => g.label === text)
    if (matchedStarter) {
      text = matchedStarter.task
    }

    if (text === 'Switch to Quick Mode') {
      resetAll('template')
      return
    }
    if (text === 'Retry last response') {
      if (apiHistory.length > 0) {
        const currentRequest = requestVersion.current
        setLoading(true)
        const parsed = await callGroq(apiHistory)
        if (currentRequest !== requestVersion.current) return
        setLoading(false)
        handleParsedAi(parsed, apiHistory)
      }
      return
    }

    setMessages((current) => [...current, { role: 'user', text }])
    setInput('')

    if (awaitingTask) {
      setFields((current) => ({ ...current, task: text }))
      setAwaitingTask(false)
      if (mode === 'template') {
        setStageIndex(0)
        setMessages((current) => [
          ...current,
          { role: 'bot', text: QUESTIONS[0].prompt, chips: QUESTIONS[0].chips }
        ])
      } else {
        const currentRequest = requestVersion.current
        setLoading(true)
        const history = [{ role: 'user', content: `I want a prompt for: "${text}"` }]
        const parsed = await callGroq(history)
        if (currentRequest !== requestVersion.current) return
        setLoading(false)
        handleParsedAi(parsed, history)
      }
      return
    }

    if (finalPrompt) {
      if (mode === 'template') {
        if (text !== 'Make it more concise, punchy, and direct') {
          setShortenUsed(false)
        }
        const updated = {
          ...fields,
          constraints: fields.constraints ? `${fields.constraints}; ${text}` : text
        }
        setFields(updated)
        setFinalPrompt(buildTemplatePrompt(updated))
        setMessages((current) => [
          ...current,
          {
            role: 'bot',
            text: 'Updated prompt with your requested refinements! Check the panel.',
            chips: ['Make it even shorter', 'Add JSON output format', 'Done!']
          }
        ])
      } else {
        const currentRequest = requestVersion.current
        setLoading(true)
        const history = [
          ...apiHistory,
          { role: 'user', content: `Revise and refine the final prompt based on this request: "${text}". Reply with type final JSON only.` }
        ]
        const parsed = await callGroq(history, true)
        if (currentRequest !== requestVersion.current) return
        setLoading(false)
        handleParsedAi(parsed, history)
      }
      return
    }

    if (mode === 'template') {
      handleTemplateAnswer(text)
    } else {
      setFields((current) => ({ ...current, [pendingField]: text }))
      const currentRequest = requestVersion.current
      setLoading(true)
      const history = [...apiHistory, { role: 'user', content: text }]
      const parsed = await callGroq(history)
      if (currentRequest !== requestVersion.current) return
      setLoading(false)
      handleParsedAi(parsed, history)
    }
  }

  const filledCount = FIELD_META.filter((field) => fields[field.key]?.trim()).length
  const lastMsg = messages[messages.length - 1]
  const showChips = lastMsg?.role === 'bot' && lastMsg.chips && !loading
  const promptWordCount = finalPrompt ? finalPrompt.trim().split(/\s+/).length : 0

  return (
    <main className="pd-app">
      <header className="pd-header">
        <div className="pd-brand">
          <div className="pd-title-wrap">
            <span className="pd-badge-spark">✦</span>
            <span className="pd-title">AI Prompt</span>
          </div>
          <div className="pd-subtitle">Turn rough ideas into high-converting, production prompts with 1-click steps</div>
        </div>
        <div className="pd-header-right">
          <div className="pd-toggle">
            <button
              className={`pd-toggle-btn ${mode === 'ai' ? 'active' : ''}`}
              onClick={() => mode !== 'ai' && resetAll('ai')}
              title="Groq AI dynamic reasoning mode"
            >
              <span className="pd-sparkle">✦</span> Smart AI
            </button>
            <button
              className={`pd-toggle-btn ${mode === 'template' ? 'active' : ''}`}
              onClick={() => mode !== 'template' && resetAll('template')}
              title="Instant template mode"
            >
              ⚡ Quick Flow
            </button>
          </div>
          <button className="pd-reset" onClick={() => resetAll()} title="Start over">
            ↻ Reset
          </button>
        </div>
      </header>

      <div className="pd-body">
        <section className="pd-chat-col">
          <div className="pd-chat-header">
            <div className="pd-chat-status">
              <span className={`pd-status-dot ${mode === 'ai' ? 'ai' : 'quick'}`} />
              <span>{mode === 'ai' ? 'Autonomous AI Engine (Groq Qwen 27B)' : 'Rapid Template Mode'}</span>
            </div>
            <div className="pd-header-badges">
              {mode === 'ai' && (
                <span className="pd-token-badge" title="Live Groq tokens consumed">
                  ⚡ {tokensUsed > 0 ? `${tokensUsed} tokens` : 'Cached / 0 tokens'}
                </span>
              )}
              <div className="pd-step-badge">
                {awaitingTask ? 'Step 1: Define Goal' : finalPrompt ? 'Step 3: Export & Polish' : 'Step 2: Micro-Refinements'}
              </div>
            </div>
          </div>

          <div className="pd-messages" ref={scrollRef}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`pd-msg ${message.role === 'bot' ? 'pd-msg-bot' : 'pd-msg-user'}`}
              >
                <div className="pd-msg-sender">
                  {message.role === 'bot' ? 'Prompt Architect' : 'You'}
                </div>
                <div className="pd-msg-content">{message.text}</div>
              </div>
            ))}
            {loading && (
              <div className="pd-typing-card">
                <div className="pd-typing-dots">
                  <i /><i /><i />
                </div>
                <span className="pd-typing-text">Synthesizing prompt dimensions...</span>
              </div>
            )}
          </div>

          {showChips && (
            <div className="pd-chips-container">
              <div className="pd-chips-header">
                <span className="pd-chips-title">⚡ Instant Choices (Click to proceed):</span>
                <span className="pd-chips-hint">1-click forward</span>
              </div>
              <div className="pd-chips-list">
                {lastMsg.chips.map((chip, idx) => (
                  <button
                    key={idx}
                    className="pd-chip-btn"
                    onClick={() => handleSend(chip)}
                    disabled={loading}
                  >
                    <span className="pd-chip-arrow">↳</span>
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pd-input-row">
            <textarea
              className="pd-input"
              rows="1"
              placeholder={
                awaitingTask
                  ? "Describe your prompt goal (or click a starter chip above)..."
                  : finalPrompt
                  ? "Type adjustments (e.g. 'Add JSON schema', 'Make it punchier')..."
                  : "Type custom answer or click an instant chip above..."
              }
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  handleSend()
                }
              }}
              disabled={loading}
            />
            <button
              className="pd-send"
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              title="Send input"
            >
              {loading ? '…' : '→'}
            </button>
          </div>
        </section>

        <aside className="pd-panel">
          <div className="pd-panel-top">
            <div className="pd-panel-headline">
              <span className="pd-panel-title">Prompt Blueprint</span>
              <span className="pd-completion-rate">
                {Math.round((filledCount / FIELD_META.length) * 100)}% Refined
              </span>
            </div>
            <div className="pd-gauge">
              <div
                className="pd-gauge-fill"
                style={{ width: `${Math.round((filledCount / FIELD_META.length) * 100)}%` }}
              />
            </div>
          </div>

          <div className="pd-panel-tabs">
            <button
              className={`pd-tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              📜 Production Prompt {finalPrompt && `(${promptWordCount} words)`}
            </button>
            <button
              className={`pd-tab-btn ${activeTab === 'breakdown' ? 'active' : ''}`}
              onClick={() => setActiveTab('breakdown')}
            >
              🧩 Spec Dimensions ({filledCount}/5)
            </button>
          </div>

          {activeTab === 'breakdown' ? (
            <div className="pd-spec-grid">
              {FIELD_META.map((field) => (
                <div className="pd-field-card" key={field.key}>
                  <div className="pd-field-header">
                    <span className="pd-field-ico">{field.icon}</span>
                    <span className="pd-field-label">{field.label}</span>
                  </div>
                  <div className={`pd-field-value ${fields[field.key] ? '' : 'pd-field-empty'}`}>
                    {fields[field.key] || 'Not specified yet'}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="pd-preview-area">
              {finalPrompt ? (
                <div className="pd-prompt-box">
                  <div className="pd-prompt-meta">
                    <span className="pd-status-pill">Ready to Deploy</span>
                    <span className="pd-char-count">{promptWordCount} words • {finalPrompt.length} chars</span>
                  </div>
                  <pre className="pd-prompt-content">{finalPrompt}</pre>
                  <div className="pd-action-bar">
                    <button
                      className="pd-primary-btn"
                      onClick={() => {
                        navigator.clipboard?.writeText(finalPrompt)
                        setCopied(true)
                        window.setTimeout(() => setCopied(false), 2000)
                      }}
                    >
                      {copied ? '✓ Copied to Clipboard!' : '📋 Copy Production Prompt'}
                    </button>
                    <button
                      className="pd-secondary-btn"
                      onClick={() => {
                        setShortenUsed(true)
                        handleSend('Make it more concise, punchy, and direct')
                      }}
                      disabled={loading || shortenUsed}
                      title={shortenUsed ? 'Already shortened' : 'Make the prompt shorter'}
                    >
                      {shortenUsed ? '✓ Shortened' : '⚡ Shorten'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="pd-empty-state">
                  <div className="pd-empty-icon">🧪</div>
                  <div className="pd-empty-title">Distillation in Progress</div>
                  <p className="pd-empty-desc">
                    Pick quick starter chips or type your goal on the left.
                    Your production-ready, structured LLM prompt will form right here in real time.
                  </p>
                  <div className="pd-feature-checklist">
                    <div className="pd-chk-item">✓ Persona & Clear Objective</div>
                    <div className="pd-chk-item">✓ Step-by-Step Execution Rules</div>
                    <div className="pd-chk-item">✓ Formatting & Strict Constraints</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </main>
  )
}

export default App

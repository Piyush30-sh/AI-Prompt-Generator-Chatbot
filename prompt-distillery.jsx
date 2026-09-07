import { useState, useRef, useEffect } from "react";
import { Send, Copy, Check, RotateCcw, FlaskConical, Loader2 } from "lucide-react";

const TEMPLATE_QUESTIONS = [
  {
    field: "role",
    prompt: "Should the AI take on a specific persona or expertise? (e.g. \"senior copywriter\", \"patient tutor\") Or just say skip.",
    chips: ["Skip", "Subject-matter expert", "Friendly coach", "Senior professional"],
  },
  {
    field: "tone",
    prompt: "What tone or style should it use?",
    chips: ["Professional", "Friendly", "Concise", "Playful", "Technical"],
  },
  {
    field: "format",
    prompt: "How should the output be structured?",
    chips: ["Plain paragraphs", "Bulleted list", "Numbered steps", "Table", "Code block"],
  },
  {
    field: "constraints",
    prompt: "Anything specific to include or avoid? Word limits, must-haves, things to skip — or say none.",
    chips: ["None"],
  },
];

const FIELD_META = [
  { key: "task", label: "Goal" },
  { key: "role", label: "Role" },
  { key: "tone", label: "Tone" },
  { key: "format", label: "Format" },
  { key: "constraints", label: "Constraints" },
];

const WELCOME_MESSAGE = {
  role: "bot",
  text: "Hi — I'll help you craft a sharp AI prompt. What do you want an AI to help you do?",
};

function buildTemplatePrompt(f) {
  const role =
    !f.role || /^skip$/i.test(f.role.trim()) ? "a knowledgeable, capable assistant" : f.role.trim();
  const tone = f.tone && f.tone.trim() ? f.tone.trim() : "clear and professional";
  const format = f.format && f.format.trim() ? f.format.trim() : "plain, well-organized prose";
  const rawConstraints = f.constraints ? f.constraints.trim() : "";
  const hasConstraints = rawConstraints && !/^none$/i.test(rawConstraints);

  let out = `You are ${role}.\n\n`;
  out += `Task: ${f.task ? f.task.trim() : ""}\n\n`;
  out += `Tone & style: ${tone}\n\n`;
  out += `Output format: ${format}`;
  if (hasConstraints) {
    const parts = rawConstraints
      .split(/[,;.]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    out += `\n\nConstraints:\n${parts.map((p) => `- ${p}`).join("\n")}`;
  }
  return out;
}

export default function PromptDistillery() {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [fields, setFields] = useState({ task: "", role: "", tone: "", format: "", constraints: "" });
  const [awaitingTask, setAwaitingTask] = useState(true);
  const [stageIndex, setStageIndex] = useState(-1);
  const [finalPrompt, setFinalPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function resetAll() {
    setMessages([WELCOME_MESSAGE]);
    setInput("");
    setFields({ task: "", role: "", tone: "", format: "", constraints: "" });
    setAwaitingTask(true);
    setStageIndex(-1);
    setFinalPrompt("");
    setLoading(false);
    setCopied(false);
  }

  function handleTemplateAnswer(text) {
    const field = TEMPLATE_QUESTIONS[stageIndex].field;
    const updated = { ...fields, [field]: text };
    setFields(updated);
    const next = stageIndex + 1;
    if (next < TEMPLATE_QUESTIONS.length) {
      setStageIndex(next);
      const q = TEMPLATE_QUESTIONS[next];
      setMessages((m) => [...m, { role: "bot", text: q.prompt, chips: q.chips }]);
    } else {
      setFinalPrompt(buildTemplatePrompt(updated));
      setStageIndex(-1);
      setMessages((m) => [
        ...m,
        { role: "bot", text: "Your prompt is ready — check the panel. Want changes? Just tell me what to tweak." },
      ]);
    }
  }

  async function handleSend(overrideText) {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");

    if (awaitingTask) {
      setFields((f) => ({ ...f, task: text }));
      setAwaitingTask(false);
      setStageIndex(0);
      const q = TEMPLATE_QUESTIONS[0];
      setMessages((m) => [...m, { role: "bot", text: q.prompt, chips: q.chips }]);
      return;
    }

    if (finalPrompt) {
      const updated = { ...fields, constraints: fields.constraints ? `${fields.constraints}; ${text}` : text };
      setFields(updated);
      setFinalPrompt(buildTemplatePrompt(updated));
      setMessages((m) => [...m, { role: "bot", text: "Updated the prompt — take a look." }]);
      return;
    }

    handleTemplateAnswer(text);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const filledCount = FIELD_META.filter((f) => fields[f.key] && fields[f.key].trim()).length;
  const gaugePct = Math.round((filledCount / FIELD_META.length) * 100);
  const lastMsg = messages[messages.length - 1];
  const showChips =
    lastMsg && lastMsg.role === "bot" && lastMsg.chips && !finalPrompt && !loading;

  return (
    <div className="pd-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Public+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

        .pd-app {
          --paper: #EFEAD8;
          --paper-deep: #E3DCC5;
          --ink: #1E2A24;
          --ink-soft: #5B685F;
          --amber: #B8742F;
          --amber-deep: #9C5F22;
          --sage: #57705A;
          --sage-pale: #DCE3D3;
          --line: #C9C0A4;
          font-family: 'Public Sans', sans-serif;
          background: var(--paper);
          color: var(--ink);
          border-radius: 4px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 640px;
          max-height: 90vh;
          border: 1px solid var(--line);
        }
        .pd-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px;
          border-bottom: 1px solid var(--line);
          flex-shrink: 0;
        }
        .pd-title-wrap { display: flex; align-items: center; gap: 10px; }
        .pd-title {
          font-family: 'Fraunces', serif;
          font-size: 21px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .pd-subtitle { font-size: 12.5px; color: var(--ink-soft); margin-top: 2px; }
        .pd-header-right { display: flex; align-items: center; gap: 14px; }
        .pd-mode-label { font-size: 12.5px; color: var(--ink-soft); }
        .pd-reset {
          border: none;
          background: transparent;
          cursor: pointer;
          color: var(--ink-soft);
          display: flex;
          align-items: center;
          padding: 6px;
          border-radius: 6px;
          transition: background 0.2s, color 0.2s;
        }
        .pd-reset:hover { background: var(--paper-deep); color: var(--ink); }
        .pd-body { display: flex; flex: 1; min-height: 0; }
        .pd-chat-col { flex: 1 1 58%; display: flex; flex-direction: column; min-width: 0; }
        .pd-messages { flex: 1; overflow-y: auto; padding: 20px 22px; display: flex; flex-direction: column; gap: 12px; }
        .pd-msg { max-width: 82%; padding: 10px 14px; border-radius: 3px; font-size: 14px; line-height: 1.5; }
        .pd-msg-bot { align-self: flex-start; background: var(--sage-pale); color: var(--ink); border-left: 2px solid var(--sage); }
        .pd-msg-user { align-self: flex-end; background: var(--ink); color: var(--paper); border-right: 2px solid var(--amber); }
        .pd-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 22px 14px; }
        .pd-chip {
          border: 1px solid var(--line);
          background: var(--paper);
          font-family: 'Public Sans', sans-serif;
          font-size: 12.5px;
          padding: 6px 12px;
          border-radius: 999px;
          cursor: pointer;
          color: var(--ink);
          transition: border-color 0.2s, background 0.2s;
        }
        .pd-chip:hover { border-color: var(--amber); background: var(--sage-pale); }
        .pd-typing { align-self: flex-start; display: flex; gap: 4px; padding: 12px 14px; }
        .pd-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sage); animation: pd-bounce 1.1s infinite ease-in-out; }
        .pd-dot:nth-child(2) { animation-delay: 0.15s; }
        .pd-dot:nth-child(3) { animation-delay: 0.3s; }
        @keyframes pd-bounce { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
        .pd-input-row {
          display: flex;
          gap: 8px;
          padding: 14px 22px;
          border-top: 1px solid var(--line);
          flex-shrink: 0;
        }
        .pd-input {
          flex: 1;
          border: 1px solid var(--line);
          background: var(--paper);
          border-radius: 3px;
          padding: 10px 12px;
          font-family: 'Public Sans', sans-serif;
          font-size: 14px;
          color: var(--ink);
          resize: none;
        }
        .pd-input:focus { outline: none; border-color: var(--amber); }
        .pd-send {
          border: none;
          background: var(--ink);
          color: var(--paper);
          border-radius: 3px;
          width: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .pd-send:hover { background: var(--amber-deep); }
        .pd-send:disabled { opacity: 0.4; cursor: default; }
        .pd-panel {
          flex: 1 1 42%;
          background: var(--paper-deep);
          border-left: 1px solid var(--line);
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-width: 0;
        }
        .pd-panel-title { font-family: 'Fraunces', serif; font-size: 15px; font-weight: 600; }
        .pd-gauge { height: 3px; background: var(--line); border-radius: 999px; overflow: hidden; }
        .pd-gauge-fill { height: 100%; background: var(--amber); transition: width 0.4s ease; }
        .pd-field { border-bottom: 1px solid var(--line); padding-bottom: 8px; }
        .pd-field-label { font-size: 11.5px; color: var(--ink-soft); margin-bottom: 3px; }
        .pd-field-value { font-size: 13.5px; line-height: 1.4; }
        .pd-field-empty { color: var(--ink-soft); font-style: italic; }
        .pd-vial {
          margin-top: auto;
          background: var(--paper);
          border: 1px solid var(--line);
          border-radius: 3px;
          padding: 14px;
        }
        .pd-vial-text {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 12.5px;
          white-space: pre-wrap;
          line-height: 1.6;
          max-height: 220px;
          overflow-y: auto;
        }
        .pd-vial-actions { display: flex; gap: 8px; margin-top: 10px; }
        .pd-copy-btn {
          border: 1px solid var(--amber);
          background: transparent;
          color: var(--amber-deep);
          font-family: 'Public Sans', sans-serif;
          font-size: 12.5px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: background 0.2s, color 0.2s;
        }
        .pd-copy-btn:hover { background: var(--amber); color: var(--paper); }
        .pd-empty-vial { font-size: 13px; color: var(--ink-soft); line-height: 1.5; }
        .pd-spin { animation: pd-spin 0.9s linear infinite; }
        @keyframes pd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .pd-body { flex-direction: column; }
          .pd-panel { border-left: none; border-top: 1px solid var(--line); }
        }
      `}</style>

      <div className="pd-header">
        <div>
          <div className="pd-title-wrap">
            <FlaskConical size={19} color="var(--sage)" />
            <span className="pd-title">Prompt Distillery</span>
          </div>
          <div className="pd-subtitle">Answer a few questions, get a ready-to-use prompt</div>
        </div>
        <div className="pd-header-right">
          <span className="pd-mode-label">Quick mode</span>
          <button className="pd-reset" onClick={resetAll} title="Start over">
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      <div className="pd-body">
        <div className="pd-chat-col">
          <div className="pd-messages" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={m.role === "bot" ? "pd-msg pd-msg-bot" : "pd-msg pd-msg-user"}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="pd-typing">
                <div className="pd-dot" />
                <div className="pd-dot" />
                <div className="pd-dot" />
              </div>
            )}
          </div>
          {showChips && (
            <div className="pd-chips">
              {lastMsg.chips.map((c) => (
                <button key={c} className="pd-chip" onClick={() => handleSend(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="pd-input-row">
            <textarea
              className="pd-input"
              rows={1}
              placeholder="Type your answer..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />
            <button className="pd-send" onClick={() => handleSend()} disabled={loading || !input.trim()}>
              {loading ? <Loader2 size={16} className="pd-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>

        <div className="pd-panel">
          <div>
            <div className="pd-panel-title">Your prompt, forming</div>
            <div className="pd-gauge" style={{ marginTop: 10 }}>
              <div className="pd-gauge-fill" style={{ width: `${gaugePct}%` }} />
            </div>
          </div>

          {FIELD_META.map((f) => (
            <div className="pd-field" key={f.key}>
              <div className="pd-field-label">{f.label}</div>
              <div className={`pd-field-value ${fields[f.key] ? "" : "pd-field-empty"}`}>
                {fields[f.key] ? fields[f.key] : "not yet answered"}
              </div>
            </div>
          ))}

          {finalPrompt ? (
            <div className="pd-vial">
              <div className="pd-vial-text">{finalPrompt}</div>
              <div className="pd-vial-actions">
                <button
                  className="pd-copy-btn"
                  onClick={() => {
                    navigator.clipboard.writeText(finalPrompt);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy prompt"}
                </button>
              </div>
            </div>
          ) : (
            <div className="pd-empty-vial">Keep answering in the chat — your finished prompt will appear here.</div>
          )}
        </div>
      </div>
    </div>
  );
}

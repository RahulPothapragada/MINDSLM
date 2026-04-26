import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Send, Plus, ChevronLeft } from 'lucide-react'
import Layout from '../components/Layout'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const CLS_COLORS = {
  Anxiety:    { bg: 'rgba(255,214,10,0.10)',  border: 'rgba(255,214,10,0.22)',  color: '#ffd60a' },
  Depression: { bg: 'rgba(255,69,58,0.10)',   border: 'rgba(255,69,58,0.22)',   color: '#ff453a' },
  Suicidal:   { bg: 'rgba(255,69,58,0.15)',   border: 'rgba(255,69,58,0.28)',   color: '#ff6961' },
  Normal:     { bg: 'rgba(48,209,88,0.10)',   border: 'rgba(48,209,88,0.22)',   color: '#30d158' },
}

const SEV_DOT = {
  minimal:  '#30d158',
  mild:     '#ffd60a',
  moderate: '#ff9f0a',
  severe:   '#ff453a',
}

function generateId() { return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) }

const SUGGESTIONS = ["I've been feeling anxious", "I can't sleep lately", "I feel really low today"]

export default function Chat({ user }) {
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [messages, setMessages]         = useState([])
  const [input, setInput]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [activeSession, setActiveSession] = useState(sessionId || generateId())
  const [sessions, setSessions]         = useState([])
  const [hoveredSession, setHoveredSession] = useState(null)
  const ref     = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    fetch(`${API}/api/sessions`).then(r => r.json()).then(d => setSessions(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    const mood = searchParams.get('mood')
    if (mood && messages.length === 0) setTimeout(() => send(mood), 300)
  }, [])

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [messages, loading])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: activeSession }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant', content: data.response,
        emotions: data.emotions, classification: data.classification,
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Couldn't reach the API. Is the backend running?" }])
    }
    setLoading(false)
  }

  function newSession() {
    const id = generateId()
    setActiveSession(id)
    setMessages([])
    navigate(`/chat/${id}`)
  }

  return (
    <Layout user={user}>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

        {/* Sessions sidebar */}
        <div style={{
          width: 200, flexShrink: 0,
          borderRight: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', flexDirection: 'column',
          background: '#000',
        }}>
          <div style={{ padding: '10px 10px 6px' }}>
            <button
              onClick={newSession}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                padding: '8px 10px', borderRadius: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#aeaeb2', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#f5f5f7' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#aeaeb2' }}
            >
              <Plus size={12} strokeWidth={2.5} /> New session
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => navigate(`/chat/${s.id}`)}
                onMouseEnter={() => setHoveredSession(s.id)}
                onMouseLeave={() => setHoveredSession(null)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '8px 10px', borderRadius: 7,
                  border: 'none', cursor: 'pointer',
                  background: s.id === activeSession
                    ? 'rgba(255,255,255,0.05)'
                    : hoveredSession === s.id ? 'rgba(255,255,255,0.03)' : 'transparent',
                  transition: 'background 0.10s',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {s.severity && (
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: SEV_DOT[s.severity] || '#3a3a3c', flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: s.id === activeSession ? 500 : 400,
                    color: s.id === activeSession ? '#f5f5f7' : '#8e8e93',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.name || 'Check-in'}
                  </div>
                  <div style={{ fontSize: 10, color: '#3a3a3c', marginTop: 1 }}>{s.message_count || 0} msgs</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{
            height: 52, borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0,
          }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636366', display: 'flex', padding: 4, borderRadius: 6, transition: 'color 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#aeaeb2'}
              onMouseLeave={e => e.currentTarget.style.color = '#636366'}
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f7', letterSpacing: '-0.01em' }}>Check-in</div>
              <div style={{ fontSize: 11, color: '#3a3a3c' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={ref}
            style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {messages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', animation: 'fadeUp 0.3s ease forwards' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
                  <p style={{ color: '#636366', fontSize: 14, marginBottom: 20 }}>What's on your mind?</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        style={{
                          fontSize: 12, padding: '7px 14px', borderRadius: 99,
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(255,255,255,0.03)', color: '#8e8e93',
                          cursor: 'pointer', transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#aeaeb2'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#8e8e93'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', animation: 'fadeUp 0.2s ease forwards' }}>
                <div style={{ maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 6, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    padding: '11px 16px',
                    borderRadius: 16,
                    fontSize: 14,
                    lineHeight: 1.6,
                    ...(m.role === 'user'
                      ? { background: 'rgba(255,255,255,0.08)', color: '#f5f5f7', borderBottomRightRadius: 4, border: '1px solid rgba(255,255,255,0.10)' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e5e7', borderBottomLeftRadius: 4 })
                  }}>
                    {m.content}
                  </div>

                  {(m.emotions?.length > 0 || m.classification) && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '0 2px' }}>
                      {m.emotions?.slice(0, 3).map((e, j) => (
                        <span key={j} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.18)', color: '#30d158', fontWeight: 500 }}>
                          {e.label}
                        </span>
                      ))}
                      {m.classification && (() => {
                        const c = CLS_COLORS[m.classification] || CLS_COLORS.Normal
                        return (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontWeight: 500 }}>
                            {m.classification}
                          </span>
                        )
                      })()}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, borderBottomLeftRadius: 4, padding: '13px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#636366', display: 'block', animation: `bounce 0.9s ease-in-out infinite`, animationDelay: `${i * 0.18}s` }} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '12px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 14, padding: '10px 10px 10px 16px',
            }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="What's on your mind…"
                style={{
                  flex: 1, background: 'transparent', border: 'none',
                  fontSize: 14, color: '#f5f5f7', outline: 'none',
                }}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim()}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: input.trim() ? 'pointer' : 'default',
                  background: input.trim() ? '#30d158' : 'rgba(255,255,255,0.06)',
                  transition: 'all 0.15s', flexShrink: 0,
                }}
              >
                <Send size={13} color={input.trim() ? '#000' : '#3a3a3c'} strokeWidth={2.2} />
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#3a3a3c', marginTop: 8 }}>
              Not for emergencies · If in crisis, call or text <span style={{ color: '#636366' }}>988</span>
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}

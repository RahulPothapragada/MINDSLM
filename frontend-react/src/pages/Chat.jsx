import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { Send, Plus, ChevronLeft, Mic, MicOff, Trash2, MessageSquare, Radio, PanelRightOpen, PanelRightClose } from 'lucide-react'
import Layout from '../components/Layout'
import RobotAvatar from '../components/RobotAvatar'
import { SplineScene } from '../components/SplineScene'
import { Spotlight } from '../components/Spotlight'

const API          = import.meta.env.VITE_API_URL || 'http://localhost:8080'
const SPLINE_SCENE = 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode'

const AVATARS = [
  { id: 'atlas', label: 'Atlas', desc: 'Sleek & precise' },
  { id: 'nova',  label: 'Nova',  desc: '3D interactive' },
]

const CLS_COLORS = {
  Anxiety:    { bg: 'rgba(255,214,10,0.10)',  border: 'rgba(255,214,10,0.22)',  color: '#ffd60a' },
  Depression: { bg: 'rgba(255,69,58,0.10)',   border: 'rgba(255,69,58,0.22)',   color: '#ff453a' },
  Suicidal:   { bg: 'rgba(255,69,58,0.15)',   border: 'rgba(255,69,58,0.28)',   color: '#ff6961' },
  Abuse:      { bg: 'rgba(255,100,10,0.15)',  border: 'rgba(255,100,10,0.30)',  color: '#ff6423' },
  Normal:     { bg: 'rgba(48,209,88,0.10)',   border: 'rgba(48,209,88,0.22)',   color: '#30d158' },
}

function generateId() { return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7) }

const SUGGESTIONS = ["I've been feeling anxious", "I can't sleep lately", "I feel really low today"]

function EmotionHUD({ emotions, classification }) {
  if (!emotions?.length) return null
  const cls = CLS_COLORS[classification] || CLS_COLORS.Normal
  const top = emotions.slice(0, 5)
  const size = 220
  const cx = size / 2, cy = size / 2, r = 80

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {/* Outer pulse ring */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        border: `1px solid ${cls.color}22`,
        animation: 'hud-ping 2s ease-in-out infinite',
      }} />
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        {/* Decorative rings */}
        <circle cx={cx} cy={cy} r={r + 18} fill="none" stroke={`${cls.color}18`} strokeWidth={1} strokeDasharray="4 6" />
        <circle cx={cx} cy={cy} r={r + 32} fill="none" stroke={`${cls.color}0e`} strokeWidth={1} />

        {/* Spokes + data points */}
        {top.map((e, i) => {
          const angle = (i / top.length) * 2 * Math.PI - Math.PI / 2
          const val   = e.score
          const x1 = cx + Math.cos(angle) * 20
          const y1 = cy + Math.sin(angle) * 20
          const x2 = cx + Math.cos(angle) * r * val
          const y2 = cy + Math.sin(angle) * r * val
          const lx = cx + Math.cos(angle) * (r + 10)
          const ly = cy + Math.sin(angle) * (r + 10)
          return (
            <g key={i}>
              <line x1={cx} y1={cy} x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r}
                stroke={`${cls.color}20`} strokeWidth={1} />
              <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={cls.color} strokeWidth={1.5} strokeLinecap="round"
                style={{ transition: 'all 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
              <circle cx={x2} cy={y2} r={3} fill={cls.color} opacity={0.9} />
              <text x={lx} y={ly + 4} textAnchor="middle" fill={cls.color} fontSize={8} fontFamily="monospace" opacity={0.7}>
                {e.label.toUpperCase().slice(0, 7)}
              </text>
            </g>
          )
        })}

        {/* Radar polygon */}
        <polygon
          points={top.map((e, i) => {
            const angle = (i / top.length) * 2 * Math.PI - Math.PI / 2
            return `${cx + Math.cos(angle) * r * e.score},${cy + Math.sin(angle) * r * e.score}`
          }).join(' ')}
          fill={`${cls.color}18`} stroke={`${cls.color}55`} strokeWidth={1}
          style={{ transition: 'all 0.8s cubic-bezier(0.4,0,0.2,1)' }}
        />

        {/* Center */}
        <circle cx={cx} cy={cy} r={18} fill={`${cls.color}15`} stroke={`${cls.color}50`} strokeWidth={1} />
      </svg>

      {/* Center label */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        textAlign: 'center', pointerEvents: 'none',
      }}>
        <div style={{ fontSize: 9, color: cls.color, fontFamily: 'monospace', letterSpacing: '0.08em', opacity: 0.9 }}>
          {classification?.toUpperCase()}
        </div>
        <div style={{ fontSize: 11, color: cls.color, fontWeight: 700, fontFamily: 'monospace' }}>
          {Math.round((emotions[0]?.score || 0) * 100)}%
        </div>
      </div>

      <style>{`
        @keyframes hud-ping {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.06); opacity: 0.1; }
        }
      `}</style>
    </div>
  )
}

export default function Chat({ user }) {
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [messages, setMessages]               = useState([])
  const [input, setInput]                     = useState('')
  const [loading, setLoading]                 = useState(false)
  const [activeSession, setActiveSession]     = useState(sessionId || generateId())
  const [robotSpeech, setRobotSpeech]         = useState('')
  const [robotEmotion, setRobotEmotion]       = useState('Normal')
  const [isListening, setIsListening]         = useState(false)
  const [voiceMode, setVoiceMode]             = useState(true)
  const [showChatOverlay, setShowChatOverlay] = useState(false)
  const [lastEmotions, setLastEmotions]       = useState([])
  const [lastResponse, setLastResponse]       = useState('')
  const [selectedAvatar, setSelectedAvatar]   = useState(() => localStorage.getItem('mindslm_avatar') || 'atlas')

  const messagesRef    = useRef(null)
  const overlayRef     = useRef(null)
  const voiceInputRef  = useRef(null)
  const chatInputRef   = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SR) {
      const r = new SR()
      r.continuous = false; r.interimResults = false; r.lang = 'en-US'
      r.onresult = (e) => send(e.results[0][0].transcript)
      r.onend  = () => setIsListening(false)
      r.onerror = () => setIsListening(false)
      recognitionRef.current = r
    }
  }, [])

  const toggleListen = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false) }
    else             { recognitionRef.current?.start(); setIsListening(true) }
  }

  // Load existing conversation when navigating from Insights
  useEffect(() => {
    if (!sessionId) return
    fetch(`${API}/api/sessions/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.messages?.length) return
        const loaded = data.messages.map(m => ({
          role: m.role,
          content: m.content,
          emotions: m.emotions ? Object.entries(m.emotions).map(([label, score]) => ({ label, score })) : [],
          classification: m.classification,
        }))
        setMessages(loaded)
        // Restore last assistant state for the HUD and subtitle
        const lastAssistant = [...loaded].reverse().find(m => m.role === 'assistant')
        if (lastAssistant) {
          setLastResponse(lastAssistant.content)
          setLastEmotions(lastAssistant.emotions || [])
          setRobotEmotion(lastAssistant.classification || 'Normal')
        }
        // Auto-open chat overlay so user sees the conversation
        setShowChatOverlay(true)
      })
      .catch(() => {})
  }, [sessionId])

  useEffect(() => {
    const mood = searchParams.get('mood')
    if (mood && messages.length === 0) setTimeout(() => send(mood), 300)
  }, [])

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    if (overlayRef.current)  overlayRef.current.scrollTop  = overlayRef.current.scrollHeight
  }, [messages, loading])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    setLoading(true)
    try {
      const res  = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, session_id: activeSession }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant', content: data.response,
        emotions: data.emotions, classification: data.classification,
      }])
      // Strip helpline numbers from TTS — show in chat but don't speak them
      const spokenText = data.response.split(/\n\nCall iCall|^\n\nOne Stop/m)[0].trim()
      setRobotSpeech(spokenText)
      setRobotEmotion(data.classification || 'Normal')
      setLastEmotions(data.emotions || [])
      setLastResponse(data.response || '')
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Couldn't reach the API. Is the backend running?" }])
    }
    setLoading(false)
  }

  function pickAvatar(id) {
    setSelectedAvatar(id)
    localStorage.setItem('mindslm_avatar', id)
  }

  function newSession() {
    const id = generateId()
    setActiveSession(id); setMessages([]); setLastEmotions([]); setLastResponse('')
    navigate(`/chat/${id}`)
  }

  async function clearSession() {
    if (!window.confirm('Delete this conversation?')) return
    try { await fetch(`${API}/api/sessions/${activeSession}`, { method: 'DELETE' }) } catch {}
    const id = generateId()
    setActiveSession(id); setMessages([]); setLastEmotions([]); setLastResponse('')
    navigate(`/chat/${id}`)
  }

  const cls = CLS_COLORS[robotEmotion] || CLS_COLORS.Normal

  const bubbleStyle = (role) => role === 'user'
    ? { background: 'rgba(255,255,255,0.08)', color: '#f5f5f7', borderBottomRightRadius: 4, border: '1px solid rgba(255,255,255,0.10)' }
    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#e5e5e7', borderBottomLeftRadius: 4 }

  // ─── VOICE MODE — 21st.dev split layout ────────────────────────────────────
  if (voiceMode) {
    return (
      <Layout user={user}>
        <div style={{
          position: 'relative', width: '100%', height: '100vh',
          background: 'rgba(0,0,0,0.96)', overflow: 'hidden',
          display: 'flex',
        }}>

          {/* Spotlight */}
          <Spotlight style={{ top: '-40%', left: '0%' }} />

          {/* ── LEFT: Content panel ── */}
          <div style={{
            flex: 1, position: 'relative', zIndex: 10,
            display: 'flex', flexDirection: 'column',
            padding: '80px 48px 100px',
            maxWidth: 520,
            overflow: 'hidden',
          }}>
            {/* Scrollable content area — grows to push buttons down but never hides them */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>

              {/* Greeting / status */}
              <h1 style={{
                fontSize: 48, fontWeight: 700, lineHeight: 1.15,
                letterSpacing: '-0.03em',
                background: 'linear-gradient(to bottom, #fafafa, #a3a3a3)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                margin: 0, flexShrink: 0,
              }}>
                {messages.length === 0 ? 'How are you feeling?' : 'MindSLM'}
              </h1>

              <p style={{
                marginTop: 16, fontSize: 15, lineHeight: 1.7,
                color: '#d4d4d4', maxWidth: 420,
                // Clamp long responses to 6 lines max — prevents overflow
                display: '-webkit-box',
                WebkitLineClamp: 6,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {messages.length === 0
                  ? 'Your AI mental health companion. Speak or type — I\'m here to listen.'
                  : lastResponse || 'Listening...'}
              </p>

              {/* Emotion HUD */}
              {lastEmotions.length > 0 && (
                <div style={{ marginTop: 24, flexShrink: 0 }}>
                  <EmotionHUD emotions={lastEmotions} classification={robotEmotion} />
                </div>
              )}

            </div>


            {/* Controls — always pinned to bottom of the left panel */}
            <div style={{ flexShrink: 0, paddingTop: 20 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowChatOverlay(v => !v)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
                  background: showChatOverlay ? 'rgba(48,209,88,0.12)' : 'rgba(255,255,255,0.04)',
                  border: showChatOverlay ? '1px solid rgba(48,209,88,0.25)' : '1px solid rgba(255,255,255,0.10)',
                  color: showChatOverlay ? '#30d158' : '#a3a3a3', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}>
                  {showChatOverlay ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
                  {showChatOverlay ? 'Hide chat' : 'Show chat'}
                </button>
                <button onClick={newSession} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                  color: '#a3a3a3', fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}>
                  <Plus size={12} /> New
                </button>
              </div>

              {/* Avatar picker */}
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 10, color: '#4a4a4e', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase', fontFamily: 'monospace' }}>Companion</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {AVATARS.map(av => (
                    <button key={av.id} onClick={() => pickAvatar(av.id)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '8px 12px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s',
                      background: selectedAvatar === av.id ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                      border: selectedAvatar === av.id ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: selectedAvatar === av.id ? '#f5f5f7' : '#636366' }}>{av.label}</span>
                      <span style={{ fontSize: 10, color: selectedAvatar === av.id ? '#8e8e93' : '#3a3a3c', marginTop: 2 }}>{av.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Avatar panel ── */}
          <div style={{
            flex: 1, position: 'relative',
            animation: 'robotZoomIn 1s cubic-bezier(0.16,1,0.3,1) forwards',
          }}>
            {selectedAvatar === 'nova'
              ? <SplineScene scene={SPLINE_SCENE} />
              : (
                <>
                  <Spotlight style={{ top: '-20%', left: '10%' }} />
                  <RobotAvatar textToSpeak={robotSpeech} emotion={robotEmotion} />
                </>
              )
            }
          </div>

          {/* Hidden TTS engine for Nova (Spline can't speak) */}
          {selectedAvatar === 'nova' && (
            <div style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}>
              <RobotAvatar textToSpeak={robotSpeech} emotion={robotEmotion} ttsOnly />
            </div>
          )}

          {/* Chat overlay — slides in from right edge */}
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0,
            width: showChatOverlay ? 340 : 0, overflow: 'hidden',
            transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)', zIndex: 40,
          }}>
            <div style={{
              width: 340, height: '100%',
              background: 'rgba(10,10,10,0.8)', backdropFilter: 'blur(24px)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', flexDirection: 'column', paddingTop: 16,
            }}>
              <div ref={overlayRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: 260, display: 'flex', flexDirection: 'column', gap: 5, alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div style={{ padding: '9px 13px', borderRadius: 14, fontSize: 13, lineHeight: 1.55, ...bubbleStyle(m.role) }}>{m.content}</div>
                      {(m.emotions?.length > 0 || m.classification) && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {m.emotions?.slice(0, 2).map((e, j) => (
                            <span key={j} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.18)', color: '#30d158', fontWeight: 500 }}>{e.label}</span>
                          ))}
                          {m.classification && (() => { const c = CLS_COLORS[m.classification] || CLS_COLORS.Normal; return <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontWeight: 500 }}>{m.classification}</span> })()}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div style={{ display: 'flex' }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, borderBottomLeftRadius: 4, padding: '11px 14px', display: 'flex', gap: 5, alignItems: 'center' }}>
                      {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#636366', display: 'block', animation: 'bounce 0.9s ease-in-out infinite', animationDelay: `${i*0.18}s` }} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Floating input — bottom full width */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 24px 20px', background: 'linear-gradient(to top, rgba(0,0,0,0.95) 60%, transparent 100%)', zIndex: 60 }}>
            <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, padding: '10px 10px 10px 16px', backdropFilter: 'blur(20px)' }}>
              <input
                ref={voiceInputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Type or speak to MindSLM…"
                style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 14, color: '#f5f5f7', outline: 'none' }}
              />
              <button onClick={toggleListen} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: isListening ? 'rgba(255,69,58,0.22)' : 'rgba(255,255,255,0.07)', color: isListening ? '#ff453a' : '#8e8e93', transition: 'all 0.15s' }}>
                {isListening ? <Mic size={14} /> : <MicOff size={14} />}
              </button>
              <button onClick={() => send()} disabled={!input.trim()} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', background: input.trim() ? '#30d158' : 'rgba(255,255,255,0.06)', transition: 'all 0.15s' }}>
                <Send size={13} color={input.trim() ? '#000' : '#3a3a3c'} strokeWidth={2.2} />
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(99,99,102,0.7)', marginTop: 8 }}>
              Not for emergencies · If in crisis, call <span style={{ color: '#636366' }}>iCall 9152987821</span> or <span style={{ color: '#636366' }}>Vandrevala 1860-2662-345</span>
            </p>
          </div>

          {/* Zoom-in animation */}
          <style>{`
            @keyframes robotZoomIn {
              0%   { opacity: 0; transform: scale(0.6) translateY(40px); }
              100% { opacity: 1; transform: scale(1) translateY(0); }
            }
          `}</style>

        </div>
      </Layout>
    )
  }

  // ─── CHAT MODE ─────────────────────────────────────────────────────────────
  return (
    <Layout user={user}>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#000' }}>

        <div style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden' }}>
          <Spotlight style={{ top: '-20%', left: '10%' }} />
          {selectedAvatar === 'nova' ? (
            <SplineScene scene={SPLINE_SCENE} />
          ) : (
            <RobotAvatar textToSpeak={robotSpeech} emotion={robotEmotion} />
          )}
        </div>

        {/* Hidden TTS engine for Nova in Chat Mode */}
        {selectedAvatar === 'nova' && !voiceMode && (
          <div style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            <RobotAvatar textToSpeak={robotSpeech} emotion={robotEmotion} ttsOnly />
          </div>
        )}

        <div style={{ width: 500, flexShrink: 0, background: '#0A0A0A', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 10 }}>

          {/* Header */}
          <div style={{ height: 52, borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636366', display: 'flex', padding: 4, borderRadius: 6 }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f7', letterSpacing: '-0.01em' }}>Check-in</div>
              <div style={{ fontSize: 11, color: '#3a3a3c' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            </div>
            <button onClick={() => setVoiceMode(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#aeaeb2', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              <Radio size={12} /> Voice
            </button>
            <button onClick={newSession} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#aeaeb2', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={12} strokeWidth={2.5} /> New
            </button>
            <button onClick={clearSession} style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#ff453a', cursor: 'pointer' }}>
              <Trash2 size={14} />
            </button>
          </div>

          {/* Messages */}
          <div ref={messagesRef} style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>💬</div>
                  <p style={{ color: '#636366', fontSize: 14, marginBottom: 20 }}>What's on your mind?</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => send(s)} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', color: '#8e8e93', cursor: 'pointer' }}>
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
                  <div style={{ padding: '11px 16px', borderRadius: 16, fontSize: 14, lineHeight: 1.6, ...bubbleStyle(m.role) }}>{m.content}</div>
                  {(m.emotions?.length > 0 || m.classification) && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '0 2px' }}>
                      {m.emotions?.slice(0, 3).map((e, j) => (
                        <span key={j} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.18)', color: '#30d158', fontWeight: 500 }}>{e.label}</span>
                      ))}
                      {m.classification && (() => { const c = CLS_COLORS[m.classification] || CLS_COLORS.Normal; return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: c.bg, border: `1px solid ${c.border}`, color: c.color, fontWeight: 500 }}>{m.classification}</span> })()}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex' }}>
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, borderBottomLeftRadius: 4, padding: '13px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#636366', display: 'block', animation: 'bounce 0.9s ease-in-out infinite', animationDelay: `${i*0.18}s` }} />)}
                </div>
              </div>
            )}
          </div>

          {/* Input — inlined */}
          <div style={{ padding: '12px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '10px 10px 10px 16px' }}>
              <input
                ref={chatInputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="What's on your mind…"
                style={{ flex: 1, background: 'transparent', border: 'none', fontSize: 14, color: '#f5f5f7', outline: 'none' }}
              />
              <button onClick={toggleListen} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: isListening ? 'rgba(255,69,58,0.2)' : 'rgba(255,255,255,0.06)', color: isListening ? '#ff453a' : '#8e8e93', transition: 'all 0.15s' }}>
                {isListening ? <Mic size={14} /> : <MicOff size={14} />}
              </button>
              <button onClick={() => send()} disabled={!input.trim()} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: input.trim() ? 'pointer' : 'default', background: input.trim() ? '#30d158' : 'rgba(255,255,255,0.06)', transition: 'all 0.15s' }}>
                <Send size={13} color={input.trim() ? '#000' : '#3a3a3c'} strokeWidth={2.2} />
              </button>
            </div>
            <p style={{ textAlign: 'center', fontSize: 11, color: '#3a3a3c', marginTop: 8 }}>
              Not for emergencies · If in crisis, call <span style={{ color: '#636366' }}>iCall 9152987821</span> or <span style={{ color: '#636366' }}>Vandrevala 1860-2662-345</span>
            </p>
          </div>

        </div>
      </div>
    </Layout>
  )
}

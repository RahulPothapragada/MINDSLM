import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import Layout from '../components/Layout'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const SEV = {
  minimal:  { bg: 'rgba(48,209,88,0.12)',  color: '#30d158',  label: 'Minimal'  },
  mild:     { bg: 'rgba(255,214,10,0.12)',  color: '#ffd60a',  label: 'Mild'     },
  moderate: { bg: 'rgba(255,159,10,0.12)',  color: '#ff9f0a',  label: 'Moderate' },
  severe:   { bg: 'rgba(255,69,58,0.12)',   color: '#ff453a',  label: 'Severe'   },
}

const CLS_COLORS = {
  Anxiety:    '#ffd60a',
  Depression: '#ff453a',
  Suicidal:   '#ff6961',
  Abuse:      '#ff6423',
  Normal:     '#30d158',
}

function SessionDrawer({ session, onClose }) {
  const [messages, setMessages] = useState([])
  const [loadingMsgs, setLoadingMsgs] = useState(true)
  const sev = SEV[session.severity]

  useEffect(() => {
    setLoadingMsgs(true)
    fetch(`${API}/api/sessions/${session.id}`)
      .then(r => r.json())
      .then(data => {
        setMessages(data.messages || [])
        setLoadingMsgs(false)
      })
      .catch(() => setLoadingMsgs(false))
  }, [session.id])

  // Build a plain-text summary: topics mentioned by user
  const userMessages = messages.filter(m => m.role === 'user')
  const assistantMessages = messages.filter(m => m.role === 'assistant')

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)', zIndex: 40,
          animation: 'fadeIn 0.2s ease forwards',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 440, zIndex: 50,
        background: '#0a0a0a',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) forwards',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: 11, color: '#636366', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Check-in</p>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f5f5f7', letterSpacing: '-0.02em', margin: 0 }}>
                {new Date(session.created_at).toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#636366', cursor: 'pointer', padding: 4, borderRadius: 6, marginTop: 2 }}>
              <X size={18} />
            </button>
          </div>

          {/* Session stats row */}
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {sev && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: sev.bg, color: sev.color, fontWeight: 600 }}>
                {sev.label}
              </span>
            )}
            {session.phq9_score != null && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: '#aeaeb2', fontWeight: 500 }}>
                PHQ-9: {session.phq9_score}
              </span>
            )}
            {session.gad7_score != null && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: '#aeaeb2', fontWeight: 500 }}>
                GAD-7: {session.gad7_score}
              </span>
            )}
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', color: '#636366' }}>
              {userMessages.length} message{userMessages.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Emotion tags */}
          {session.top_emotions?.length > 0 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 10 }}>
              {session.top_emotions.map((e, i) => (
                <span key={i} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.15)', color: '#30d158', fontWeight: 500 }}>
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loadingMsgs ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#30d158', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#3a3a3c', fontSize: 13, marginTop: 40 }}>No messages found for this session.</div>
          ) : (
            messages.map((m, i) => {
              const isUser = m.role === 'user'
              const clsColor = CLS_COLORS[m.classification] || null
              // Parse emotions from object format {label: score} or array [{label, score}]
              const emotionList = Array.isArray(m.emotions)
                ? m.emotions
                : m.emotions
                  ? Object.entries(m.emotions).map(([label, score]) => ({ label, score })).sort((a, b) => b.score - a.score)
                  : []

              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
                  <div style={{
                    maxWidth: 320, padding: '10px 14px', borderRadius: 14, fontSize: 13, lineHeight: 1.6,
                    borderBottomRightRadius: isUser ? 4 : 14,
                    borderBottomLeftRadius: isUser ? 14 : 4,
                    background: isUser ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                    border: isUser ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(255,255,255,0.07)',
                    color: '#e5e5e7',
                  }}>
                    {m.content}
                  </div>

                  {/* Emotion + classification tags on assistant messages */}
                  {!isUser && (emotionList.length > 0 || m.classification) && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', paddingLeft: 2 }}>
                      {emotionList.slice(0, 2).map((e, j) => (
                        <span key={j} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.15)', color: '#30d158', fontWeight: 500 }}>
                          {e.label}
                        </span>
                      ))}
                      {m.classification && clsColor && (
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 99, background: `${clsColor}15`, border: `1px solid ${clsColor}30`, color: clsColor, fontWeight: 500 }}>
                          {m.classification}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </>
  )
}

export default function Insights({ user }) {
  const [timeline, setTimeline]         = useState([])
  const [selectedSession, setSelected]  = useState(null)

  useEffect(() => {
    fetch(`${API}/api/timeline`)
      .then(r => r.json())
      .then(d => setTimeline(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const phq9Data = timeline.filter(s => s.phq9_score != null)

  return (
    <Layout user={user}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '44px 32px', animation: 'fadeUp 0.3s ease forwards' }}>

        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: '#f5f5f7', marginBottom: 4 }}>Insights</h1>
          <p style={{ fontSize: 14, color: '#636366' }}>Your mental health trends over time</p>
        </div>

        {timeline.length === 0 ? (
          <div style={{ border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 16, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>📊</div>
            <p style={{ color: '#636366', fontSize: 14, marginBottom: 6 }}>No data yet</p>
            <p style={{ color: '#3a3a3c', fontSize: 13 }}>Complete a PHQ-9 or GAD-7 screening in chat to see your mood timeline.</p>
          </div>
        ) : (
          <>
            {/* PHQ-9 Chart */}
            {phq9Data.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '24px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#aeaeb2', letterSpacing: '-0.01em' }}>PHQ-9 Trend</p>
                    <p style={{ fontSize: 11, color: '#3a3a3c', marginTop: 2 }}>Last {Math.min(phq9Data.length, 8)} sessions</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 28, fontWeight: 700, color: '#f5f5f7', letterSpacing: '-0.04em' }}>{phq9Data[phq9Data.length - 1].phq9_score}</span>
                    <span style={{ fontSize: 11, color: '#636366', display: 'block', marginTop: 1 }}>latest score</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                  {phq9Data.slice(-8).map((s, i, arr) => {
                    const isLatest = i === arr.length - 1
                    const height = Math.max(4, (s.phq9_score / 27) * 76)
                    const sev = SEV[s.severity]
                    return (
                      <div key={s.id || i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div title={`${s.phq9_score} — ${new Date(s.created_at).toLocaleDateString()}`} style={{ height: `${height}px`, width: '100%', background: isLatest ? (sev?.color || '#30d158') : 'rgba(255,255,255,0.08)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s ease', minHeight: 4 }} />
                        <span style={{ fontSize: 9, color: '#3a3a3c' }}>{new Date(s.created_at).toLocaleDateString('en-IN', { month: 'numeric', day: 'numeric' })}</span>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Minimal\n0–4', 'Mild\n5–9', 'Moderate\n10–14', 'Severe\n20+'].map((label, i) => (
                    <span key={i} style={{ fontSize: 10, color: '#3a3a3c', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.4 }}>{label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Session list */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#636366', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>
                All check-ins — click to view conversation
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {timeline.map((s, i) => {
                  const sev = SEV[s.severity]
                  return (
                    <div
                      key={s.id || i}
                      onClick={() => setSelected(s)}
                      style={{
                        padding: '16px 18px', borderRadius: 12,
                        border: `1px solid ${selectedSession?.id === s.id ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)'}`,
                        background: selectedSession?.id === s.id ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={e => { if (selectedSession?.id !== s.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' } }}
                      onMouseLeave={e => { if (selectedSession?.id !== s.id) { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' } }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {sev && <div style={{ width: 3, height: 32, borderRadius: 99, background: sev.color, flexShrink: 0 }} />}
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#e5e5e7', marginBottom: 3 }}>
                            {new Date(s.created_at).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div style={{ fontSize: 11, color: '#3a3a3c' }}>
                            {new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {s.message_count || 0} messages
                          </div>
                          {s.top_emotions?.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                              {s.top_emotions.map((e, j) => (
                                <span key={j} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.18)', color: '#30d158', fontWeight: 500 }}>{e}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {(s.phq9_score != null || s.gad7_score != null) && (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 26, fontWeight: 700, color: '#f5f5f7', letterSpacing: '-0.04em', lineHeight: 1 }}>{s.phq9_score ?? s.gad7_score}</div>
                          <div style={{ fontSize: 10, color: '#636366', marginTop: 2 }}>{s.phq9_score != null ? 'PHQ-9' : 'GAD-7'}</div>
                          {sev && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: sev.bg, color: sev.color, fontWeight: 500, marginTop: 4, display: 'inline-block' }}>{sev.label}</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Session drawer */}
      {selectedSession && (
        <SessionDrawer session={selectedSession} onClose={() => setSelected(null)} />
      )}
    </Layout>
  )
}

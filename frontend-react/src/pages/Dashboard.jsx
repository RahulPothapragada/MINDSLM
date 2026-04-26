import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Wind, BarChart2, ArrowRight } from 'lucide-react'
import Layout from '../components/Layout'

const MOODS = [
  { emoji: '😔', label: 'Rough',  value: 1, color: '#ff453a' },
  { emoji: '😟', label: 'Low',    value: 2, color: '#ff9f0a' },
  { emoji: '😐', label: 'Okay',   value: 3, color: '#ffd60a' },
  { emoji: '🙂', label: 'Good',   value: 4, color: '#30d158' },
  { emoji: '😊', label: 'Great',  value: 5, color: '#30d158' },
]

const SEV_COLORS = {
  minimal:  { bg: 'rgba(48,209,88,0.12)',   color: '#30d158' },
  mild:     { bg: 'rgba(255,214,10,0.12)',   color: '#ffd60a' },
  moderate: { bg: 'rgba(255,159,10,0.12)',   color: '#ff9f0a' },
  severe:   { bg: 'rgba(255,69,58,0.12)',    color: '#ff453a' },
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const MOOD_MESSAGES = {
  1: "I'm really struggling today",
  2: "I'm feeling pretty low",
  3: "I'm feeling okay, just getting by",
  4: "I'm doing fairly well today",
  5: "I'm feeling really good today",
}

const QUICK_ACTIONS = [
  { label: 'New chat',   desc: 'Start a session',         Icon: MessageCircle, page: '/chat',      color: '#30d158' },
  { label: 'Exercises',  desc: 'Breathing & grounding',   Icon: Wind,          page: '/exercises', color: '#0a84ff' },
  { label: 'Insights',   desc: 'Your mood trends',        Icon: BarChart2,     page: '/insights',  color: '#bf5af2' },
]

export default function Dashboard({ user }) {
  const navigate = useNavigate()
  const [sessions, setSessions]       = useState([])
  const [selectedMood, setSelectedMood] = useState(null)
  const [moodSent, setMoodSent]       = useState(false)
  const [hoveredMood, setHoveredMood] = useState(null)
  const [hoveredAction, setHoveredAction] = useState(null)

  const name = user?.user_metadata?.full_name?.split(' ')[0] || 'there'
  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    fetch(`${API}/api/sessions`)
      .then(r => r.json())
      .then(d => setSessions(Array.isArray(d) ? d.slice(0, 5) : []))
      .catch(() => {})
  }, [])

  function handleMoodSelect(mood) {
    setSelectedMood(mood)
    setMoodSent(true)
    setTimeout(() => navigate(`/chat?mood=${encodeURIComponent(MOOD_MESSAGES[mood])}`), 500)
  }

  return (
    <Layout user={user}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '44px 32px', animation: 'fadeUp 0.3s ease forwards' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: '#f5f5f7', marginBottom: 4 }}>
            {greeting}, {name}
          </h1>
          <p style={{ fontSize: 14, color: '#636366' }}>How are you feeling today?</p>
        </div>

        {/* Mood check-in */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '24px 28px',
          marginBottom: 16,
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#636366', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 20 }}>Daily check-in</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            {MOODS.map(m => (
              <button
                key={m.value}
                onClick={() => !moodSent && handleMoodSelect(m.value)}
                onMouseEnter={() => setHoveredMood(m.value)}
                onMouseLeave={() => setHoveredMood(null)}
                style={{
                  flex: 1,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  padding: '14px 8px',
                  borderRadius: 12,
                  border: selectedMood === m.value
                    ? `1px solid ${m.color}40`
                    : '1px solid transparent',
                  background: selectedMood === m.value
                    ? `${m.color}12`
                    : hoveredMood === m.value ? 'rgba(255,255,255,0.04)' : 'transparent',
                  cursor: moodSent ? 'default' : 'pointer',
                  transform: selectedMood === m.value ? 'scale(1.06)' : hoveredMood === m.value ? 'scale(1.03)' : 'scale(1)',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 30, lineHeight: 1 }}>{m.emoji}</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: selectedMood === m.value ? m.color : '#636366', transition: 'color 0.15s' }}>{m.label}</span>
              </button>
            ))}
          </div>
          {moodSent && (
            <p style={{ fontSize: 12, color: '#30d158', marginTop: 16, textAlign: 'center', animation: 'fadeIn 0.2s ease forwards' }}>
              Starting your session…
            </p>
          )}
        </div>

        {/* Quick actions */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 36 }}>
          {QUICK_ACTIONS.map((c, i) => (
            <button
              key={i}
              onClick={() => navigate(c.page)}
              onMouseEnter={() => setHoveredAction(i)}
              onMouseLeave={() => setHoveredAction(null)}
              style={{
                padding: '20px 18px',
                borderRadius: 14,
                border: `1px solid ${hoveredAction === i ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
                background: hoveredAction === i ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                textAlign: 'left', cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 9,
                background: `${c.color}18`,
                border: `1px solid ${c.color}28`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                <c.Icon size={16} color={c.color} strokeWidth={1.8} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#f5f5f7', letterSpacing: '-0.01em', marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 12, color: '#636366' }}>{c.desc}</div>
            </button>
          ))}
        </div>

        {/* Recent sessions */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#aeaeb2', letterSpacing: '-0.01em' }}>Recent sessions</span>
            <button
              onClick={() => navigate('/insights')}
              style={{ fontSize: 12, color: '#636366', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#aeaeb2'}
              onMouseLeave={e => e.currentTarget.style.color = '#636366'}
            >
              View all <ArrowRight size={12} />
            </button>
          </div>

          {sessions.length === 0 ? (
            <div style={{ border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 14, padding: '40px 24px', textAlign: 'center' }}>
              <p style={{ color: '#3a3a3c', fontSize: 14, marginBottom: 14 }}>No sessions yet</p>
              <button
                onClick={() => navigate('/chat')}
                style={{ fontSize: 13, color: '#30d158', background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.18)', borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
              >
                Start your first check-in
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sessions.map((s, i) => {
                const sev = SEV_COLORS[s.severity] || {}
                return (
                  <button
                    key={s.id || i}
                    onClick={() => navigate(`/chat/${s.id}`)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '13px 16px',
                      borderRadius: 10,
                      border: '1px solid rgba(255,255,255,0.07)',
                      background: i === 0 ? 'rgba(255,255,255,0.03)' : 'transparent',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = i === 0 ? 'rgba(255,255,255,0.03)' : 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {s.severity && (
                        <div style={{ width: 3, height: 28, borderRadius: 99, background: sev.color || '#3a3a3c', flexShrink: 0 }} />
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#e5e5e7' }}>{s.name || 'Check-in'}</div>
                        <div style={{ fontSize: 11, color: '#3a3a3c', marginTop: 2 }}>{s.message_count || 0} messages</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {s.severity && (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: sev.bg, color: sev.color, fontWeight: 500 }}>{s.severity}</span>
                      )}
                      <span style={{ fontSize: 11, color: '#3a3a3c' }}>
                        {s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

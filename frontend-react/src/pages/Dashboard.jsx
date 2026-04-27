import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, Wind, BarChart2, ArrowRight, Activity, Calendar, Clock, Star } from 'lucide-react'
import Layout from '../components/Layout'

const SEV_COLORS = {
  minimal:  { bg: 'rgba(255,255,255,0.06)',  color: '#ffffff' },
  mild:     { bg: 'rgba(255,255,255,0.06)',  color: '#ffffff' },
  moderate: { bg: 'rgba(255,255,255,0.06)',  color: '#ffffff' },
  severe:   { bg: 'rgba(255,255,255,0.06)',  color: '#ffffff' },
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const QUICK_ACTIONS = [
  { label: 'Start Session',  desc: 'Begin clinical evaluation', Icon: MessageCircle, page: '/chat',      color: '#30d158' },
  { label: 'Clinical Tools', desc: 'Grounding & assessment',    Icon: Wind,          page: '/exercises', color: '#0a84ff' },
  { label: 'Analytics',      desc: 'Patient trajectory data',   Icon: BarChart2,     page: '/insights',  color: '#bf5af2' },
]

export default function Dashboard({ user }) {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [hoveredAction, setHoveredAction] = useState(null)

  const name = user?.user_metadata?.full_name?.split(' ')[0] || 'Clinician'
  const h = new Date().getHours()
  const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'

  useEffect(() => {
    fetch(`${API}/api/sessions`)
      .then(r => r.json())
      .then(d => setSessions(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const recentSessions = sessions.slice(0, 5)

  // Calculate real-time metrics
  const totalSessions = sessions.length;
  let avgDuration = '0m';
  let assessmentsCount = 0;
  let recentSeverity = 'Stable';

  if (totalSessions > 0) {
    let totalMinutes = 0;
    sessions.forEach(s => {
      if (s.created_at && s.updated_at) {
        const diffMs = new Date(s.updated_at) - new Date(s.created_at);
        if (diffMs > 0) totalMinutes += (diffMs / 1000 / 60);
      }
      if (s.phq9_score != null || s.gad7_score != null) {
        assessmentsCount++;
      }
    });
    
    avgDuration = `${Math.max(1, Math.round(totalMinutes / totalSessions))}m`;

    const lastWithSeverity = sessions.find(s => s.severity);
    if (lastWithSeverity) {
      recentSeverity = lastWithSeverity.severity.charAt(0).toUpperCase() + lastWithSeverity.severity.slice(1);
    } else {
      recentSeverity = 'Monitoring';
    }
  } else {
    recentSeverity = 'No Data';
  }

  return (
    <Layout user={user}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '44px 32px', animation: 'fadeUp 0.3s ease forwards', position: 'relative', zIndex: 10 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <div>
            <p style={{ fontSize: 13, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginBottom: 8 }}>Overview</p>
            <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.04em', color: '#ffffff' }}>
              {greeting}, {name}.
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 14, color: '#aeaeb2' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Interactive Metrics Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 40 }}>
          {[
            { label: 'Total Sessions', value: totalSessions, icon: Activity },
            { label: 'Avg Duration', value: avgDuration, icon: Clock },
            { label: 'Assessments', value: assessmentsCount, icon: Calendar },
            { label: 'Overall Status', value: recentSeverity, icon: Star },
          ].map((stat, i) => (
            <button 
              key={i} 
              onClick={() => navigate('/insights')} 
              style={{
                background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
                padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12,
                cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', width: '100%'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: 13, color: '#8e8e93', fontWeight: 500 }}>{stat.label}</span>
                <stat.icon size={16} color="#ffffff" />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em', marginTop: 'auto' }}>{stat.value}</div>
              <div style={{ fontSize: 11, color: '#aeaeb2', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                View analytics <ArrowRight size={10} strokeWidth={2.5} />
              </div>
            </button>
          ))}
        </div>

        {/* Two-Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          
          {/* Left Column: Recent Sessions */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', letterSpacing: '-0.01em' }}>Recent Evaluations</h2>
              <button
                onClick={() => navigate('/insights')}
                style={{ fontSize: 13, color: '#8e8e93', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={e => e.currentTarget.style.color = '#8e8e93'}
              >
                View all <ArrowRight size={14} />
              </button>
            </div>

            {recentSessions.length === 0 ? (
              <div style={{ border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 12, padding: '40px 24px', textAlign: 'center' }}>
                <p style={{ color: '#8e8e93', fontSize: 14, marginBottom: 16 }}>No clinical data recorded.</p>
                <button
                  onClick={() => navigate('/chat')}
                  style={{ fontSize: 13, color: '#000', background: '#ffffff', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Initiate Evaluation
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentSessions.map((s, i) => {
                  const sev = SEV_COLORS[s.severity] || { bg: 'rgba(255,255,255,0.1)', color: '#8e8e93' }
                  return (
                    <button
                      key={s.id || i}
                      onClick={() => navigate(`/chat/${s.id}`)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '16px 20px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)',
                        background: 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 4, height: 32, borderRadius: 4, background: sev.color, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>{s.name || 'Clinical Check-in'}</div>
                          <div style={{ fontSize: 12, color: '#8e8e93', marginTop: 4 }}>{s.message_count || 0} interaction(s)</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {s.severity && (
                          <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: sev.bg, color: sev.color, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                            {s.severity}
                          </span>
                        )}
                        <span style={{ fontSize: 13, color: '#8e8e93', fontWeight: 500 }}>
                          {s.created_at ? new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column: Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', letterSpacing: '-0.01em', marginBottom: 12, paddingLeft: 4 }}>System Actions</h2>
            {QUICK_ACTIONS.map((c, i) => (
              <button
                key={i}
                onClick={() => navigate(c.page)}
                onMouseEnter={() => setHoveredAction(i)}
                onMouseLeave={() => setHoveredAction(null)}
                style={{
                  padding: '20px 24px', borderRadius: 16, border: `1px solid ${hoveredAction === i ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
                  background: hoveredAction === i ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                  backdropFilter: 'blur(12px)', textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 16
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <c.Icon size={20} color="#ffffff" strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#ffffff', letterSpacing: '-0.01em', marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 13, color: '#8e8e93' }}>{c.desc}</div>
                </div>
              </button>
            ))}
          </div>

        </div>
      </div>
    </Layout>
  )
}

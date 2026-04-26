import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const SEV = {
  minimal:  { bg: 'rgba(48,209,88,0.12)',  color: '#30d158',  label: 'Minimal'  },
  mild:     { bg: 'rgba(255,214,10,0.12)',  color: '#ffd60a',  label: 'Mild'     },
  moderate: { bg: 'rgba(255,159,10,0.12)',  color: '#ff9f0a',  label: 'Moderate' },
  severe:   { bg: 'rgba(255,69,58,0.12)',   color: '#ff453a',  label: 'Severe'   },
}

export default function Insights({ user }) {
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    fetch(`${API}/api/timeline`)
      .then(r => r.json())
      .then(d => setTimeline(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const phq9Data = timeline.filter(s => s.phq9_score != null)
  const maxScore = Math.max(...phq9Data.map(s => s.phq9_score), 1)

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
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 16, padding: '24px', marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#aeaeb2', letterSpacing: '-0.01em' }}>PHQ-9 Trend</p>
                    <p style={{ fontSize: 11, color: '#3a3a3c', marginTop: 2 }}>Last {Math.min(phq9Data.length, 8)} sessions</p>
                  </div>
                  {phq9Data.length > 0 && (
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: '#f5f5f7', letterSpacing: '-0.04em' }}>{phq9Data[phq9Data.length - 1].phq9_score}</span>
                      <span style={{ fontSize: 11, color: '#636366', display: 'block', marginTop: 1 }}>latest score</span>
                    </div>
                  )}
                </div>

                {/* Bar chart */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
                  {phq9Data.slice(-8).map((s, i, arr) => {
                    const isLatest = i === arr.length - 1
                    const height = Math.max(4, (s.phq9_score / 27) * 76)
                    const sev = SEV[s.severity]
                    return (
                      <div key={s.id || i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div
                          title={`${s.phq9_score} — ${new Date(s.created_at).toLocaleDateString()}`}
                          style={{
                            height: `${height}px`, width: '100%',
                            background: isLatest
                              ? (sev?.color || '#30d158')
                              : 'rgba(255,255,255,0.08)',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease',
                            minHeight: 4,
                          }}
                        />
                        <span style={{ fontSize: 9, color: '#3a3a3c' }}>
                          {new Date(s.created_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Scale labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  {['Minimal\n0–4', 'Mild\n5–9', 'Moderate\n10–14', 'Severe\n20+'].map((label, i) => (
                    <span key={i} style={{ fontSize: 10, color: '#3a3a3c', textAlign: 'center', whiteSpace: 'pre-line', lineHeight: 1.4 }}>{label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Session list */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#636366', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>All sessions</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {timeline.map((s, i) => {
                  const sev = SEV[s.severity]
                  return (
                    <div
                      key={s.id || i}
                      style={{
                        padding: '16px 18px',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.07)',
                        background: 'rgba(255,255,255,0.02)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        {sev && <div style={{ width: 3, height: 32, borderRadius: 99, background: sev.color, flexShrink: 0 }} />}
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 500, color: '#e5e5e7', marginBottom: 3 }}>{s.name || 'Session'}</div>
                          <div style={{ fontSize: 11, color: '#3a3a3c' }}>
                            {new Date(s.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                          </div>
                          {s.top_emotions?.length > 0 && (
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                              {s.top_emotions.map((e, j) => (
                                <span key={j} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.18)', color: '#30d158', fontWeight: 500 }}>{e}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {(s.phq9_score != null || s.gad7_score != null) && (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 26, fontWeight: 700, color: '#f5f5f7', letterSpacing: '-0.04em', lineHeight: 1 }}>
                            {s.phq9_score ?? s.gad7_score}
                          </div>
                          <div style={{ fontSize: 10, color: '#636366', marginTop: 2 }}>{s.phq9_score != null ? 'PHQ-9' : 'GAD-7'}</div>
                          {sev && (
                            <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: sev.bg, color: sev.color, fontWeight: 500, marginTop: 4, display: 'inline-block' }}>
                              {sev.label}
                            </span>
                          )}
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
    </Layout>
  )
}

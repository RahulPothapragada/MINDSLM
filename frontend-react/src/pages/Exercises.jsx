import { useState, useEffect } from 'react'
import { Wind, Anchor, ArrowLeft, X } from 'lucide-react'
import Layout from '../components/Layout'

function BreathingExercise({ onClose }) {
  const phases = [
    { label: 'Inhale',  duration: 4, scale: 1.35 },
    { label: 'Hold',    duration: 4, scale: 1.35 },
    { label: 'Exhale',  duration: 4, scale: 0.82 },
    { label: 'Hold',    duration: 2, scale: 0.82 },
  ]
  const [phaseIdx, setPhaseIdx] = useState(0)
  const [count, setCount]       = useState(phases[0].duration)
  const [cycles, setCycles]     = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCount(prev => {
        if (prev <= 1) {
          setPhaseIdx(pp => {
            const next = (pp + 1) % 4
            if (next === 0) setCycles(c => c + 1)
            setCount(phases[next].duration)
            return next
          })
          return phases[(phaseIdx + 1) % 4].duration
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [phaseIdx])

  const phase = phases[phaseIdx]

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.96)',
      backdropFilter: 'blur(28px)',
      zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
    }}>
      <button
        onClick={onClose}
        style={{ position: 'absolute', top: 22, right: 22, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', cursor: 'pointer', color: '#8e8e93', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8 }}
      >
        <X size={14} />
      </button>

      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#3a3a3c', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Box Breathing</p>
        <p style={{ fontSize: 12, color: '#636366', marginBottom: 48 }}>Cycle {cycles + 1}</p>

        {/* Animated circle */}
        <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 48px' }}>
          {/* Outer glow ring */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(48,209,88,0.06)',
            transform: `scale(${phase.scale})`,
            transition: `transform ${phase.duration}s ease-in-out`,
          }} />
          {/* Middle ring */}
          <div style={{
            position: 'absolute', inset: 16, borderRadius: '50%',
            border: '1px solid rgba(48,209,88,0.15)',
            transform: `scale(${phase.scale > 1 ? 1.08 : 0.92})`,
            transition: `transform ${phase.duration}s ease-in-out`,
          }} />
          {/* Inner ring */}
          <div style={{
            position: 'absolute', inset: 32, borderRadius: '50%',
            border: `1.5px solid ${phaseIdx === 2 ? 'rgba(48,209,88,0.25)' : 'rgba(48,209,88,0.40)'}`,
            transition: `border-color ${phase.duration}s ease-in-out`,
          }} />
          {/* Counter */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <span style={{ fontSize: 44, fontWeight: 700, color: '#f5f5f7', letterSpacing: '-0.04em', lineHeight: 1 }}>{count}</span>
            <span style={{ fontSize: 13, color: '#30d158', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{phase.label}</span>
          </div>
        </div>

        <p style={{ fontSize: 11, color: '#3a3a3c', marginBottom: 28 }}>4 in · 4 hold · 4 out · 2 hold</p>
        <button
          onClick={onClose}
          style={{ padding: '9px 22px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)', color: '#8e8e93', fontSize: 13, cursor: 'pointer' }}
        >
          Done
        </button>
      </div>
    </div>
  )
}

function GroundingExercise({ onClose }) {
  const steps = [
    { n: 5, sense: 'SEE',   emoji: '👁',  prompt: 'Name 5 things you can see right now' },
    { n: 4, sense: 'HEAR',  emoji: '👂',  prompt: 'Name 4 sounds you can hear' },
    { n: 3, sense: 'FEEL',  emoji: '✋',  prompt: 'Name 3 things you can physically touch' },
    { n: 2, sense: 'SMELL', emoji: '👃',  prompt: 'Name 2 things you can smell' },
    { n: 1, sense: 'TASTE', emoji: '👅',  prompt: 'Name 1 thing you can taste' },
  ]
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)

  if (done) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(28px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ textAlign: 'center', maxWidth: 300 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f7', marginBottom: 8, letterSpacing: '-0.03em' }}>Well done</h2>
        <p style={{ fontSize: 14, color: '#636366', marginBottom: 28, lineHeight: 1.6 }}>Take a slow breath and notice how you feel now.</p>
        <button
          onClick={onClose}
          style={{ padding: '11px 28px', borderRadius: 10, background: '#30d158', color: '#000', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          Return
        </button>
      </div>
    </div>
  )

  const s = steps[step]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', backdropFilter: 'blur(28px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'fadeIn 0.2s ease' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#636366', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <span style={{ fontSize: 12, color: '#3a3a3c', fontWeight: 500 }}>{step + 1} of {steps.length}</span>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 36 }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 99,
              background: i <= step ? '#30d158' : 'rgba(255,255,255,0.07)',
              transition: 'background 0.3s ease',
            }} />
          ))}
        </div>

        <div style={{ fontSize: 40, marginBottom: 16 }}>{s.emoji}</div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(48,209,88,0.10)', border: '1px solid rgba(48,209,88,0.20)', borderRadius: 99, padding: '3px 10px', marginBottom: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#30d158', letterSpacing: '0.04em' }}>{s.n} things to {s.sense}</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f5f5f7', letterSpacing: '-0.02em', marginBottom: 20, lineHeight: 1.3 }}>{s.prompt}</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
          {Array(s.n).fill(0).map((_, i) => (
            <input
              key={i}
              placeholder={`${i + 1}.`}
              style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#f5f5f7', outline: 'none',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(48,209,88,0.35)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
            />
          ))}
        </div>

        <button
          onClick={() => step < steps.length - 1 ? setStep(s => s + 1) : setDone(true)}
          style={{ width: '100%', padding: '13px', borderRadius: 10, background: '#30d158', color: '#000', border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '-0.01em' }}
        >
          {step < steps.length - 1 ? 'Next →' : 'Complete'}
        </button>
      </div>
    </div>
  )
}

export default function Exercises({ user }) {
  const [active, setActive]   = useState(null)
  const [hovered, setHovered] = useState(null)

  const cards = [
    {
      key: 'breathing',
      Icon: Wind,
      color: '#30d158',
      title: 'Box Breathing',
      desc: '4-4-4-2 breathing pattern that activates your parasympathetic nervous system and reduces anxiety within minutes.',
      tag: 'Anxiety · Panic · Stress',
      duration: '5 min',
    },
    {
      key: 'grounding',
      Icon: Anchor,
      color: '#0a84ff',
      title: '5-4-3-2-1 Grounding',
      desc: 'Use your five senses to anchor yourself to the present moment and break a cycle of rumination.',
      tag: 'Sadness · Grief · Overwhelm',
      duration: '3 min',
    },
  ]

  return (
    <Layout user={user}>
      {active === 'breathing' && <BreathingExercise onClose={() => setActive(null)} />}
      {active === 'grounding' && <GroundingExercise onClose={() => setActive(null)} />}

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '44px 32px', animation: 'fadeUp 0.3s ease forwards' }}>
        <div style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.04em', color: '#f5f5f7', marginBottom: 4 }}>Exercises</h1>
          <p style={{ fontSize: 14, color: '#636366' }}>Evidence-based techniques for anxiety and stress</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {cards.map(ex => (
            <button
              key={ex.key}
              onClick={() => setActive(ex.key)}
              onMouseEnter={() => setHovered(ex.key)}
              onMouseLeave={() => setHovered(null)}
              style={{
                padding: '28px 24px',
                borderRadius: 16,
                border: `1px solid ${hovered === ex.key ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.07)'}`,
                background: hovered === ex.key ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                textAlign: 'left', cursor: 'pointer',
                transition: 'all 0.18s',
                transform: hovered === ex.key ? 'translateY(-2px)' : 'translateY(0)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: `${ex.color}15`,
                  border: `1px solid ${ex.color}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ex.Icon size={20} color={ex.color} strokeWidth={1.8} />
                </div>
                <span style={{ fontSize: 11, color: '#3a3a3c', fontWeight: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '3px 8px' }}>
                  {ex.duration}
                </span>
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f7', marginBottom: 8, letterSpacing: '-0.02em' }}>{ex.title}</h3>
              <p style={{ fontSize: 13, color: '#636366', lineHeight: 1.65, marginBottom: 16 }}>{ex.desc}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ex.tag.split(' · ').map(t => (
                  <span key={t} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: `${ex.color}10`, border: `1px solid ${ex.color}20`, color: ex.color, fontWeight: 500 }}>{t}</span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>
    </Layout>
  )
}

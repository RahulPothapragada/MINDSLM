import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Brain, Activity, Database, Lock, ShieldCheck, Plus, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import RobotAvatar from '../components/RobotAvatar'
import { Spotlight } from '../components/Spotlight'

const faqs = [
  {
    num: '01',
    q: 'How is my conversation data protected?',
    a: 'Your data is processed with the highest security standards. We prioritize strict data isolation and encryption to ensure your mental health records remain entirely private and secure.',
  },
  {
    num: '02',
    q: 'What clinical screening is used?',
    a: 'MindSLM organically weaves PHQ-9 (Depression) and GAD-7 (Anxiety) assessments into your natural conversation, tracking your score longitudinally without tedious forms.',
  },
  {
    num: '03',
    q: 'How does the emotion engine work?',
    a: 'The dynamic engine uses a GoEmotions classifier to detect 27 distinct emotional states in real-time, allowing the AI to adjust its tone and response strategy specifically to your current state.',
  },
  {
    num: '04',
    q: 'Is this a replacement for real therapy?',
    a: 'No. MindSLM is a supplementary support and clinical screening tool. It is not a replacement for professional medical help. If you are in crisis, please call iCall at 9152987821 or emergency services at 112 immediately.',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <div style={{ width: '100%', overflowX: 'hidden', background: '#000000', color: '#FFFFFF', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Sleek Navigation */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #222222', borderRadius: 99, padding: '6px 20px 6px 6px', background: '#0A0A0A' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={16} color="#000000" />
            </div>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#FFFFFF' }}>MindSLM</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <button
              onClick={() => navigate('/login')}
              style={{ fontSize: 14, fontWeight: 500, color: '#888888', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#FFFFFF'}
              onMouseLeave={e => e.currentTarget.style.color = '#888888'}
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/register')}
              style={{ fontSize: 14, fontWeight: 600, color: '#000000', background: '#FFFFFF', border: 'none', cursor: 'pointer', padding: '10px 20px', borderRadius: 99, transition: 'background 0.2s, transform 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E5E5E5'; e.currentTarget.style.transform = 'scale(1.02)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Header with 3D Robot */}
      <section style={{ paddingTop: 160, paddingBottom: 60, paddingLeft: 32, paddingRight: 32, maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 48 }}>
        
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} style={{ flex: '1 1 400px' }}>
          <h1 style={{ 
            fontSize: 'clamp(60px, 10vw, 120px)', 
            fontWeight: 800, 
            letterSpacing: '-0.06em', 
            lineHeight: 1, 
            marginBottom: 24,
            color: '#FFFFFF'
          }}>
            MindSLM
          </h1>
          <p style={{ fontSize: 22, color: '#888888', maxWidth: 500, lineHeight: 1.5, marginBottom: 40 }}>
            Say goodbye to generic responses. Interact with a dynamic, emotion-aware clinical intelligence designed to guide your mental health journey.
          </p>
          <button
              onClick={() => navigate('/register')}
              style={{ fontSize: 16, fontWeight: 600, color: '#000000', background: '#FFFFFF', border: 'none', cursor: 'pointer', padding: '16px 32px', borderRadius: 99, transition: 'background 0.2s, transform 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#E5E5E5'; e.currentTarget.style.transform = 'scale(1.02)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.transform = 'scale(1)' }}
            >
              Start interaction
            </button>
        </motion.div>

        <div style={{ flex: '1 1 500px', height: 600, position: 'relative', animation: 'robotZoomIn 1s cubic-bezier(0.16,1,0.3,1) forwards' }}>
          <Spotlight style={{ top: '-20%', left: '10%' }} />
          <RobotAvatar />
        </div>
      </section>

      {/* Bento Box Grid */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px 140px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
          
          {/* Large Card - 8 cols */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
            style={{ gridColumn: 'span 8', background: '#0A0A0A', border: '1px solid #222222', borderRadius: 24, padding: 48, position: 'relative', overflow: 'hidden', minHeight: 380, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          >
            <div style={{ position: 'absolute', top: 48, right: 48, width: 48, height: 48, borderRadius: '50%', background: '#111111', border: '1px solid #333333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={20} color="#FFFFFF" />
            </div>
            <h2 style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>Built for empathy</h2>
            <p style={{ fontSize: 16, color: '#888888', maxWidth: 440, lineHeight: 1.6 }}>
              A dynamic engine powered by GoEmotions determines eligibility globally. Real-time emotion extraction ensures responses adapt to exactly how you are feeling the second you type it. No generic platitudes.
            </p>
          </motion.div>

          {/* Medium Card - 4 cols */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
            style={{ gridColumn: 'span 4', background: '#0A0A0A', border: '1px solid #222222', borderRadius: 24, padding: 40, minHeight: 380 }}
          >
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#111111', border: '1px solid #333333', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
              <Database size={18} color="#FFFFFF" />
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 16 }}>Powered by signals</h3>
            <p style={{ fontSize: 15, color: '#888888', lineHeight: 1.6 }}>
              Clinical experience drives all events cleanly. We use retrieval-augmented generation across thousands of real therapist interactions to build contextual prompt responses.
            </p>
          </motion.div>

          {/* Small Card 1 - 4 cols */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
            style={{ gridColumn: 'span 4', background: '#0A0A0A', border: '1px solid #222222', borderRadius: 24, padding: 40 }}
          >
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#111111', border: '1px solid #333333', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
              <ShieldCheck size={18} color="#FFFFFF" />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Designed for clarity</h3>
            <p style={{ fontSize: 14, color: '#888888', lineHeight: 1.6 }}>
              Simple screening windows. PHQ-9 and GAD-7 assessments happen organically without forms.
            </p>
          </motion.div>

          {/* Small Card 2 - 8 cols */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}
            style={{ gridColumn: 'span 8', background: '#0A0A0A', border: '1px solid #222222', borderRadius: 24, padding: 40, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={16} color="#000000" />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', color: '#FFFFFF' }}>PRIVACY MATRIX</span>
            </div>
            <h3 style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.02em', maxWidth: 500, lineHeight: 1.2 }}>
              Continuous monitoring infrastructure validating security 24/7.
            </h3>
          </motion.div>

        </div>
      </section>

      {/* Product Scope Section */}
      <section style={{ padding: '0 32px 140px', maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #333333', borderRadius: 99, padding: '6px 16px', marginBottom: 24, background: '#111111' }}>
            <ShieldCheck size={14} color="#FFFFFF" />
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', color: '#FFFFFF' }}>PRODUCT SCOPE</span>
          </div>
          <h2 style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 24 }}>What MindSLM covers</h2>
          <p style={{ fontSize: 18, color: '#888888', maxWidth: 680, margin: '0 auto 60px', lineHeight: 1.6 }}>
            Fully automated mental health support when life disruptions reduce your capacity. MindSLM ensures <strong style={{ color: '#FFFFFF' }}>clinical screening from uncontrollable events</strong>, built directly into your everyday digital life.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, textAlign: 'left' }}>
          {[
            { icon: Sparkles, title: 'Screening & environment', text: 'Depression, anxiety, and other conditions that stop productivity are tracked objectively via PHQ-9 thresholds in your zone.' },
            { icon: Activity, title: 'Emotion restrictions', text: 'Sudden spikes in fear or grief that block emotional capacity are verified against internal signals for CBT interventions.' },
            { icon: Database, title: 'Parametric generation', text: 'Loss-of-capacity triggers only: when rules fire, RAG pipelines automatically pull contextual therapist advice.' },
          ].map((f, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.1 }}
              style={{ background: '#0A0A0A', border: '1px solid #222222', borderRadius: 24, padding: 40 }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#111111', border: '1px solid #333333', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
                <f.icon size={18} color="#FFFFFF" />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{f.title}</h3>
              <p style={{ fontSize: 15, color: '#888888', lineHeight: 1.6 }}>{f.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FAQ Section */}
      <section style={{ padding: '0 32px 140px', maxWidth: 800, margin: '0 auto' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 16 }}>Frequently asked questions</h2>
          <p style={{ fontSize: 16, color: '#888888' }}>Quick answers about privacy, screening, and operations.</p>
        </motion.div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{ borderTop: '1px solid #222222' }}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '32px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF', fontFamily: 'monospace' }}>{faq.num}</span>
                  <span style={{ fontSize: 20, fontWeight: 600, color: '#FFFFFF' }}>{faq.q}</span>
                </div>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#111111', border: '1px solid #333333', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.3s, background 0.3s', transform: openFaq === i ? 'rotate(45deg)' : 'rotate(0)' }}>
                  <Plus size={20} color="#FFFFFF" />
                </div>
              </button>
              
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <p style={{ padding: '0 0 32px 50px', fontSize: 16, color: '#888888', lineHeight: 1.6, maxWidth: 600 }}>
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #222222' }} />
        </div>
      </section>

      {/* Minimal Footer */}
      <footer style={{ borderTop: '1px solid #111111', padding: '48px 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Brain size={18} color="#FFFFFF" />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>MindSLM © 2026</span>
          </div>
          <p style={{ color: '#888888', fontSize: 13 }}>
            If in crisis, call <span style={{ color: '#FFFFFF', fontWeight: 600 }}>iCall 9152987821</span> or <span style={{ color: '#FFFFFF', fontWeight: 600 }}>112</span>.
          </p>
        </div>
      </footer>

      {/* Global CSS for Grid Mobile Fallback */}
      <style>{`
        @media (max-width: 900px) {
          div[style*="grid-template-columns: repeat(12, 1fr)"] > div { grid-column: span 12 !important; min-height: auto !important; }
        }
        @keyframes robotZoomIn {
          0%   { opacity: 0; transform: scale(0.6) translateY(40px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}

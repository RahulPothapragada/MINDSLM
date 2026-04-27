import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Brain, Mail } from 'lucide-react'

export default function Register() {
  const navigate = useNavigate()
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)
  const [focused, setFocused] = useState(null)

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signUp({
      email, password, options: { data: { full_name: name } }
    })
    if (error) setError(error.message)
    else setDone(true)
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` }
    })
  }

  const inputStyle = (field) => ({
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${focused === field ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: 10, padding: '12px 14px',
    fontSize: 14, color: '#f5f5f7',
    outline: 'none', transition: 'border-color 0.15s',
  })

  if (done) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 340, animation: 'fadeUp 0.3s ease forwards' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <Mail size={24} color="#FFFFFF" />
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f5f5f7', marginBottom: 10, letterSpacing: '-0.03em' }}>Check your email</h2>
        <p style={{ color: '#636366', fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
          We sent a confirmation link to{' '}
          <span style={{ color: '#aeaeb2', fontWeight: 500 }}>{email}</span>.
          Click it to activate your account.
        </p>
        <button
          onClick={() => navigate('/login')}
          style={{ fontSize: 14, color: '#aeaeb2', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8, padding: '9px 20px', cursor: 'pointer' }}
        >
          Back to sign in
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', width: '100%', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360, animation: 'fadeUp 0.3s ease forwards' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Brain size={22} color="#000000" strokeWidth={2.5} />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', color: '#f5f5f7', marginBottom: 4 }}>Create account</h1>
          <p style={{ fontSize: 13, color: '#636366' }}>Free. No credit card required.</p>
        </div>

        {/* Google */}
        <button
          onClick={handleGoogle}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            border: '1px solid rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.04)',
            color: '#e5e5e7', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', marginBottom: 20, transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)' }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.7 33.9 29.3 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.5 5.1 29.5 3 24 37 3 24 12.4 3 24 3c5.5 0 10.5 2.1 14.3 5.5L43.6 20z"/>
            <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.5 5.1 29.5 3 24 3 16.3 3 9.6 7.9 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 45c5.2 0 10-1.9 13.7-5.1l-6.3-5.3C29.4 36.5 26.8 37 24 37c-5.2 0-9.6-3-11.3-7.4l-6.6 4.9C9.5 41 16.3 45 24 45z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.3 5.3C41.2 35.2 44 30 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          Continue with Google
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          <span style={{ fontSize: 11, color: '#3a3a3c', fontWeight: 500 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#8e8e93', marginBottom: 6 }}>Full name</label>
            <input type="text" placeholder="Jane Smith" value={name} onChange={e => setName(e.target.value)} required
              onFocus={() => setFocused('name')} onBlur={() => setFocused(null)}
              style={inputStyle('name')} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#8e8e93', marginBottom: 6 }}>Email</label>
            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required
              onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
              style={inputStyle('email')} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#8e8e93', marginBottom: 6 }}>Password</label>
            <input type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPass(e.target.value)} required minLength={6}
              onFocus={() => setFocused('password')} onBlur={() => setFocused(null)}
              style={inputStyle('password')} />
          </div>

          {error && (
            <div style={{ fontSize: 13, color: '#ff453a', background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.16)', borderRadius: 8, padding: '10px 12px' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', background: '#FFFFFF', color: '#000000',
            border: 'none', borderRadius: 99, padding: '13px',
            fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
            marginTop: 4, opacity: loading ? 0.7 : 1, transition: 'background 0.2s, transform 0.2s',
            letterSpacing: '-0.01em',
          }}
          onMouseEnter={e => { if(!loading) { e.currentTarget.style.background = '#E5E5E5'; e.currentTarget.style.transform = 'scale(1.02)' } }}
          onMouseLeave={e => { if(!loading) { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.transform = 'scale(1)' } }}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#636366', marginTop: 20 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#aeaeb2', fontWeight: 500 }}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}

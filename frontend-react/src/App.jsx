import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import Landing   from './pages/Landing'
import Login     from './pages/Login'
import Register  from './pages/Register'
import Dashboard from './pages/Dashboard'
import Chat      from './pages/Chat'
import Insights  from './pages/Insights'
import Exercises from './pages/Exercises'

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 22, height: 22, border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#30d158', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"          element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
        <Route path="/login"     element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/register"  element={user ? <Navigate to="/dashboard" replace /> : <Register />} />
        <Route path="/dashboard" element={<ProtectedRoute user={user}><Dashboard user={user} /></ProtectedRoute>} />
        <Route path="/chat"      element={<ProtectedRoute user={user}><Chat user={user} /></ProtectedRoute>} />
        <Route path="/chat/:sessionId" element={<ProtectedRoute user={user}><Chat user={user} /></ProtectedRoute>} />
        <Route path="/insights"  element={<ProtectedRoute user={user}><Insights user={user} /></ProtectedRoute>} />
        <Route path="/exercises" element={<ProtectedRoute user={user}><Exercises user={user} /></ProtectedRoute>} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

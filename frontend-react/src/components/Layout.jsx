import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Brain, LayoutDashboard, MessageCircle, BarChart2, Wind, LogOut } from 'lucide-react'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/chat',      icon: MessageCircle,   label: 'Chat'      },
  { to: '/insights',  icon: BarChart2,       label: 'Insights'  },
  { to: '/exercises', icon: Wind,            label: 'Exercises' },
]

export default function Layout({ user, children }) {
  const navigate = useNavigate()
  const [hoveredNav, setHoveredNav] = useState(null)

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  const name   = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You'
  const avatar = user?.user_metadata?.avatar_url
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: '#000', overflow: 'hidden' }}>

      {/* Sidebar */}
      <aside style={{
        width: 210, flexShrink: 0,
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        background: '#000',
      }}>

        {/* Logo */}
        <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 18px', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: '#30d158',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Brain size={14} color="#000" strokeWidth={2.5} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#f5f5f7', letterSpacing: '-0.03em' }}>MindSLM</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(n => (
            <NavLink
              key={n.to}
              to={n.to}
              onMouseEnter={() => setHoveredNav(n.to)}
              onMouseLeave={() => setHoveredNav(null)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                textDecoration: 'none',
                fontFamily: 'inherit',
                color: isActive ? '#f5f5f7' : hoveredNav === n.to ? '#aeaeb2' : '#636366',
                background: isActive
                  ? 'rgba(255,255,255,0.06)'
                  : hoveredNav === n.to ? 'rgba(255,255,255,0.03)' : 'transparent',
                transition: 'all 0.12s',
                position: 'relative',
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span style={{
                      position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                      width: 2, height: 16, background: '#30d158', borderRadius: 99,
                    }} />
                  )}
                  <n.icon
                    size={15}
                    color={isActive ? '#30d158' : hoveredNav === n.to ? '#aeaeb2' : '#636366'}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{
          padding: '12px 12px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {avatar
            ? <img src={avatar} style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0 }} alt="" />
            : (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(48,209,88,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#30d158', flexShrink: 0,
              }}>
                {initials}
              </div>
            )
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#e5e5e7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            <div style={{ fontSize: 10, color: '#3a3a3c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{user?.email}</div>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a3a3c', display: 'flex', padding: 2, borderRadius: 4, transition: 'color 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#636366'}
            onMouseLeave={e => e.currentTarget.style.color = '#3a3a3c'}
          >
            <LogOut size={13} />
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflowY: 'auto', background: '#000' }}>
        {children}
      </main>
    </div>
  )
}

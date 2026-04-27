import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BarChart2, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Color scale: 0 sessions = near-invisible, ramps up to solid purple
const getColorForValue = (val, max) => {
  if (!val || val === 0) return 'rgba(255, 255, 255, 0.04)';
  const ratio = Math.min(val / Math.max(max, 1), 1);
  if (ratio < 0.25) return 'rgba(191, 90, 242, 0.2)';
  if (ratio < 0.5)  return 'rgba(191, 90, 242, 0.45)';
  if (ratio < 0.75) return 'rgba(191, 90, 242, 0.72)';
  return 'rgba(191, 90, 242, 1)';
};

const HeatmapCell = ({ val, max, label }) => (
  <div
    className="w-full rounded-md border border-[rgba(255,255,255,0.04)] transition-all duration-200 cursor-default"
    style={{
      height: 28,
      backgroundColor: getColorForValue(val, max),
    }}
    title={`${label}: ${val} session${val !== 1 ? 's' : ''}`}
  />
);

const TIMES = ['00h', '03h', '06h', '09h', '12h', '15h', '18h', '21h'];

const CustomGridHeatmap = ({ data, maxVal }) => (
  <div className="flex flex-col w-full text-xs text-[#8e8e93]">
    {/* Time header */}
    <div className="flex w-full mb-2">
      <div className="w-12 shrink-0" />
      {TIMES.map(t => (
        <div key={t} className="flex-1 text-center font-medium">{t}</div>
      ))}
    </div>

    {/* Rows */}
    <div className="flex flex-col w-full gap-[5px]">
      {data.map(row => (
        <div key={row.key} className="flex w-full items-center gap-[5px]">
          <div className="w-12 shrink-0 text-right pr-3 font-medium text-[#aeaeb2]">{row.key}</div>
          {row.data.map(cell => (
            <div key={cell.key} className="flex-1">
              <HeatmapCell val={cell.data} max={maxVal} label={`${row.key} ${cell.key}`} />
            </div>
          ))}
        </div>
      ))}
    </div>

    {/* Legend */}
    <div className="flex items-center gap-2 mt-6 text-[10px] justify-end pr-1 text-[#636366] font-medium tracking-wide uppercase">
      <span>No sessions</span>
      <div className="flex gap-[3px]">
        {[0.15, 0.35, 0.6, 1].map((r, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded-sm"
            style={{ backgroundColor: `rgba(191,90,242,${r})` }}
          />
        ))}
      </div>
      <span>Most active</span>
    </div>
  </div>
);

// Build a blank heatmap grid (all zeros) for loading state
const BLANK_GRID = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => ({
  key: day,
  data: TIMES.map(t => ({ key: t, data: 0 })),
}));

export default function IncidentHeatmapReportCard() {
  const [heatmapData, setHeatmapData] = useState(BLANK_GRID);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch(`${API}/api/heatmap`)
      .then(r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then(json => {
        setHeatmapData(json.heatmap || BLANK_GRID);
        setStats(json.stats || null);
        setLoading(false);
      })
      .catch(err => {
        setError('Could not load activity data. Is the backend running?');
        setLoading(false);
      });
  };

  useEffect(() => { fetchData(); }, []);

  // Compute max value across the entire grid for colour scaling
  const allVals = heatmapData.flatMap(row => row.data.map(c => c.data));
  const maxVal = Math.max(...allVals, 1);

  const totalSessions = stats?.total_sessions ?? 0;
  const severeSessions = stats?.severe_count ?? 0;
  const avgPhq9 = stats?.avg_phq9 ?? null;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 24,
      }}
      className="flex flex-col w-full max-w-[620px] text-white overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex justify-between items-start p-8 pb-5">
        <div>
          <p style={{ fontSize: 12, color: '#8e8e93', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 4 }}>
            Activity
          </p>
          <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            Session Frequency
          </h3>
          <p style={{ fontSize: 12, color: '#636366', marginTop: 3 }}>
            When you check in — aggregated from your real sessions
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#aeaeb2',
            padding: '6px 12px',
            borderRadius: 8,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: loading ? 'wait' : 'pointer',
            marginTop: 4,
          }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div style={{ margin: '0 32px 16px', padding: '10px 14px', background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.25)', borderRadius: 10, fontSize: 12, color: '#ff453a' }}>
          {error}
        </div>
      )}

      {/* ── Heatmap grid ── */}
      <div className="px-8 pb-6">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 220 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#bf5af2', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <CustomGridHeatmap data={heatmapData} maxVal={maxVal} />
        )}
      </div>

      {/* ── Stats strip ── */}
      <div
        className="flex w-full px-8 py-5 gap-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Total sessions */}
        <div className="flex flex-col gap-1 flex-1 pr-6" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 size={14} color="#0a84ff" />
            <span style={{ fontSize: 12, color: '#8e8e93', fontWeight: 500 }}>Total Sessions</span>
          </div>
          <span style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {loading ? '—' : totalSessions}
          </span>
          <span style={{ fontSize: 11, color: '#636366', marginTop: 4 }}>
            {totalSessions === 0 ? 'No sessions recorded yet' : `${totalSessions} check-in${totalSessions !== 1 ? 's' : ''} in total`}
          </span>
        </div>

        {/* Severe sessions */}
        <div className="flex flex-col gap-1 flex-1 px-6" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} color="#ff9f0a" />
            <span style={{ fontSize: 12, color: '#8e8e93', fontWeight: 500 }}>Severe Flags</span>
          </div>
          <span style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {loading ? '—' : severeSessions}
          </span>
          <span style={{ fontSize: 11, color: '#636366', marginTop: 4 }}>
            {totalSessions > 0
              ? `${Math.round((severeSessions / totalSessions) * 100)}% of all sessions`
              : 'No sessions yet'}
          </span>
        </div>

        {/* Avg PHQ-9 */}
        <div className="flex flex-col gap-1 flex-1 pl-6">
          <div className="flex items-center gap-2 mb-1">
            <Activity size={14} color="#bf5af2" />
            <span style={{ fontSize: 12, color: '#8e8e93', fontWeight: 500 }}>Avg PHQ-9</span>
          </div>
          <span style={{ fontSize: 32, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>
            {loading ? '—' : (avgPhq9 !== null ? avgPhq9 : 'N/A')}
          </span>
          <span style={{ fontSize: 11, color: '#636366', marginTop: 4 }}>
            {avgPhq9 !== null
              ? avgPhq9 < 5 ? 'Minimal range' : avgPhq9 < 10 ? 'Mild range' : avgPhq9 < 15 ? 'Moderate range' : 'Severe range'
              : 'No PHQ-9 data yet'}
          </span>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

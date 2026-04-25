// ==============================
// MindSLM Frontend — v2
// GoEmotions + PHQ-9/GAD-7 Screening + Timeline
// ==============================

const API_BASE  = "http://localhost:8080";
const CHAT_API  = `${API_BASE}/api/chat`;
const HEALTH_API = `${API_BASE}/api/health`;
const TIMELINE_API = `${API_BASE}/api/timeline`;

// ==============================
// DOM
// ==============================
const input       = document.querySelector('.main-input');
const sendBtn     = document.querySelector('.send-btn');
const heroSection = document.querySelector('.hero-section');
const mainPanel   = document.querySelector('.main-panel');

// ==============================
// SESSION MANAGEMENT
// ==============================
let sessions = JSON.parse(localStorage.getItem('mindslm_sessions') || '[]');
let activeSessionId = null;

function generateId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function getTimeLabel() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning Check-In';
  if (h < 17) return 'Afternoon Check-In';
  if (h < 21) return 'Evening Check-In';
  return 'Night Check-In';
}

function createNewSession() {
  const session = { id: generateId(), name: getTimeLabel(), date: new Date().toISOString(), messages: [] };
  sessions.unshift(session);
  saveSessions();
  setActiveSession(session.id);
  resetToHero();
  renderSessionList();
}

function setActiveSession(id) {
  activeSessionId = id;
  renderSessionList();
  const session = sessions.find(s => s.id === id);
  if (session && session.messages.length > 0) {
    activateChatMode();
    chatContainer.innerHTML = '';
    session.messages.forEach(msg => {
      if (msg.role === 'user') addUserMessage(msg.text, false);
      else addAssistantMessage(msg.text, msg.meta, false);
    });
    scrollToBottom();
  } else {
    resetToHero();
  }
}

function saveSessions() { localStorage.setItem('mindslm_sessions', JSON.stringify(sessions)); }
function getActiveSession() { return sessions.find(s => s.id === activeSessionId); }

function formatSessionDate(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 86400000) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderSessionList() {
  const list = document.querySelector('.session-list');
  if (!list) return;
  list.innerHTML = '';
  if (sessions.length === 0) {
    list.innerHTML = '<li style="color:var(--text-muted);font-size:12px;padding:8px 12px;">No sessions yet</li>';
    return;
  }
  sessions.forEach(s => {
    const li = document.createElement('li');
    li.className = 'session-item' + (s.id === activeSessionId ? ' active' : '');
    const cnt = s.messages.filter(m => m.role === 'user').length;
    const lastMeta = s.messages.length ? s.messages[s.messages.length - 1].meta : null;
    li.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
        <span>${s.name}</span>
        <span style="font-size:10px;color:var(--text-muted)">${formatSessionDate(s.date)}</span>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
        ${cnt} msg${cnt !== 1 ? 's' : ''}${lastMeta?.classification ? ' · ' + lastMeta.classification : ''}
      </div>`;
    li.style.cssText = 'display:flex;flex-direction:column;cursor:pointer;';
    li.addEventListener('click', () => setActiveSession(s.id));
    list.appendChild(li);
  });
}

// ==============================
// CHAT CONTAINER
// ==============================
const chatContainer = document.createElement('div');
chatContainer.className = 'chat-container';
chatContainer.style.cssText = 'flex:1;overflow-y:auto;padding:20px 32px;display:none;flex-direction:column;gap:16px;';
const bottomInput = document.querySelector('.bottom-input-container');
mainPanel.insertBefore(chatContainer, bottomInput);

// ==============================
// PIPELINE STATUS BAR
// ==============================
const pipelineBar = document.createElement('div');
pipelineBar.className = 'pipeline-bar';
pipelineBar.style.cssText = 'display:none;padding:8px 32px;font-size:11px;color:#71717A;border-bottom:1px solid rgba(255,255,255,0.05);gap:8px;align-items:center;font-family:var(--font-inter);';
pipelineBar.innerHTML = `
  <span class="pipe-step" id="ps1">① Emotions</span><span style="color:#3F3F46">→</span>
  <span class="pipe-step" id="ps2">② Screen</span><span style="color:#3F3F46">→</span>
  <span class="pipe-step" id="ps3">③ Generate</span><span style="color:#3F3F46">→</span>
  <span class="pipe-step" id="ps4">④ Safety</span>
  <span id="screening-badge" style="margin-left:auto;display:none;font-size:10px;padding:2px 8px;border-radius:6px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);color:#818CF8;"></span>`;
document.querySelector('.main-header').after(pipelineBar);

// ==============================
// STYLES
// ==============================
const styleEl = document.createElement('style');
styleEl.textContent = `
  .pipe-step{padding:2px 8px;border-radius:6px;font-size:10px;font-weight:500;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);transition:all .3s}
  .pipe-step.active{background:rgba(139,92,246,0.15);border-color:rgba(139,92,246,0.4);color:#C4B5FD}
  .chat-message{max-width:75%;animation:msgIn .3s ease}.chat-message.user{align-self:flex-end}.chat-message.assistant{align-self:flex-start}
  .chat-bubble{padding:12px 16px;border-radius:16px;font-size:14px;line-height:1.65;word-wrap:break-word}
  .chat-message.user .chat-bubble{background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff;border-bottom-right-radius:4px}
  .chat-message.assistant .chat-bubble{background:var(--bg-card);border:1px solid var(--border-color);color:var(--text-primary);border-bottom-left-radius:4px}
  .chat-meta{font-size:11px;color:var(--text-muted);margin-top:6px;padding:0 4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
  .class-tag{font-size:10px;font-weight:600;padding:2px 8px;border-radius:6px}
  .class-tag.Anxiety{background:rgba(245,158,11,0.15);color:#F59E0B;border:1px solid rgba(245,158,11,0.3)}
  .class-tag.Depression{background:rgba(239,68,68,0.15);color:#EF4444;border:1px solid rgba(239,68,68,0.3)}
  .class-tag.Suicidal{background:rgba(239,68,68,0.25);color:#FCA5A5;border:1px solid rgba(239,68,68,0.5)}
  .class-tag.Normal{background:rgba(34,197,94,0.15);color:#22C55E;border:1px solid rgba(34,197,94,0.3)}
  .emotion-tag{font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);color:#A78BFA}
  .screening-complete{margin-top:12px;padding:12px 16px;border-radius:12px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2)}
  .screening-complete h4{font-size:13px;color:#818CF8;margin:0 0 6px 0;font-weight:600}
  .screening-complete .score{font-size:24px;font-weight:700;color:#C7D2FE}
  .screening-complete .severity{font-size:12px;color:#A5B4FC;text-transform:capitalize}
  .screening-progress{font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);color:#818CF8}
  .typing-indicator{display:flex;gap:5px;padding:14px 18px}
  .typing-indicator span{width:8px;height:8px;border-radius:50%;background:var(--text-muted);animation:bounce 1.4s infinite}
  .typing-indicator span:nth-child(2){animation-delay:.2s}.typing-indicator span:nth-child(3){animation-delay:.4s}
  .modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:1000;display:flex;align-items:center;justify-content:center;animation:fadeIn .2s}
  .modal-box{background:#111118;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;max-width:520px;width:90%;max-height:85vh;overflow-y:auto;animation:slideUp .3s}
  .modal-box h2{font-size:18px;margin-bottom:16px;color:#FAFAFA}.modal-box p{font-size:14px;line-height:1.7;color:#A1A1AA;margin-bottom:12px}
  .modal-box .resource{background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:12px;margin-bottom:8px}
  .modal-box .resource strong{color:#FCA5A5;font-size:13px}.modal-box .resource span{color:#EF4444;font-size:14px;font-weight:600}
  .modal-close{margin-top:16px;width:100%;padding:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#FAFAFA;font-size:14px;cursor:pointer}
  .modal-close:hover{background:rgba(255,255,255,0.1)}
  .settings-row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.05)}
  .settings-row label{color:#D4D4D8;font-size:14px}.settings-row .val{color:#71717A;font-size:13px}.settings-row .green{color:#22C55E}
  .toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1E1E28;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 20px;color:#FAFAFA;font-size:13px;z-index:999;animation:slideUp .3s}
  .timeline-card{background:var(--bg-card);border:1px solid var(--border-color);border-radius:12px;padding:16px;margin-bottom:12px}
  .timeline-card .date{font-size:11px;color:var(--text-muted)}
  .timeline-card .name{font-size:14px;color:var(--text-primary);margin:4px 0}
  .timeline-card .score-row{display:flex;gap:12px;align-items:center;margin-top:8px}
  .timeline-card .score-badge{font-size:20px;font-weight:700;color:#818CF8}
  .timeline-card .severity-label{font-size:12px;text-transform:capitalize;padding:2px 8px;border-radius:6px}
  .severity-minimal{background:rgba(34,197,94,0.15);color:#22C55E}
  .severity-mild{background:rgba(245,158,11,0.15);color:#F59E0B}
  .severity-moderate{background:rgba(239,68,68,0.15);color:#EF4444}
  .severity-moderately_severe{background:rgba(239,68,68,0.25);color:#FCA5A5}
  .severity-severe{background:rgba(220,38,38,0.3);color:#FCA5A5}
  .timeline-emotions{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
  @keyframes msgIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  @keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
`;
document.head.appendChild(styleEl);

// ==============================
// CHAT STATE
// ==============================
let chatActive = false;
function activateChatMode() { if (chatActive) return; chatActive = true; heroSection.style.display = 'none'; chatContainer.style.display = 'flex'; pipelineBar.style.display = 'flex'; }
function resetToHero() { chatActive = false; heroSection.style.display = ''; chatContainer.style.display = 'none'; chatContainer.innerHTML = ''; pipelineBar.style.display = 'none'; }

function animatePipeline() {
  ['ps1','ps2','ps3','ps4'].forEach(s => document.getElementById(s).classList.remove('active'));
  ['ps1','ps2','ps3','ps4'].forEach((s, i) => setTimeout(() => document.getElementById(s).classList.add('active'), i * 400));
}
function resetPipeline() { setTimeout(() => ['ps1','ps2','ps3','ps4'].forEach(s => document.getElementById(s).classList.remove('active')), 2000); }

// ==============================
// MESSAGES
// ==============================
function addUserMessage(text, save = true) {
  const div = document.createElement('div'); div.className = 'chat-message user';
  div.innerHTML = `<div class="chat-bubble">${escapeHtml(text)}</div>`;
  chatContainer.appendChild(div);
  if (save) { const s = getActiveSession(); if (s) { s.messages.push({ role: 'user', text }); saveSessions(); } }
  scrollToBottom();
}

function addAssistantMessage(text, meta, save = true) {
  const div = document.createElement('div'); div.className = 'chat-message assistant';
  let formatted = escapeHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  let html = `<div class="chat-bubble">${formatted}</div>`;

  if (meta) {
    html += `<div class="chat-meta">`;
    html += `<span class="class-tag ${meta.classification}">${meta.classification}</span>`;

    // Emotion tags
    if (meta.emotions && meta.emotions.length) {
      meta.emotions.slice(0, 3).forEach(e => {
        html += `<span class="emotion-tag">${e.label} ${Math.round(e.score * 100)}%</span>`;
      });
    }

    if (meta.latency) html += `<span>${meta.latency}s</span>`;
    html += `</div>`;

    // Screening complete card
    if (meta.screening && meta.screening.completed && meta.screening.final_score !== undefined) {
      const inst = meta.screening.instrument === 'phq9' ? 'PHQ-9' : 'GAD-7';
      const sev = meta.screening.severity || 'unknown';
      html += `<div class="screening-complete">
        <h4>${inst} Screening Complete</h4>
        <div style="display:flex;align-items:baseline;gap:8px">
          <span class="score">${meta.screening.final_score}</span>
          <span class="severity severity-${sev}">${sev.replace('_', ' ')}</span>
        </div>
      </div>`;
    }
  }

  div.innerHTML = html;
  chatContainer.appendChild(div);
  if (save) { const s = getActiveSession(); if (s) { s.messages.push({ role: 'assistant', text, meta }); saveSessions(); } }
  scrollToBottom();
}

function addTypingIndicator() {
  const div = document.createElement('div'); div.className = 'chat-message assistant'; div.id = 'typing-indicator';
  div.innerHTML = '<div class="chat-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
  chatContainer.appendChild(div); scrollToBottom(); return div;
}
function removeTypingIndicator() { const el = document.getElementById('typing-indicator'); if (el) el.remove(); }
function scrollToBottom() { chatContainer.scrollTop = chatContainer.scrollHeight; }
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function showToast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2500); }

// ==============================
// SEND MESSAGE
// ==============================
async function sendMessage(text) {
  if (!text || !text.trim()) return;
  const message = text.trim();
  if (!activeSessionId) createNewSession();
  activateChatMode();
  addUserMessage(message);
  input.value = '';
  sendBtn.disabled = true;
  const typing = addTypingIndicator();
  animatePipeline();

  try {
    const resp = await fetch(CHAT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: activeSessionId })
    });
    const data = await resp.json();
    removeTypingIndicator();

    const meta = {
      classification: data.classification,
      confidence: data.confidence,
      emotions: data.emotions || [],
      latency: data.latency_seconds,
      screening: data.screening || {},
    };

    addAssistantMessage(data.response, meta);

    // Update screening badge
    const badge = document.getElementById('screening-badge');
    if (data.screening && data.screening.active) {
      const p = data.screening.progress;
      const inst = data.screening.instrument === 'phq9' ? 'PHQ-9' : 'GAD-7';
      badge.textContent = `${inst}: ${p.answered}/${p.total}`;
      badge.style.display = '';
    } else if (data.screening && data.screening.completed) {
      const inst = data.screening.instrument === 'phq9' ? 'PHQ-9' : 'GAD-7';
      badge.textContent = `${inst}: Complete`;
      badge.style.display = '';
      badge.style.background = 'rgba(34,197,94,0.15)';
      badge.style.borderColor = 'rgba(34,197,94,0.3)';
      badge.style.color = '#22C55E';
    } else {
      badge.style.display = 'none';
    }

    // Rename session after first message
    const session = getActiveSession();
    if (session && session.messages.filter(m => m.role === 'user').length === 1) {
      session.name = data.classification + ' Support';
      saveSessions(); renderSessionList();
    }
    resetPipeline();
  } catch {
    removeTypingIndicator();
    addAssistantMessage("Couldn't reach the pipeline API. Make sure mindslm_pipeline_api.py is running on port 8080 and Ollama is active.", null);
    resetPipeline();
  }
  sendBtn.disabled = false; input.focus();
}

// ==============================
// SIDEBAR: NEW SESSION
// ==============================
const newSessionBtn = document.querySelector('.new-session-btn');
if (newSessionBtn) newSessionBtn.addEventListener('click', () => { createNewSession(); showToast('New session started'); });

// ==============================
// SIDEBAR: SETTINGS MODAL
// ==============================
function showSettingsModal() {
  const o = document.createElement('div'); o.className = 'modal-overlay';
  o.innerHTML = `<div class="modal-box"><h2>Settings</h2>
    <div class="settings-row"><label>Model</label><span class="val">MindSLM (Qwen2.5-1.5B fine-tuned)</span></div>
    <div class="settings-row"><label>Classifier</label><span class="val">GoEmotions (27 emotions)</span></div>
    <div class="settings-row"><label>Screening</label><span class="val">PHQ-9 / GAD-7 (conversational)</span></div>
    <div class="settings-row"><label>Backend</label><span class="val">Ollama (localhost:11434)</span></div>
    <div class="settings-row"><label>Pipeline</label><span class="val" id="sp-status">Checking...</span></div>
    <div class="settings-row"><label>Privacy</label><span class="val green">100% Local · No data leaves device</span></div>
    <div class="settings-row"><label>Sessions</label><span class="val">${sessions.length} stored</span></div>
    <button class="modal-close" id="cs">Close</button></div>`;
  document.body.appendChild(o);
  o.addEventListener('click', e => { if (e.target === o) o.remove(); });
  document.getElementById('cs').addEventListener('click', () => o.remove());
  fetch(HEALTH_API).then(r => r.json()).then(d => {
    const el = document.getElementById('sp-status');
    el.textContent = d.status === 'ok' ? 'Connected' : d.ollama;
    el.className = 'val' + (d.status === 'ok' ? ' green' : '');
    if (d.status !== 'ok') el.style.color = '#F59E0B';
  }).catch(() => { const el = document.getElementById('sp-status'); if (el) { el.textContent = 'Offline'; el.style.color = '#EF4444'; } });
}

// ==============================
// SIDEBAR: TIMELINE MODAL
// ==============================
async function showTimelineModal() {
  const o = document.createElement('div'); o.className = 'modal-overlay';
  o.innerHTML = `<div class="modal-box"><h2>Mood Timeline</h2><div id="timeline-content"><p>Loading...</p></div><button class="modal-close" id="ct">Close</button></div>`;
  document.body.appendChild(o);
  o.addEventListener('click', e => { if (e.target === o) o.remove(); });
  document.getElementById('ct').addEventListener('click', () => o.remove());

  try {
    const resp = await fetch(TIMELINE_API);
    const data = await resp.json();
    const container = document.getElementById('timeline-content');

    if (!data.length) {
      container.innerHTML = '<p style="color:#71717A">No sessions with screening data yet. Start a conversation and the PHQ-9/GAD-7 screening will begin automatically after a couple messages.</p>';
      return;
    }

    let html = '';

    // Chart area — severity scores over time
    const scored = data.filter(s => s.phq9_score !== null || s.gad7_score !== null);
    if (scored.length > 1) {
      const maxScore = Math.max(...scored.map(s => s.phq9_score || s.gad7_score || 0));
      const chartH = 100;
      const barW = Math.min(40, Math.floor(300 / scored.length));
      html += `<div style="display:flex;align-items:flex-end;gap:4px;height:${chartH + 30}px;margin-bottom:20px;padding:10px;background:rgba(255,255,255,0.02);border-radius:10px;border:1px solid rgba(255,255,255,0.05)">`;
      scored.reverse().forEach(s => {
        const score = s.phq9_score || s.gad7_score || 0;
        const h = maxScore > 0 ? Math.round((score / 27) * chartH) : 0;
        const col = score <= 4 ? '#22C55E' : score <= 9 ? '#F59E0B' : score <= 14 ? '#EF4444' : '#DC2626';
        const dt = new Date(s.created_at).toLocaleDateString('en-US', {month:'short',day:'numeric'});
        html += `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:10px;color:#A1A1AA">${score}</span>
          <div style="width:${barW}px;height:${h}px;background:${col};border-radius:4px 4px 0 0;min-height:4px"></div>
          <span style="font-size:9px;color:#71717A">${dt}</span>
        </div>`;
      });
      html += `</div>`;
    }

    // Session cards
    data.forEach(s => {
      const dt = new Date(s.created_at).toLocaleDateString('en-US', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
      const score = s.phq9_score !== null ? s.phq9_score : s.gad7_score;
      const instrument = s.phq9_score !== null ? 'PHQ-9' : (s.gad7_score !== null ? 'GAD-7' : null);
      const sev = s.severity || '';

      html += `<div class="timeline-card">
        <div class="date">${dt}</div>
        <div class="name">${escapeHtml(s.name)}</div>`;

      if (score !== null && instrument) {
        html += `<div class="score-row">
          <span class="score-badge">${score}</span>
          <span style="font-size:12px;color:#A1A1AA">${instrument}</span>
          <span class="severity-label severity-${sev}">${sev.replace('_',' ')}</span>
        </div>`;
      }

      if (s.top_emotions && s.top_emotions.length) {
        html += `<div class="timeline-emotions">`;
        s.top_emotions.forEach(e => { html += `<span class="emotion-tag">${e}</span>`; });
        html += `</div>`;
      }

      html += `<div style="font-size:11px;color:#71717A;margin-top:6px">${s.message_count} messages</div>`;
      html += `</div>`;
    });

    container.innerHTML = html;
  } catch {
    document.getElementById('timeline-content').innerHTML = '<p style="color:#EF4444">Failed to load timeline. Is the API running?</p>';
  }
}

// ==============================
// SIDEBAR: SAFETY MODAL
// ==============================
function showSafetyModal() {
  const o = document.createElement('div'); o.className = 'modal-overlay';
  o.innerHTML = `<div class="modal-box"><h2>Safety Information</h2>
    <p>MindSLM is a support tool, <strong>not a replacement for professional help</strong>. If you or someone you know is in crisis:</p>
    <div class="resource"><strong>988 Suicide & Crisis Lifeline (US)</strong><br><span>Call or Text: 988</span></div>
    <div class="resource"><strong>Crisis Text Line</strong><br><span>Text HOME to 741741</span></div>
    <div class="resource"><strong>iCall (India)</strong><br><span>9152987821</span></div>
    <div class="resource"><strong>Vandrevala Foundation (India)</strong><br><span>1860-2662-345 (24/7)</span></div>
    <p style="margin-top:16px;font-size:12px;color:#71717A">MindSLM runs 100% locally. No data is sent to any server.</p>
    <button class="modal-close" id="csf">Close</button></div>`;
  document.body.appendChild(o);
  o.addEventListener('click', e => { if (e.target === o) o.remove(); });
  document.getElementById('csf').addEventListener('click', () => o.remove());
}

// ==============================
// SIDEBAR: CLEAR SESSION
// ==============================
function clearCurrentSession() {
  if (!activeSessionId) { showToast('No active session'); return; }
  const o = document.createElement('div'); o.className = 'modal-overlay';
  o.innerHTML = `<div class="modal-box"><h2>Clear Session</h2>
    <p>Permanently delete this session's messages? This cannot be undone.</p>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="modal-close" id="cc" style="flex:1">Cancel</button>
      <button class="modal-close" id="cd" style="flex:1;background:rgba(239,68,68,0.15);border-color:rgba(239,68,68,0.3);color:#EF4444">Delete</button>
    </div></div>`;
  document.body.appendChild(o);
  o.addEventListener('click', e => { if (e.target === o) o.remove(); });
  document.getElementById('cc').addEventListener('click', () => o.remove());
  document.getElementById('cd').addEventListener('click', () => {
    // Delete from API too
    fetch(`${API_BASE}/api/sessions/${activeSessionId}`, { method: 'DELETE' }).catch(() => {});
    sessions = sessions.filter(s => s.id !== activeSessionId);
    saveSessions();
    activeSessionId = sessions.length ? sessions[0].id : null;
    activeSessionId ? setActiveSession(activeSessionId) : resetToHero();
    renderSessionList(); o.remove(); showToast('Session cleared');
  });
}

// ==============================
// SIDEBAR ACTIONS
// ==============================
document.querySelectorAll('.action-item').forEach(item => {
  const label = item.querySelector('span')?.textContent?.trim();
  item.style.cursor = 'pointer';
  item.addEventListener('click', () => {
    if (label === 'Settings') showSettingsModal();
    else if (label === 'Safety Info') showSafetyModal();
    else if (label === 'Clear Session') clearCurrentSession();
    else if (label === 'Mood Timeline') showTimelineModal();
  });
});

// ==============================
// THEME TOGGLE
// ==============================
let isDark = true;
const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    isDark = !isDark;
    const r = document.documentElement.style;
    if (isDark) {
      r.setProperty('--bg-main', '#060606'); r.setProperty('--bg-sidebar', '#030303');
      r.setProperty('--bg-card', '#0A0A0B'); r.setProperty('--bg-input', '#0F0F11');
      r.setProperty('--text-primary', '#FFFFFF'); r.setProperty('--text-secondary', '#8E8E93');
      r.setProperty('--border-color', 'rgba(255,255,255,0.08)');
      showToast('Dark theme');
    } else {
      r.setProperty('--bg-main', '#F5F5F7'); r.setProperty('--bg-sidebar', '#EAEAEC');
      r.setProperty('--bg-card', '#FFFFFF'); r.setProperty('--bg-input', '#FFFFFF');
      r.setProperty('--text-primary', '#1A1A1A'); r.setProperty('--text-secondary', '#666666');
      r.setProperty('--border-color', 'rgba(0,0,0,0.1)');
      showToast('Light theme');
    }
  });
}

// ==============================
// SUPPORT CARDS + CHIPS
// ==============================
document.querySelectorAll('.support-card').forEach(card => {
  card.addEventListener('mousemove', e => {
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
    card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
  });
  card.addEventListener('click', () => {
    const title = card.querySelector('h3').textContent;
    const desc = card.querySelector('p').textContent;
    sendMessage(`${title} - ${desc}`);
  });
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    sendMessage(`I'm dealing with ${chip.textContent.toLowerCase()}`);
  });
});

// ==============================
// INPUT
// ==============================
sendBtn.addEventListener('click', () => sendMessage(input.value));
input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(input.value); });

// ==============================
// HEALTH CHECK
// ==============================
(async function() {
  try {
    const data = await (await fetch(HEALTH_API)).json();
    const sub = document.querySelector('.brand-subtitle');
    if (data.status === 'ok') { sub.textContent = 'Pipeline active · GoEmotions · PHQ-9/GAD-7 · Local'; sub.style.color = '#22C55E'; }
    else { sub.textContent = 'Pipeline degraded — check Ollama'; sub.style.color = '#F59E0B'; }
  } catch {
    const sub = document.querySelector('.brand-subtitle');
    sub.textContent = 'Pipeline offline — start mindslm_pipeline_api.py';
    sub.style.color = '#EF4444';
  }
})();

// ==============================
// INIT
// ==============================
renderSessionList();
if (sessions.length > 0) { activeSessionId = sessions[0].id; renderSessionList(); }

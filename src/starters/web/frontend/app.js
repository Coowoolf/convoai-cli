// ConvoAI Starter — Frontend Logic
// Customize: modify the UI, add features, change interaction flow.

const SERVER = window.location.origin;

let client = null;
let localTrack = null;
let currentSession = null;
let historyTimer = null;
let lastHistoryCount = 0;

// ─── UI Helpers ────────────────────────────────────────────────────────────

function setStatus(text, state) {
  const el = document.getElementById('status');
  el.textContent = text;
  el.className = 'status ' + state;
}

function addMessage(role, content) {
  const conv = document.getElementById('conversation');
  const empty = conv.querySelector('.empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = 'message ' + role;
  div.innerHTML = '<div class="role">' + role + '</div><div>' + escapeHtml(content) + '</div>';
  conv.appendChild(div);
  conv.scrollTop = conv.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function setButton(text, className, disabled) {
  const btn = document.getElementById('btn-start');
  btn.textContent = text;
  btn.className = 'btn ' + className;
  btn.disabled = disabled;
}

function setVolume(active) {
  const el = document.getElementById('volume-indicator');
  el.className = 'volume-indicator' + (active ? ' active' : '');
}

// ─── Session Management ────────────────────────────────────────────────────

async function toggleConversation() {
  if (currentSession) {
    await stopConversation();
  } else {
    await startConversation();
  }
}

async function startConversation() {
  setButton('Connecting...', 'btn-primary', true);
  setStatus('Connecting...', 'connecting');

  try {
    const res = await fetch(SERVER + '/session/start', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start session');
    }
    currentSession = await res.json();

    client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        user.audioTrack.play();
        setVolume(true);
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio') setVolume(false);
    });

    client.on('user-left', () => { setVolume(false); });

    await client.join(
      currentSession.appId,
      currentSession.channel,
      currentSession.token,
      currentSession.uid,
    );

    localTrack = await AgoraRTC.createMicrophoneAudioTrack({
      AEC: true, ANS: true, AGC: true,
    });
    await client.publish([localTrack]);

    setStatus('Connected', 'connected');
    setButton('End Conversation', 'btn-danger', false);
    startHistoryPolling();
  } catch (err) {
    console.error('Start failed:', err);
    setStatus('Error: ' + err.message, 'disconnected');
    setButton('Start Conversation', 'btn-primary', false);
    currentSession = null;
  }
}

async function stopConversation() {
  setButton('Stopping...', 'btn-danger', true);
  stopHistoryPolling();

  try {
    if (localTrack) { localTrack.stop(); localTrack.close(); localTrack = null; }
    if (client) { await client.leave(); client = null; }
    await fetch(SERVER + '/session/stop', { method: 'POST' });
  } catch (err) {
    console.error('Stop error:', err);
  }

  currentSession = null;
  setStatus('Disconnected', 'disconnected');
  setButton('Start Conversation', 'btn-primary', false);
  setVolume(false);
}

// ─── History Polling ───────────────────────────────────────────────────────

function startHistoryPolling() {
  lastHistoryCount = 0;
  historyTimer = setInterval(async () => {
    if (!currentSession) return;
    try {
      const res = await fetch(SERVER + '/history?agentId=' + currentSession.agentId);
      if (!res.ok) return;
      const data = await res.json();
      const entries = data.history || [];
      for (let i = lastHistoryCount; i < entries.length; i++) {
        const entry = entries[i];
        addMessage(entry.role === 'assistant' ? 'agent' : 'user', entry.content);
      }
      lastHistoryCount = entries.length;
    } catch {}
  }, 2000);
}

function stopHistoryPolling() {
  if (historyTimer) { clearInterval(historyTimer); historyTimer = null; }
}

// ConvoAI Starter — Frontend Logic
// Customize: modify the UI, add features, change interaction flow.

const SERVER = window.location.origin;

let client = null;
let localTrack = null;
let currentSession = null;
let isMuted = false;
let analyserNode = null;
let freqAnimFrame = null;
let historyTimer = null;
let lastHistoryCount = 0;

// Subtitle state — track partial (ephemeral) and final messages
let subtitleEntries = [];  // { role, text, final, id }
let ephemeral = null;      // current partial message

const $ = (id) => document.getElementById(id);

// ─── Agent Status ──────────────────────────────────────────────────────────

function setAgentStatus(text, state) {
  const el = $('agent-status');
  el.textContent = text;
  el.className = 'agent-status' + (state ? ' ' + state : '');
}

function setAgentRing(state) {
  $('agent-ring').className = 'agent-ring' + (state ? ' ' + state : '');
}

// ─── Subtitles ─────────────────────────────────────────────────────────────

// Incremental rendering — only update what changed, no full rebuild
let renderedCount = 0;
let ephemeralEl = null;

function renderSubtitles() {
  const container = $('subtitles');

  // Append new final entries only
  while (renderedCount < subtitleEntries.length) {
    const entry = subtitleEntries[renderedCount];
    // Remove ephemeral before adding final
    if (ephemeralEl) { ephemeralEl.remove(); ephemeralEl = null; }
    container.appendChild(createSubLine(entry.role, entry.text, true));
    renderedCount++;
  }

  // Update or create ephemeral element
  if (ephemeral) {
    if (!ephemeralEl) {
      ephemeralEl = createSubLine(ephemeral.role, ephemeral.text, false);
      container.appendChild(ephemeralEl);
    } else {
      // Just update text, don't recreate
      ephemeralEl.querySelector('.sub-body').textContent = ephemeral.text;
    }
  } else if (ephemeralEl) {
    ephemeralEl.remove();
    ephemeralEl = null;
  }

  container.scrollTop = container.scrollHeight;
}

function createSubLine(role, text, isFinal) {
  const div = document.createElement('div');
  div.className = 'sub-line ' + (role === 'user' ? 'user' : 'agent') + (isFinal ? '' : ' partial');

  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = role === 'user' ? 'You' : 'AI';

  const body = document.createElement('div');
  body.className = 'sub-body';
  body.textContent = text;

  div.appendChild(label);
  div.appendChild(body);
  return div;
}

function handleTranscript(msg) {
  const obj = msg.object;
  const text = msg.text || '';

  console.log('[subtitle]', JSON.stringify(msg));

  if (obj === 'user.transcription') {
    if (msg.final) {
      subtitleEntries.push({ role: 'user', text });
      ephemeral = null;
    } else {
      ephemeral = { role: 'user', text };
    }
  } else if (obj === 'assistant.transcription') {
    const status = msg.turn_status;
    // turn_status: 0=IN_PROGRESS, 1=END, 2=INTERRUPTED
    // If turn_status is missing, use final field as fallback
    if (status === 1 || (status === undefined && msg.final === true)) {
      subtitleEntries.push({ role: 'assistant', text });
      ephemeral = null;
    } else if (status === 2) {
      subtitleEntries.push({ role: 'assistant', text: text + ' [interrupted]' });
      ephemeral = null;
    } else {
      // In progress (status === 0, undefined, or any other value)
      ephemeral = { role: 'assistant', text };
    }
  } else if (obj && text) {
    // Unknown message type — show it anyway
    const role = obj.includes('user') ? 'user' : 'assistant';
    subtitleEntries.push({ role, text });
  }

  renderSubtitles();
}

// ─── Buttons ───────────────────────────────────────────────────────────────

function setMainBtn(text, danger, disabled) {
  const btn = $('btn-start');
  btn.textContent = text;
  btn.className = 'btn-main' + (danger ? ' danger' : '');
  btn.disabled = disabled;
}

function updateMicIcon() {
  $('mic-icon').style.display = isMuted ? 'none' : 'block';
  $('mic-off-icon').style.display = isMuted ? 'block' : 'none';
  $('btn-mic').className = 'btn-circle' + (isMuted ? ' muted' : '');
}

function showInterrupt(show) {
  $('btn-interrupt').style.visibility = show ? 'visible' : 'hidden';
}

// ─── Frequency Bars ────────────────────────────────────────────────────────

function startFreqBars() {
  $('freq-bars').classList.add('active');
  if (!localTrack || !localTrack._mediaStreamTrack) return;

  try {
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(new MediaStream([localTrack._mediaStreamTrack]));
    analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 64;
    src.connect(analyserNode);
    const data = new Uint8Array(analyserNode.frequencyBinCount);
    const spans = $('freq-bars').querySelectorAll('span');

    (function draw() {
      analyserNode.getByteFrequencyData(data);
      [data[1], data[3], data[6], data[9], data[13]].forEach((v, i) => {
        spans[i].style.height = Math.max(4, (v / 255) * 28) + 'px';
      });
      freqAnimFrame = requestAnimationFrame(draw);
    })();
  } catch {
    const spans = $('freq-bars').querySelectorAll('span');
    (function rand() {
      spans.forEach(s => { s.style.height = (4 + Math.random() * 18) + 'px'; });
      freqAnimFrame = requestAnimationFrame(rand);
    })();
  }
}

function stopFreqBars() {
  $('freq-bars').classList.remove('active');
  if (freqAnimFrame) { cancelAnimationFrame(freqAnimFrame); freqAnimFrame = null; }
  analyserNode = null;
}

// ─── Mic / Interrupt ───────────────────────────────────────────────────────

function toggleMic() {
  if (!localTrack) return;
  isMuted = !isMuted;
  localTrack.setMuted(isMuted);
  updateMicIcon();
  if (isMuted) { stopFreqBars(); setAgentStatus('Muted', ''); }
  else { startFreqBars(); setAgentStatus('Listening', 'active'); }
}

async function interruptAgent() {
  if (!currentSession) return;
  try {
    await fetch(SERVER + '/session/interrupt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: currentSession.agentId }),
    });
  } catch {}
}

// ─── Session ───────────────────────────────────────────────────────────────

async function toggleConversation() {
  if (currentSession) await stopConversation();
  else await startConversation();
}

async function startConversation() {
  setMainBtn('Connecting...', false, true);
  setAgentStatus('Connecting...', '');
  subtitleEntries = [];
  ephemeral = null;
  renderedCount = 0;
  if (ephemeralEl) { ephemeralEl.remove(); ephemeralEl = null; }
  $('subtitles').innerHTML = '';

  try {
    const res = await fetch(SERVER + '/session/start', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start');
    }
    currentSession = await res.json();

    client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

    // Agent audio
    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'audio') {
        user.audioTrack.play();
        setAgentRing('speaking');
        setAgentStatus('Agent speaking', 'active');
        showInterrupt(true);
      }
    });

    client.on('user-unpublished', (user, mediaType) => {
      if (mediaType === 'audio') {
        setAgentRing('listening');
        setAgentStatus('Listening', 'active');
        showInterrupt(false);
      }
    });

    client.on('user-left', () => {
      setAgentRing('');
      showInterrupt(false);
    });

    await client.join(currentSession.appId, currentSession.channel, currentSession.token, currentSession.uid);

    // ─── Real-time subtitles via DataStream ────────────────────────────
    // User transcription comes through DataStream; agent transcription
    // falls back to history API polling (DataStream doesn't carry it).
    client.on('stream-message', (_uid, data) => {
      try {
        let text = data instanceof Uint8Array
          ? new TextDecoder().decode(data) : String(data);

        // Direct JSON (v2)
        try {
          const msg = JSON.parse(text);
          if (msg.object) { handleTranscript(msg); return; }
        } catch {}

        // Chunked: message_id|part_idx|part_sum|base64
        if (text.includes('|')) {
          const parts = text.split('|');
          if (parts.length >= 4 && parseInt(parts[2], 10) === 1) {
            try {
              const msg = JSON.parse(atob(parts.slice(3).join('|')));
              if (msg.object) handleTranscript(msg);
            } catch {}
          }
        }
      } catch {}
    });

    localTrack = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
    await client.publish([localTrack]);

    isMuted = false;
    updateMicIcon();
    $('btn-mic').disabled = false;
    setMainBtn('End', true, false);
    setAgentStatus('Listening', 'active');
    setAgentRing('listening');
    startFreqBars();
    startHistoryFallback();

  } catch (err) {
    console.error('Start failed:', err);
    setAgentStatus(err.message, 'error');
    setMainBtn('Start', false, false);
    setAgentRing('');
    currentSession = null;
  }
}

async function stopConversation() {
  setMainBtn('Stopping...', true, true);
  stopFreqBars();
  stopHistoryFallback();
  showInterrupt(false);

  try {
    if (localTrack) { localTrack.stop(); localTrack.close(); localTrack = null; }
    if (client) { await client.leave(); client = null; }
    await fetch(SERVER + '/session/stop', { method: 'POST' });
  } catch (err) { console.error('Stop:', err); }

  currentSession = null;
  isMuted = false;
  updateMicIcon();
  $('btn-mic').disabled = true;
  setMainBtn('Start', false, false);
  setAgentStatus('Ready to talk', '');
  setAgentRing('');
}

// ─── History Polling Fallback ──────────────────────────────────────────────
// Agent transcription doesn't come through DataStream, so poll history API.

function startHistoryFallback() {
  lastHistoryCount = 0;
  historyTimer = setInterval(async () => {
    if (!currentSession) return;
    try {
      const res = await fetch(SERVER + '/history?agentId=' + currentSession.agentId);
      if (!res.ok) return;
      const data = await res.json();
      const entries = data.history || data.chat_history || data.messages || [];

      for (let i = lastHistoryCount; i < entries.length; i++) {
        const entry = entries[i];
        const role = (entry.role === 'assistant' || entry.role === 'agent') ? 'assistant' : 'user';
        const text = entry.content || entry.text || '';
        if (!text) continue;
        // Only add agent messages from history (user comes via DataStream)
        if (role === 'assistant') {
          const isDup = subtitleEntries.some(s => s.text === text && s.role === role);
          if (!isDup) { subtitleEntries.push({ role, text }); renderSubtitles(); }
        }
      }
      lastHistoryCount = entries.length;
    } catch {}
  }, 2000);
}

function stopHistoryFallback() {
  if (historyTimer) { clearInterval(historyTimer); historyTimer = null; }
}


// ---- tabs ----
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`).classList.add('active');
  });
});

// ---- overlay settings ----
const overlayLink = document.getElementById('overlay-link');
const previewFrame = document.getElementById('preview-frame');
const previewFrames = [previewFrame];
const btnCopyLink = document.getElementById('btn-copy-link');

const optTheme = document.getElementById('opt-theme');
const optMax = document.getElementById('opt-max');
const optLifetime = document.getElementById('opt-lifetime');
const optTts = document.getElementById('opt-tts');
const optVoice = document.getElementById('opt-voice');
const optRate = document.getElementById('opt-rate');
const optNgWords = document.getElementById('opt-ngwords');
const optNgUsers = document.getElementById('opt-ngusers');
const saveNote = document.getElementById('save-note');
const saveNoteFilters = document.getElementById('save-note-filters');

const BUBBLE_DEFAULTS = { bgColor: '#0a0a0e', bgOpacity: 0.72, textColor: '#ffffff', fontSize: 20 };

let currentBubble = { ...BUBBLE_DEFAULTS };

function currentBubbleSettings() {
  return currentBubble;
}

const fileImportInput = document.getElementById('file-import');
const filterTextareas = { ngwords: optNgWords, ngusers: optNgUsers };
let importTarget = '';

document.querySelectorAll('.btn-import').forEach(btn => {
  btn.addEventListener('click', () => {
    importTarget = btn.dataset.target;
    fileImportInput.click();
  });
});

fileImportInput.addEventListener('change', () => {
  const file = fileImportInput.files[0];
  const textarea = filterTextareas[importTarget];
  if (!file || !textarea) return;
  const reader = new FileReader();
  reader.onload = () => {
    const existing = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
    const imported = String(reader.result).split('\n').map(s => s.trim()).filter(Boolean);
    const merged = Array.from(new Set([...existing, ...imported]));
    textarea.value = merged.join('\n');
  };
  reader.readAsText(file);
  fileImportInput.value = '';
});

document.querySelectorAll('.btn-export').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    const textarea = filterTextareas[target];
    if (!textarea) return;
    const blob = new Blob([textarea.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${target}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
});

// Voice list comes from this browser's speechSynthesis — includes any
// offline OS voices plus online "Natural" voices Edge/Chrome expose.
let pendingVoiceName = '';
function populateVoices() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;
  const current = optVoice.value || pendingVoiceName;
  optVoice.innerHTML = '<option value="">Browser default (auto-match language)</option>';
  voices.forEach((v) => {
    const option = document.createElement('option');
    option.value = v.name;
    option.textContent = `${v.name} (${v.lang})`;
    optVoice.appendChild(option);
  });
  if (current) optVoice.value = current;
}
if ('speechSynthesis' in window) {
  populateVoices();
  window.speechSynthesis.onvoiceschanged = populateVoices;
}

function currentOverlaySettings() {
  return {
    theme: optTheme.value,
    max: parseInt(optMax.value, 10) || 20,
    lifetime: parseInt(optLifetime.value, 10) || 0,
    tts: optTts.checked,
    voiceName: optVoice.value,
    voiceRate: parseFloat(optRate.value) || 1,
    bubble: currentBubbleSettings(),
  };
}

function pushPreview() {
  previewFrames.forEach((frame) => {
    const frameWin = frame.contentWindow;
    if (frameWin && typeof frameWin.applyPreviewConfig === 'function') {
      frameWin.applyPreviewConfig(currentOverlaySettings());
    }
  });
}

function rebuildOverlayLink() {
  // Saved settings are the source of truth for the plain link; query params
  // are only for per-browser-source overrides, so the base link stays clean.
  // If this page itself was opened as a local file (e.g. double-clicked rather
  // than served), location.origin isn't a usable http(s) origin — fall back to
  // the server's default address so the link OBS needs is always valid.
  const origin = /^https?:$/.test(location.protocol) ? location.origin : 'http://localhost:4848';
  const url = origin + '/overlay.html';
  overlayLink.href = url;
  overlayLink.textContent = url;
}
rebuildOverlayLink();

btnCopyLink.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(overlayLink.href);
  } catch {
    // clipboard API unavailable (e.g. insecure context) — fall back to selecting the link text
    const range = document.createRange();
    range.selectNode(overlayLink);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  }
  const copyLabel = btnCopyLink.querySelector('.btn-label');
  const copyIcon = btnCopyLink.querySelector('.icon');
  copyLabel.textContent = 'Copied!';
  copyIcon.setAttribute('icon', 'mdi:check');
  btnCopyLink.classList.add('copied');
  setTimeout(() => {
    copyLabel.textContent = 'Copy';
    copyIcon.setAttribute('icon', 'mdi:content-copy');
    btnCopyLink.classList.remove('copied');
  }, 1500);
});

// ---- test voice (speaks right here in the control panel, using unsaved values) ----
const btnTestVoice = document.getElementById('btn-test-voice');
btnTestVoice.addEventListener('click', () => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const cfg = currentOverlaySettings();
  const utter = new SpeechSynthesisUtterance('This is a test of the chat overlay voice and speed.');
  utter.rate = cfg.voiceRate;
  if (cfg.voiceName) {
    const match = window.speechSynthesis.getVoices().find((v) => v.name === cfg.voiceName);
    if (match) utter.voice = match;
  }
  btnTestVoice.classList.add('playing');
  utter.onend = utter.onerror = () => btnTestVoice.classList.remove('playing');
  window.speechSynthesis.speak(utter);
});

// ---- preview sample messages (pushes fake messages into the preview iframe's overlay) ----
const SAMPLE_MESSAGES = [
  { platform: 'twitch', author: 'StreamFan22', message: 'This overlay looks great! 🎉', color: '#ff9ac1' },
  { platform: 'youtube', author: '李明', message: '你好,主播!加油!', color: '#5bc9ff' },
  { platform: 'youtube', author: 'BigDonor', message: 'Keep up the great content!', color: '#8fffb0', isPaid: true },
  { platform: 'twitch', author: 'night_owl', message: 'lol that was close', color: '#c6a6ff' },
  { platform: 'douyin', author: '小美', message: '主播声音好好听', color: '#5fe8e2' },
];
let sampleIndex = 0;
function pushSampleMessage() {
  previewFrames.forEach((frame) => {
    const frameWin = frame.contentWindow;
    if (!frameWin || typeof frameWin.previewMessage !== 'function') return;
    const msg = SAMPLE_MESSAGES[sampleIndex % SAMPLE_MESSAGES.length];
    frameWin.previewMessage({ ...msg, id: 'preview-' + Date.now() });
  });
  sampleIndex++;
}

// Auto-loop: continuously feeds sample messages into the preview so the OBS
// overlay preview always shows something moving, without needing clicks.
let previewLoopTimer = null;
function startPreviewLoop() {
  if (previewLoopTimer) clearInterval(previewLoopTimer);
  sampleIndex = 0;
  pushSampleMessage();
  previewLoopTimer = setInterval(pushSampleMessage, 2800);
}

previewFrames.forEach((frame) => {
  frame.addEventListener('load', () => {
    // Push the panel's current unsaved overlay settings into the preview so
    // it reflects what's on screen right now, not just the last saved config.
    const frameWin = frame.contentWindow;
    if (frameWin && typeof frameWin.applyPreviewConfig === 'function') {
      frameWin.applyPreviewConfig(currentOverlaySettings());
    }
    startPreviewLoop();
  });
});

[optTheme, optMax, optLifetime, optTts, optVoice, optRate].forEach((el) => {
  el.addEventListener('input', pushPreview);
  el.addEventListener('change', pushPreview);
});

async function loadSettings() {
  const res = await fetch('/api/settings');
  const data = await res.json();
  optNgWords.value = (data.ngWords || []).join('\n');
  optNgUsers.value = (data.ngUsers || []).join('\n');
  const o = data.overlay || {};
  optTheme.value = o.theme || 'bubble';
  optMax.value = o.max != null ? o.max : 20;
  optLifetime.value = o.lifetime != null ? o.lifetime : 0;
  optTts.checked = !!o.tts;
  pendingVoiceName = o.voiceName || '';
  if (pendingVoiceName) optVoice.value = pendingVoiceName;
  optRate.value = o.voiceRate != null ? o.voiceRate : 1;
  const b = o.bubble || {};
  currentBubble = {
    bgColor: b.bgColor || BUBBLE_DEFAULTS.bgColor,
    bgOpacity: b.bgOpacity != null ? b.bgOpacity : BUBBLE_DEFAULTS.bgOpacity,
    textColor: b.textColor || BUBBLE_DEFAULTS.textColor,
    fontSize: b.fontSize || BUBBLE_DEFAULTS.fontSize,
  };
  pushPreview();
}
loadSettings();

async function saveSettings(note) {
  const ngWords = optNgWords.value.split('\n').map(s => s.trim()).filter(Boolean);
  const ngUsers = optNgUsers.value.split('\n').map(s => s.trim()).filter(Boolean);
  await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ngWords, ngUsers, overlay: currentOverlaySettings() })
  });
  note.textContent = 'Saved.';
  setTimeout(() => { note.textContent = ''; }, 2000);
  previewFrames.forEach((frame) => { frame.src = frame.src; }); // reload previews to reflect saved settings
}

document.querySelectorAll('.btn-save').forEach(btn => {
  btn.addEventListener('click', () => saveSettings(btn.closest('.tab-panel').querySelector('.save-note')));
});

// ---- platform cards ----
const cards = document.querySelectorAll('.platform-card');
cards.forEach(card => {
  const platform = card.dataset.platform;
  const urlInput = card.querySelector('[data-url]');
  const connectBtn = card.querySelector('.btn-connect');
  const stopBtn = card.querySelector('.btn-stop');
  const statusText = card.querySelector('.status-text');
  const dot = card.querySelector('.dot');

  connectBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) return;
    statusText.textContent = 'Connecting...';
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, url })
    });
    const data = await res.json();
    if (data.error) statusText.textContent = 'Error: ' + data.error;
  });

  stopBtn.addEventListener('click', async () => {
    await fetch('/api/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform })
    });
    dot.className = 'dot';
    statusText.textContent = 'Not connected';
    card.classList.remove('is-connected');
    const badge = card.querySelector('.count-badge');
    if (badge) badge.textContent = '0 msgs';
    syncStatusPill(platform, '');
  });
});

function syncStatusPill(platform, status) {
  const pill = document.querySelector(`.status-pill[data-platform="${platform}"]`);
  if (!pill) return;
  const dot = pill.querySelector('.dot');
  dot.className = 'dot ' + status;
  pill.classList.toggle('is-connected', status === 'connected');
}

function updateStatus(platform, status, text) {
  const card = document.querySelector(`.platform-card[data-platform="${platform}"]`);
  syncStatusPill(platform, status === 'stopped' ? '' : status);
  if (!card) return;
  const dot = card.querySelector('.dot');
  const statusText = card.querySelector('.status-text');
  dot.className = 'dot ' + status;
  statusText.textContent = text;
  card.classList.toggle('is-connected', status === 'connected');
  if (status === 'stopped') {
    const badge = card.querySelector('.count-badge');
    if (badge) badge.textContent = '0 msgs';
  }
}

function updateCount(platform, count) {
  const card = document.querySelector(`.platform-card[data-platform="${platform}"]`);
  if (!card) return;
  const badge = card.querySelector('.count-badge');
  if (badge) badge.textContent = count + (count === 1 ? ' msg' : ' msgs');
}

// ---- chat log ----
const PLATFORM_ICONS = {
  youtube: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2c-.3-1.1-1.1-1.9-2.2-2.2C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.3.5c-1.1.3-1.9 1.1-2.2 2.2C0 8.1 0 12 0 12s0 3.9.5 5.8c.3 1.1 1.1 1.9 2.2 2.2 1.9.5 9.3.5 9.3.5s7.4 0 9.3-.5c1.1-.3 1.9-1.1 2.2-2.2.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>',
  twitch: '<svg viewBox="0 0 24 24"><path d="M4.3 2 2 7.1v13.1h4.6V23l3.4-2.8h3.7L21 13.4V2H4.3zm14.3 10.3-3.4 3.4h-3.4l-2.9 2.9v-2.9H5.7V3.7h12.9v8.6z"/><path d="M15.7 6.9h1.7v5.1h-1.7zM11.1 6.9h1.7v5.1h-1.7z"/></svg>',
  douyin: '<svg viewBox="0 0 24 24"><path d="M16.6 5.8a4.6 4.6 0 0 1-3.8-4.6h-3.4v15.2a2.8 2.8 0 1 1-2-2.7V10.6a6.1 6.1 0 1 0 5.4 6.1V9.5a7.9 7.9 0 0 0 4.6 1.5V7.6a4.6 4.6 0 0 1-.8-1.8z"/></svg>',
};
const chatLog = document.getElementById('chat-log');
function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg' + (msg.isPaid ? ' is-paid' : '');
  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const platSpan = document.createElement('span');
  platSpan.className = 'plat ' + msg.platform;
  platSpan.title = msg.platform;
  platSpan.innerHTML = PLATFORM_ICONS[msg.platform] || '';
  const authorSpan = document.createElement('span');
  authorSpan.className = 'author';
  authorSpan.style.color = msg.color || '#ffffff';
  authorSpan.textContent = msg.author + ':';
  const textSpan = document.createElement('span');
  textSpan.className = 'text-body';
  textSpan.textContent = ' ' + msg.message;
  div.appendChild(timeSpan);
  div.appendChild(platSpan);
  div.appendChild(authorSpan);
  div.appendChild(textSpan);
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
  while (chatLog.children.length > 300) chatLog.removeChild(chatLog.firstChild);
}

document.getElementById('btn-clear-log').addEventListener('click', () => {
  chatLog.innerHTML = '';
});

function connectWs() {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === 'chat') {
      appendMessage(data.message);
      updateCount(data.message.platform, data.count);
    } else if (data.type === 'status') {
      updateStatus(data.platform, data.status, data.text);
    }
  };
  ws.onclose = () => setTimeout(connectWs, 2000);
}
connectWs();

// ---- overlay settings ----
const overlayLink = document.getElementById('overlay-link');
const previewFrame = document.getElementById('preview-frame');
const liveFrame = document.getElementById('live-overlay-frame');
const btnCopyLink = document.getElementById('btn-copy-link');

const themeGallery = document.getElementById('theme-gallery');
const btnImportTemplate = document.getElementById('btn-import-template');
const templateFileInput = document.getElementById('template-file-input');
const optMax = document.getElementById('opt-max');
const optLifetime = document.getElementById('opt-lifetime');
const optTts = document.getElementById('opt-tts');
const optVoice = document.getElementById('opt-voice');
const optRate = document.getElementById('opt-rate');
const optNgWords = document.getElementById('opt-ngwords');
const optNgUsers = document.getElementById('opt-ngusers');
const saveNote = document.getElementById('save-note');
const saveNoteDesign = document.getElementById('save-note-design');
const saveNoteFilters = document.getElementById('save-note-filters');

let currentTemplateId = 'pill';
let availableTemplates = [];

function templatePath(id) {
  return `/templates/${id}/index.html`;
}

function renderGallery() {
  themeGallery.innerHTML = '';
  availableTemplates.forEach((tpl) => {
    const card = document.createElement('div');
    card.className = 'theme-card';

    const btn = document.createElement('button');
    btn.className = 'theme-card-btn' + (tpl.id === currentTemplateId ? ' active' : '');
    btn.dataset.templateId = tpl.id;
    btn.innerHTML = `
      <iconify-icon class="theme-card-icon" icon="${tpl.icon || 'mdi:monitor-screenshot'}"></iconify-icon>
      <span class="theme-card-name">${tpl.name}</span>
    `;
    btn.addEventListener('click', () => {
      currentTemplateId = tpl.id;
      renderGallery();
      loadPreviewFrame();
      pushPreview();
    });
    card.appendChild(btn);

    if (tpl.id !== currentTemplateId) {
      const del = document.createElement('button');
      del.className = 'theme-card-delete';
      del.innerHTML = '<iconify-icon icon="mdi:close"></iconify-icon>';
      del.title = 'Delete template';
      del.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!confirm(`Delete template "${tpl.name}"?`)) return;
        await fetch(`/api/templates/${encodeURIComponent(tpl.id)}`, { method: 'DELETE' });
        await loadTemplates();
      });
      card.appendChild(del);
    }

    themeGallery.appendChild(card);
  });
}

async function loadTemplates() {
  const res = await fetch('/api/templates');
  availableTemplates = await res.json();
  if (!availableTemplates.some((t) => t.id === currentTemplateId) && availableTemplates.length) {
    currentTemplateId = availableTemplates[0].id;
  }
  renderGallery();
}

btnImportTemplate.addEventListener('click', () => templateFileInput.click());
async function importTemplateFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.zip')) {
    saveNoteDesign.textContent = 'Template packages must be a .zip file';
    setTimeout(() => { saveNoteDesign.textContent = ''; }, 3000);
    return;
  }
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/templates', { method: 'POST', body: formData });
  const data = await res.json();
  if (data.error) {
    saveNoteDesign.textContent = data.error;
    setTimeout(() => { saveNoteDesign.textContent = ''; }, 3000);
    return;
  }
  currentTemplateId = data.id;
  await loadTemplates();
  loadPreviewFrame();
  pushPreview();
}

templateFileInput.addEventListener('change', async () => {
  await importTemplateFile(templateFileInput.files[0]);
  templateFileInput.value = '';
});

['dragenter', 'dragover'].forEach((evt) => {
  themeGallery.addEventListener(evt, (ev) => {
    ev.preventDefault();
    themeGallery.classList.add('drag-over');
  });
});
['dragleave', 'dragend', 'drop'].forEach((evt) => {
  themeGallery.addEventListener(evt, (ev) => {
    ev.preventDefault();
    themeGallery.classList.remove('drag-over');
  });
});
themeGallery.addEventListener('drop', async (ev) => {
  const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
  await importTemplateFile(file);
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
    templateId: currentTemplateId,
    max: parseInt(optMax.value, 10) || 20,
    lifetime: parseInt(optLifetime.value, 10) || 0,
    tts: optTts.checked,
    voiceName: optVoice.value,
    voiceRate: parseFloat(optRate.value) || 1,
  };
}

function pushPreview() {
  [previewFrame, liveFrame].forEach((frame) => {
    const frameWin = frame && frame.contentWindow;
    if (frameWin && typeof frameWin.applyPreviewConfig === 'function') {
      frameWin.applyPreviewConfig(currentOverlaySettings());
    }
  });
}

function loadPreviewFrame() {
  previewFrame.src = templatePath(currentTemplateId) + '?preview=1';
}

function loadLiveFrame() {
  liveFrame.src = templatePath(currentTemplateId);
}

function rebuildOverlayLink() {
  // Saved settings are the source of truth for the plain link; query params
  // are only for per-browser-source overrides, so the base link stays clean.
  // If this page itself was opened as a local file (e.g. double-clicked rather
  // than served), location.origin isn't a usable http(s) origin — fall back to
  // the server's default address so the link OBS needs is always valid.
  const origin = /^https?:$/.test(location.protocol) ? location.origin : 'http://localhost:4848';
  const url = origin + templatePath(currentTemplateId);
  overlayLink.href = url;
  overlayLink.textContent = url;
}

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
];
let sampleIndex = 0;
function pushSampleMessage() {
  const frameWin = previewFrame.contentWindow;
  if (!frameWin || typeof frameWin.previewMessage !== 'function') return;
  const msg = SAMPLE_MESSAGES[sampleIndex % SAMPLE_MESSAGES.length];
  frameWin.previewMessage({ ...msg, id: 'preview-' + Date.now() });
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

previewFrame.addEventListener('load', () => {
  // Push the panel's current unsaved overlay settings into the preview so
  // it reflects what's on screen right now, not just the last saved config.
  const frameWin = previewFrame.contentWindow;
  if (frameWin && typeof frameWin.applyPreviewConfig === 'function') {
    frameWin.applyPreviewConfig(currentOverlaySettings());
  }
  startPreviewLoop();
});

if (liveFrame) {
  liveFrame.addEventListener('load', () => {
    // Real chat connection lives inside this frame — only nudge it with the
    // panel's current unsaved settings, no sample messages.
    const frameWin = liveFrame.contentWindow;
    if (frameWin && typeof frameWin.applyPreviewConfig === 'function') {
      frameWin.applyPreviewConfig(currentOverlaySettings());
    }
  });
}

[optMax, optLifetime, optTts, optVoice, optRate].forEach((el) => {
  el.addEventListener('input', pushPreview);
  el.addEventListener('change', pushPreview);
});

async function loadSettings() {
  const res = await fetch('/api/settings');
  const data = await res.json();
  optNgWords.value = (data.ngWords || []).join('\n');
  optNgUsers.value = (data.ngUsers || []).join('\n');
  const o = data.overlay || {};
  currentTemplateId = o.templateId || 'pill';
  optMax.value = o.max != null ? o.max : 20;
  optLifetime.value = o.lifetime != null ? o.lifetime : 0;
  optTts.checked = !!o.tts;
  pendingVoiceName = o.voiceName || '';
  if (pendingVoiceName) optVoice.value = pendingVoiceName;
  optRate.value = o.voiceRate != null ? o.voiceRate : 1;

  await loadTemplates();
  rebuildOverlayLink();
  loadPreviewFrame();
  loadLiveFrame();
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
  rebuildOverlayLink();
  previewFrame.src = previewFrame.src; // reload preview to reflect saved settings
}

document.querySelectorAll('.btn-save').forEach(btn => {
  btn.addEventListener('click', () => saveSettings(btn.closest('.tab-panel').querySelector('.save-note')));
});

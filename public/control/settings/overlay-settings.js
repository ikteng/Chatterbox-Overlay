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
const optModeStacked = document.getElementById('opt-mode-stacked');
const optModeScroll = document.getElementById('opt-mode-scroll');
const optLayoutInline = document.getElementById('opt-layout-inline');
const optLayoutTop = document.getElementById('opt-layout-top');
const nameLayoutGallery = document.getElementById('name-layout-gallery');
const nameLayoutNote = document.getElementById('name-layout-note');
let displayMode = 'stacked';
let nameOnTop = false;

function setDisplayMode(mode) {
  displayMode = mode === 'scroll' ? 'scroll' : 'stacked';
  optModeStacked.classList.toggle('active', displayMode === 'stacked');
  optModeScroll.classList.toggle('active', displayMode === 'scroll');
  // Danmaku bullets always show the name inline — the layout choice has no
  // effect in that mode, so disable it instead of leaving a selection that
  // silently stops doing anything (see base-template.js's onConfigUpdate).
  nameLayoutGallery.classList.toggle('is-disabled', displayMode === 'scroll');
  nameLayoutNote.hidden = displayMode !== 'scroll';
}
function setNameLayout(top) {
  nameOnTop = !!top;
  optLayoutInline.classList.toggle('active', !nameOnTop);
  optLayoutTop.classList.toggle('active', nameOnTop);
}
optModeStacked.addEventListener('click', () => { setDisplayMode('stacked'); pushPreview(); });
optModeScroll.addEventListener('click', () => { setDisplayMode('scroll'); pushPreview(); });
optLayoutInline.addEventListener('click', () => { setNameLayout(false); pushPreview(); });
optLayoutTop.addEventListener('click', () => { setNameLayout(true); pushPreview(); });

const optNgWords = document.getElementById('opt-ngwords');
const optNgUsers = document.getElementById('opt-ngusers');
const saveNote = document.getElementById('save-note');
const saveNoteFilters = document.getElementById('save-note-filters');

let currentTemplateId = 'pill';
let availableTemplates = [];

function templatePath(id) {
  return `/templates/${id}/index.html`;
}

function renderGallery() {
  renderThemeGallery(
    themeGallery,
    availableTemplates,
    (tpl) => tpl.id === currentTemplateId,
    (tpl) => {
      currentTemplateId = tpl.id;
      renderGallery();
      loadPreviewFrame();
      pushPreview();
    },
    (tpl, card) => {
      const reveal = document.createElement('button');
      reveal.className = 'theme-card-reveal';
      reveal.innerHTML = '<iconify-icon icon="mdi:folder-open-outline"></iconify-icon>';
      reveal.title = 'Reveal template folder';
      reveal.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await fetch(`/api/templates/${encodeURIComponent(tpl.id)}/reveal`, { method: 'POST' });
      });
      card.appendChild(reveal);

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
    }
  );
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
    saveNote.textContent = 'Template packages must be a .zip file';
    setTimeout(() => { saveNote.textContent = ''; }, 3000);
    return;
  }
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/templates', { method: 'POST', body: formData });
  const data = await res.json();
  if (data.error) {
    saveNote.textContent = data.error;
    setTimeout(() => { saveNote.textContent = ''; }, 3000);
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

function currentOverlaySettings() {
  return {
    templateId: currentTemplateId,
    max: parseInt(optMax.value, 10) || 20,
    lifetime: parseInt(optLifetime.value, 10) || 0,
    nameOnTop: nameOnTop,
    displayMode: displayMode,
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
  const url = buildOverlayUrl(templatePath(currentTemplateId));
  overlayLink.href = url;
  overlayLink.textContent = url;
}

wireCopyLinkButton(btnCopyLink, () => overlayLink.href);

// ---- preview sample messages (pushes fake messages into the preview iframe's overlay) ----
const SAMPLE_MESSAGES = [
  { platform: 'twitch', author: 'StreamFan22', message: 'This overlay looks great! 🎉', color: '#ff9ac1' },
  { platform: 'youtube', author: '李明', message: '你好,主播!加油!', color: '#5bc9ff' },
  { platform: 'youtube', author: 'BigDonor', message: 'Keep up the great content!', color: '#8fffb0', isPaid: true, amount: '$5.00' },
  { platform: 'twitch', author: 'night_owl', message: 'lol that was close', color: '#c6a6ff' },
  { platform: 'twitch', author: 'BitsBandit', message: 'Cheer100 let\'s go!', color: '#ffb84d', isPaid: true, amount: '100 Bits' },
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
const startSamplePreviewLoop = startPreviewLoop(pushSampleMessage, 2800);

previewFrame.addEventListener('load', () => {
  // Push the panel's current unsaved overlay settings into the preview so
  // it reflects what's on screen right now, not just the last saved config.
  const frameWin = previewFrame.contentWindow;
  if (frameWin && typeof frameWin.applyPreviewConfig === 'function') {
    frameWin.applyPreviewConfig(currentOverlaySettings());
  }
  sampleIndex = 0;
  startSamplePreviewLoop();
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

[optMax, optLifetime].forEach((el) => {
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
  setNameLayout(!!o.nameOnTop);
  setDisplayMode(o.displayMode === 'scroll' ? 'scroll' : 'stacked');

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
    body: JSON.stringify({
      ngWords,
      ngUsers,
      overlay: currentOverlaySettings(),
    })
  });
  note.textContent = 'Saved.';
  setTimeout(() => { note.textContent = ''; }, 2000);
  rebuildOverlayLink();
  previewFrame.src = previewFrame.src; // reload preview to reflect saved settings
}

document.querySelectorAll('.btn-save').forEach(btn => {
  if (btn.closest('.tab-panel[data-tab="alerts"]')) return; // alert-settings.js owns this tab's save button
  btn.addEventListener('click', () => saveSettings(btn.closest('.tab-panel').querySelector('.save-note')));
});

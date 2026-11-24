// Shared host shim loaded by every template's index.html. Owns the WebSocket
// connection (live mode) / preview bridge (preview mode), then hands off
// rendering to the template's own script via window.onConfigUpdate /
// window.onChatMessage, which the template defines.
const params = new URLSearchParams(location.search);
const isPreview = params.get('preview') === '1';

let cfg = { max: 20, lifetime: 0 };

function dispatchConfig() {
  if (typeof window.onConfigUpdate === 'function') window.onConfigUpdate(cfg);
}

function dispatchMessage(msg) {
  if (typeof window.onChatMessage === 'function') window.onChatMessage(msg);
}

function dispatchEvent(evt) {
  if (typeof window.onChatEvent === 'function') window.onChatEvent(evt);
}

async function loadConfig() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    cfg = { ...cfg, ...(data.overlay || {}) };
  } catch {
    // keep defaults
  }
  dispatchConfig();
}

function connectWs() {
  connectReconnectingWs((data) => {
    if (data.type === 'chat') dispatchMessage(data.message);
    else if (data.type === 'event') dispatchEvent(data.event);
    else if (data.type === 'settings') { cfg = { ...cfg, ...data.overlay }; dispatchConfig(); }
  });
}

// Exposed in both modes so the control panel can push the currently-selected
// (not yet saved) settings in for instant feedback.
window.applyPreviewConfig = (overlay) => {
  cfg = { ...cfg, ...overlay };
  dispatchConfig();
};

if (isPreview) {
  // Embedded by the control panel's preview iframe — no real chat connection,
  // just a sandbox the panel can push settings/sample messages into.
  window.previewMessage = (msg) => dispatchMessage(msg);
  window.previewEvent = (evt) => dispatchEvent(evt);
  dispatchConfig();
} else {
  loadConfig().then(connectWs);
}

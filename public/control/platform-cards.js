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
    card.classList.remove('is-error');
    statusText.textContent = 'Connecting...';
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, url })
    });
    const data = await res.json();
    if (data.error) {
      statusText.textContent = 'Error: ' + data.error;
      card.classList.add('is-error');
    }
  });

  stopBtn.addEventListener('click', async () => {
    await fetch('/api/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform })
    });
    dot.className = 'dot';
    statusText.textContent = 'Not connected';
    card.classList.remove('is-connected', 'is-error');
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
  card.classList.toggle('is-error', status === 'error');
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

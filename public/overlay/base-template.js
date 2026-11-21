// Shared rendering logic for the bundled templates (pill/classic/minimal/terminal).
// Not required by custom-imported templates — they're free to render however they like.
const feed = document.getElementById('feed');
let maxMessages = 20;

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.appendChild(timeSpan);

  const platSpan = document.createElement('span');
  platSpan.className = 'plat ' + msg.platform;
  platSpan.title = msg.platform;
  platSpan.innerHTML = PLATFORM_ICONS[msg.platform] || '';
  div.appendChild(platSpan);

  if (msg.isPaid) {
    const paidSpan = document.createElement('span');
    paidSpan.className = 'badge-paid';
    paidSpan.textContent = '$';
    div.appendChild(paidSpan);
  }

  const authorSpan = document.createElement('span');
  authorSpan.className = 'author';
  authorSpan.style.color = msg.color || '#ffd56b';
  authorSpan.textContent = msg.author;
  div.appendChild(authorSpan);
  div.style.setProperty('--author-color', msg.color || '#ffd56b');

  const textSpan = document.createElement('span');
  renderMessageParts(textSpan, msg);
  div.appendChild(textSpan);

  feed.appendChild(div);
  while (feed.children.length > maxMessages) {
    feed.removeChild(feed.firstChild);
  }

  if (window.__msgLifetime > 0) {
    setTimeout(() => {
      div.classList.add('fade-out');
      setTimeout(() => div.remove(), 650);
    }, window.__msgLifetime);
  }
}

window.__msgLifetime = 0;

window.onConfigUpdate = (cfg) => {
  maxMessages = cfg.max || 20;
  window.__msgLifetime = cfg.lifetime || 0;
};

window.onChatMessage = appendMessage;

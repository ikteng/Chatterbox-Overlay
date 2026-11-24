// Shared rendering logic for the bundled templates (pill/classic/minimal/terminal).
// Not required by custom-imported templates — they're free to render however they like.
const feed = document.getElementById('feed');
let maxMessages = 20;

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg';

  const metaDiv = document.createElement('div');
  metaDiv.className = 'meta';
  div.appendChild(metaDiv);

  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  metaDiv.appendChild(timeSpan);

  const platSpan = document.createElement('span');
  platSpan.className = 'plat ' + msg.platform;
  platSpan.title = msg.platform;
  platSpan.innerHTML = PLATFORM_ICONS[msg.platform] || '';
  metaDiv.appendChild(platSpan);

  if (msg.isPaid) {
    const paidSpan = document.createElement('span');
    paidSpan.className = 'badge-paid';
    paidSpan.textContent = msg.amount || '$';
    metaDiv.appendChild(paidSpan);
  }

  const authorSpan = document.createElement('span');
  authorSpan.className = 'author';
  authorSpan.style.color = msg.color || '#ffd56b';
  authorSpan.textContent = msg.author;
  metaDiv.appendChild(authorSpan);
  div.style.setProperty('--author-color', msg.color || '#ffd56b');

  const textSpan = document.createElement('span');
  textSpan.className = 'text';
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

function appendEvent(evt) {
  const div = document.createElement('div');
  div.className = 'msg event event-' + evt.eventType;
  div.style.setProperty('--author-color', evt.color || '#ffd56b');

  const metaDiv = document.createElement('div');
  metaDiv.className = 'meta';
  div.appendChild(metaDiv);

  const platSpan = document.createElement('span');
  platSpan.className = 'plat ' + evt.platform;
  platSpan.title = evt.platform;
  platSpan.innerHTML = PLATFORM_ICONS[evt.platform] || '';
  metaDiv.appendChild(platSpan);

  const authorSpan = document.createElement('span');
  authorSpan.className = 'author';
  authorSpan.style.color = evt.color || '#ffd56b';
  authorSpan.textContent = evt.author;
  metaDiv.appendChild(authorSpan);

  const textSpan = document.createElement('span');
  textSpan.className = 'text';
  if (evt.systemMessage) {
    textSpan.appendChild(document.createTextNode(evt.systemMessage));
  } else if (evt.message) {
    renderMessageParts(textSpan, evt);
  }
  div.appendChild(textSpan);

  if (evt.message && evt.systemMessage) {
    const quoteDiv = document.createElement('div');
    quoteDiv.className = 'event-quote';
    renderMessageParts(quoteDiv, evt);
    div.appendChild(quoteDiv);
  }

  if (evt.data && evt.data.stickerUrl) {
    const img = document.createElement('img');
    img.src = evt.data.stickerUrl;
    img.className = 'event-sticker';
    div.appendChild(img);
  }

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
  document.body.classList.toggle('name-on-top', !!cfg.nameOnTop);
};

window.onChatMessage = appendMessage;
window.onChatEvent = appendEvent;

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

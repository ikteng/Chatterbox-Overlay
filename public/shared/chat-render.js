// Shared between the control panel's chat log and the OBS overlay.
const PLATFORM_ICONS = {
  youtube: '<svg viewBox="0 0 24 24"><path d="M23.5 6.2c-.3-1.1-1.1-1.9-2.2-2.2C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.3.5c-1.1.3-1.9 1.1-2.2 2.2C0 8.1 0 12 0 12s0 3.9.5 5.8c.3 1.1 1.1 1.9 2.2 2.2 1.9.5 9.3.5 9.3.5s7.4 0 9.3-.5c1.1-.3 1.9-1.1 2.2-2.2.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/></svg>',
  twitch: '<svg viewBox="0 0 24 24"><path d="M4.3 2 2 7.1v13.1h4.6V23l3.4-2.8h3.7L21 13.4V2H4.3zm14.3 10.3-3.4 3.4h-3.4l-2.9 2.9v-2.9H5.7V3.7h12.9v8.6z"/><path d="M15.7 6.9h1.7v5.1h-1.7zM11.1 6.9h1.7v5.1h-1.7z"/></svg>',
};

function renderMessageParts(container, msg) {
  const parts = msg.messageParts;
  if (!parts || !parts.length) {
    container.appendChild(document.createTextNode(msg.message));
    return;
  }
  for (const part of parts) {
    if (part.type === 'emote' && part.url) {
      const img = document.createElement('img');
      img.src = part.url;
      img.alt = part.text;
      img.title = part.text;
      img.className = 'chat-emote';
      container.appendChild(img);
    } else {
      container.appendChild(document.createTextNode(part.text));
    }
  }
}

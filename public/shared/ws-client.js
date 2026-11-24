// Shared reconnecting WebSocket helper used by the control panel and both
// overlay pages. Opens ws://<host>/ws, routes parsed messages to onMessage,
// and reconnects after a fixed delay on close.
function connectReconnectingWs(onMessage, retryMs) {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (ev) => onMessage(JSON.parse(ev.data));
  ws.onclose = () => setTimeout(() => connectReconnectingWs(onMessage, retryMs), retryMs || 2000);
  return ws;
}

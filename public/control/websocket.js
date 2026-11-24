// ---- websocket ----
function connectWs() {
  const ws = new WebSocket(`ws://${location.host}/ws`);
  ws.onmessage = (ev) => {
    const data = JSON.parse(ev.data);
    if (data.type === 'chat') {
      updateCount(data.message.platform, data.count);
    } else if (data.type === 'status') {
      updateStatus(data.platform, data.status, data.text);
    }
  };
  ws.onclose = () => setTimeout(connectWs, 2000);
}
connectWs();

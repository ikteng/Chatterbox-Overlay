// ---- websocket ----
connectReconnectingWs((data) => {
  if (data.type === 'chat') {
    updateCount(data.message.platform, data.count);
  } else if (data.type === 'status') {
    updateStatus(data.platform, data.status, data.text);
  }
});

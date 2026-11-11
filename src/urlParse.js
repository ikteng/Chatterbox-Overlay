function extractYouTubeId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]{11})/,
    /youtu\.be\/([\w-]{11})/,
    /youtube\.com\/live\/([\w-]{11})/,
    /youtube\.com\/channel\/[\w-]+\/live/,
    /youtube\.com\/@[\w.-]+\/live/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

function extractTwitchChannel(url) {
  const m = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/);
  return m ? m[1].toLowerCase() : null;
}

function extractTikTokUser(url) {
  // https://www.tiktok.com/@username/live  or douyin live urls
  let m = url.match(/tiktok\.com\/@([\w.-]+)/);
  if (m) return { platform: "tiktok", user: m[1] };
  m = url.match(/live\.douyin\.com\/(\d+)/);
  if (m) return { platform: "douyin", roomIdAlias: m[1] };
  m = url.match(/v\.douyin\.com\/[\w-]+/);
  if (m) return { platform: "douyin", shortUrl: url };
  return null;
}

module.exports = { extractYouTubeId, extractTwitchChannel, extractTikTokUser };

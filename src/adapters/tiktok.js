const fetch = require("node-fetch");
const { extractTikTokUser } = require("../urlParse");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Best-effort TikTok LIVE chat polling via the public room_info + webcast
// comment endpoints. TikTok has no official no-auth chat API, so this relies
// on reverse-engineered endpoints that may change or stop working at any time.
//
// To avoid looking like an active viewer/heartbeat client, this adapter:
//  - resolves the room id exactly once (no re-fetching the live page on retry)
//  - only ever calls the single chat-fetch endpoint, nothing from the
//    presence/heartbeat/gift/viewer-count surface
//  - polls slowly (default 8s) since chat doesn't need sub-second latency
//  - backs off hard on errors instead of hammering the endpoint
const POLL_INTERVAL_MS = 8000;
const ERROR_BACKOFF_MS = 15000;

class TikTokAdapter {
  constructor(url, onMessage, onStatus) {
    this.url = url;
    this.parsed = extractTikTokUser(url);
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.running = false;
    this.roomId = null;
    this.seen = new Set();
    this.cursor = "0";
  }

  async start() {
    if (!this.parsed) {
      this.onStatus("error", "Could not parse TikTok/Douyin username from URL");
      return;
    }
    this.running = true;
    try {
      this.roomId = await this.resolveRoomId();
      if (!this.roomId) {
        this.onStatus(
          "error",
          "Could not find live room (user may be offline, or TikTok changed its page format)"
        );
        this.running = false;
        return;
      }
      this.onStatus("connected", `TikTok/Douyin chat connected (room ${this.roomId})`);
      this.poll();
    } catch (err) {
      this.onStatus("error", `TikTok connect failed: ${err.message}`);
      this.running = false;
    }
  }

  async resolveRoomId() {
    if (this.parsed.platform === "tiktok") {
      const res = await fetch(`https://www.tiktok.com/@${this.parsed.user}/live`, {
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en" },
      });
      const html = await res.text();
      let m = html.match(/"roomId":"(\d+)"/);
      if (m) return m[1];
      m = html.match(/room_id=(\d+)/);
      if (m) return m[1];
      return null;
    }
    // douyin: resolve short/alias url by following redirects then scraping roomId
    const target = this.parsed.shortUrl || this.url;
    const res = await fetch(target, {
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh" },
      redirect: "follow",
    });
    const html = await res.text();
    let m = html.match(/"roomId":"(\d+)"/) || html.match(/room_id=(\d+)/);
    return m ? m[1] : null;
  }

  async poll() {
    while (this.running) {
      try {
        const res = await fetch(
          `https://webcast.tiktok.com/webcast/im/fetch/?aid=1988&room_id=${this.roomId}&cursor=${this.cursor}&fetch_rule=1`,
          { headers: { "User-Agent": UA } }
        );
        if (res.ok) {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("json")) {
            const data = await res.json();
            if (data.cursor) this.cursor = data.cursor;
            const msgs = data.messages || [];
            for (const m of msgs) {
              if (m.type !== "chat" && m.method !== "WebcastChatMessage") continue;
              const id = m.msgId || `${Date.now()}-${Math.random()}`;
              if (this.seen.has(id)) continue;
              this.seen.add(id);
              this.onMessage({
                platform: this.parsed.platform,
                id,
                author: m.user?.nickname || m.nickname || "Unknown",
                message: m.content || m.comment || "",
                color: null,
                badge: null,
                isPaid: false,
                timestamp: Date.now(),
              });
            }
          }
          // Binary/protobuf responses can't be decoded without the TikTok
          // protobuf schema; this adapter only handles the JSON fallback path.
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      } catch (err) {
        this.onStatus("error", `TikTok poll error: ${err.message}`);
        await new Promise((r) => setTimeout(r, ERROR_BACKOFF_MS));
      }
    }
  }

  stop() {
    this.running = false;
  }
}

module.exports = TikTokAdapter;

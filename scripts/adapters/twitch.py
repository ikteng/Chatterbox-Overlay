import asyncio
import random
import re
import time

import aiohttp

from url_parse import extract_twitch_channel

_PRIVMSG_RE = re.compile(r"^:(\S+) PRIVMSG #\S+ :(.*)$")
_USERNOTICE_RE = re.compile(r"^:(\S+) USERNOTICE #\S+(?: :(.*))?$")

_SUB_EVENTS = {"sub", "resub", "subgift", "submysterygift", "giftpaidupgrade", "anongiftpaidupgrade"}


def parse_tags(tag_str):
    tags = {}
    if not tag_str:
        return tags
    for pair in tag_str[1:].split(";"):
        if "=" in pair:
            k, v = pair.split("=", 1)
            tags[k] = v
    return tags


def _emote_url(emote_id):
    return f"https://static-cdn.jtvnw.net/emoticons/v2/{emote_id}/default/dark/2.0"


def parse_emotes_tag(emotes_str, message):
    """Parse the IRC v3 `emotes` tag (e.g. "25:0-4,12-16/1902:6-10") into
    ordered message parts, splitting `message` around each emote occurrence.
    `message` must be the raw IRC text (UTF-16 code unit offsets apply)."""
    if not emotes_str:
        return [{"type": "text", "text": message}] if message else []

    ranges = []
    for entry in emotes_str.split("/"):
        if ":" not in entry:
            continue
        emote_id, positions = entry.split(":", 1)
        for pos in positions.split(","):
            if "-" not in pos:
                continue
            start, end = pos.split("-", 1)
            try:
                ranges.append((int(start), int(end), emote_id))
            except ValueError:
                continue
    if not ranges:
        return [{"type": "text", "text": message}] if message else []
    ranges.sort(key=lambda r: r[0])

    # Twitch emote ranges are UTF-16 code unit offsets; Python strings are
    # indexed by code point, so operate on a UTF-16 buffer and decode back.
    units = message.encode("utf-16-le")

    parts = []
    cursor = 0
    for start, end, emote_id in ranges:
        if start < cursor:
            continue
        if start > cursor:
            text = units[cursor * 2:start * 2].decode("utf-16-le")
            if text:
                parts.append({"type": "text", "text": text})
        name = units[start * 2:(end + 1) * 2].decode("utf-16-le")
        parts.append({"type": "emote", "text": name, "url": _emote_url(emote_id)})
        cursor = end + 1
    if cursor * 2 < len(units):
        text = units[cursor * 2:].decode("utf-16-le")
        if text:
            parts.append({"type": "text", "text": text})
    return parts


def parse_irc_line(line):
    tag_str = None
    rest = line
    if line.startswith("@"):
        sp = line.find(" ")
        tag_str = line[:sp]
        rest = line[sp + 1:]
    tags = parse_tags(tag_str)

    m = _PRIVMSG_RE.match(rest)
    if m:
        nick = m.group(1).split("!")[0]
        message = m.group(2)
        badges = tags.get("badges")
        bits = _to_int(tags.get("bits"))
        return {
            "type": "message",
            "author": tags.get("display-name") or nick,
            "message": message,
            "messageParts": parse_emotes_tag(tags.get("emotes"), message),
            "color": tags.get("color") or None,
            "badge": badges.split(",")[0].split("/")[0] if badges else None,
            "id": tags.get("id") or f"{time.time()}-{random.random()}",
            "isPaid": bool(bits),
            "amount": f"{bits} Bits" if bits else None,
        }

    m = _USERNOTICE_RE.match(rest)
    if m:
        nick = m.group(1).split("!")[0]
        message = m.group(2) or ""
        msg_id = tags.get("msg-id") or ""
        author = tags.get("display-name") or nick
        return {
            "type": "event",
            "eventType": msg_id,
            "id": tags.get("id") or f"{time.time()}-{random.random()}",
            "author": author,
            "message": message,
            "messageParts": parse_emotes_tag(tags.get("emotes"), message) if message else [],
            "color": tags.get("color") or None,
            "badge": (tags.get("badges") or "").split(",")[0].split("/")[0] or None,
            "systemMessage": tags.get("system-msg", "").replace("\\s", " "),
            "isPaid": msg_id in _SUB_EVENTS,
            "data": {
                "subPlan": tags.get("msg-param-sub-plan"),
                "subPlanName": (tags.get("msg-param-sub-plan-name") or "").replace("\\s", " ") or None,
                "cumulativeMonths": _to_int(tags.get("msg-param-cumulative-months")),
                "streakMonths": _to_int(tags.get("msg-param-streak-months")),
                "giftMonths": _to_int(tags.get("msg-param-gift-months")),
                "recipient": tags.get("msg-param-recipient-display-name") or tags.get("msg-param-recipient-user-name"),
                "giftCount": _to_int(tags.get("msg-param-mass-gift-count")),
                "senderTotalGifts": _to_int(tags.get("msg-param-sender-count")),
                "raidViewerCount": _to_int(tags.get("msg-param-viewerCount")),
                "raidFromChannel": tags.get("msg-param-displayName") or tags.get("msg-param-login"),
            },
        }
    return None


def _to_int(val):
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


class TwitchAdapter:
    def __init__(self, url, on_message, on_status, on_event=None):
        self.channel = extract_twitch_channel(url)
        self.on_message = on_message
        self.on_status = on_status
        self.on_event = on_event
        self.running = False
        self.ws = None
        self._task = None

    async def start(self):
        if not self.channel:
            self.on_status("error", "Could not parse Twitch channel from URL")
            return
        self.running = True
        self._task = asyncio.ensure_future(self._run())

    async def _run(self):
        while self.running:
            try:
                await self._connect_once()
            except Exception as err:
                self.on_status("error", f"Twitch error: {err}")
            if self.running:
                self.on_status("reconnecting", "Twitch disconnected, retrying...")
                await asyncio.sleep(3)

    async def _connect_once(self):
        nick = f"justinfan{random.randint(10000, 99999)}"
        async with aiohttp.ClientSession() as session:
            async with session.ws_connect("wss://irc-ws.chat.twitch.tv:443") as ws:
                if not self.running:
                    return
                self.ws = ws
                await ws.send_str("CAP REQ :twitch.tv/tags twitch.tv/commands")
                await ws.send_str("PASS SCHMOOPIIE")
                await ws.send_str(f"NICK {nick}")
                await ws.send_str(f"JOIN #{self.channel}")
                self.on_status("connected", f"Twitch chat connected (#{self.channel})")

                async for msg in ws:
                    if not self.running:
                        break
                    if msg.type != aiohttp.WSMsgType.TEXT:
                        continue
                    for line in msg.data.split("\r\n"):
                        if not line:
                            continue
                        if line.startswith("PING"):
                            await ws.send_str("PONG :tmi.twitch.tv")
                            continue
                        parsed = parse_irc_line(line)
                        if not parsed:
                            continue
                        payload = {**parsed, "platform": "twitch", "timestamp": int(time.time() * 1000)}
                        payload.pop("type", None)
                        if parsed["type"] == "message":
                            self.on_message(payload)
                        elif parsed["type"] == "event" and self.on_event:
                            self.on_event(payload)
        self.ws = None

    def stop(self):
        self.running = False
        if self.ws is not None:
            asyncio.ensure_future(self.ws.close())

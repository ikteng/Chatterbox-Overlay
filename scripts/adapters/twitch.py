import asyncio
import random
import re
import time

import aiohttp

from url_parse import extract_twitch_channel

_PRIVMSG_RE = re.compile(r"^:(\S+) PRIVMSG #\S+ :(.*)$")


def parse_tags(tag_str):
    tags = {}
    if not tag_str:
        return tags
    for pair in tag_str[1:].split(";"):
        if "=" in pair:
            k, v = pair.split("=", 1)
            tags[k] = v
    return tags


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
        return {
            "type": "message",
            "author": tags.get("display-name") or nick,
            "message": message,
            "color": tags.get("color") or None,
            "badge": badges.split(",")[0].split("/")[0] if badges else None,
            "id": tags.get("id") or f"{time.time()}-{random.random()}",
        }
    return None


class TwitchAdapter:
    def __init__(self, url, on_message, on_status):
        self.channel = extract_twitch_channel(url)
        self.on_message = on_message
        self.on_status = on_status
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
                        if parsed:
                            self.on_message({
                                "platform": "twitch",
                                "id": parsed["id"],
                                "author": parsed["author"],
                                "message": parsed["message"],
                                "color": parsed["color"],
                                "badge": parsed["badge"],
                                "isPaid": False,
                                "timestamp": int(time.time() * 1000),
                            })
        self.ws = None

    def stop(self):
        self.running = False
        if self.ws is not None:
            asyncio.ensure_future(self.ws.close())

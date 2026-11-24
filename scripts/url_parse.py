import re

_YOUTUBE_PATTERNS = [
    re.compile(r"youtube\.com/watch\?v=([\w-]{11})"),
    re.compile(r"youtu\.be/([\w-]{11})"),
    re.compile(r"youtube\.com/live/([\w-]{11})"),
]

_TWITCH_RE = re.compile(r"twitch\.tv/([a-zA-Z0-9_]+)")


def extract_youtube_id(url):
    for pattern in _YOUTUBE_PATTERNS:
        m = pattern.search(url)
        if m and m.group(1):
            return m.group(1)
    return None


def extract_twitch_channel(url):
    m = _TWITCH_RE.search(url)
    return m.group(1).lower() if m else None

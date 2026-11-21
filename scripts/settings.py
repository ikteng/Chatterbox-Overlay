import json
import os
import sys

BASE_DIR = os.path.dirname(sys.executable) if getattr(sys, "frozen", False) else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SETTINGS_PATH = os.path.join(BASE_DIR, "settings.json")

DEFAULT_SETTINGS = {
    "ngWords": [],
    "ngUsers": [],
    "overlay": {
        "templateId": "pill",
        "max": 20,
        "lifetime": 0,
    },
}


def _as_float(v):
    try:
        f = float(v)
        if f != f or f in (float("inf"), float("-inf")):
            return None
        return f
    except (TypeError, ValueError):
        return None


def sanitize_overlay(o):
    o = o or {}
    base = DEFAULT_SETTINGS["overlay"]
    max_val = _as_float(o.get("max"))
    lifetime = _as_float(o.get("lifetime"))
    template_id = o.get("templateId")
    return {
        "templateId": template_id if isinstance(template_id, str) and template_id.strip() else base["templateId"],
        "max": max(1, min(100, int(max_val))) if max_val is not None else base["max"],
        "lifetime": max(0, lifetime) if lifetime is not None else base["lifetime"],
    }


def load():
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            parsed = json.load(f)
        return {
            "ngWords": parsed.get("ngWords") if isinstance(parsed.get("ngWords"), list) else [],
            "ngUsers": parsed.get("ngUsers") if isinstance(parsed.get("ngUsers"), list) else [],
            "overlay": sanitize_overlay(parsed.get("overlay")),
        }
    except Exception:
        defaults = json.loads(json.dumps(DEFAULT_SETTINGS))
        save(defaults)
        return defaults


def save(settings):
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)


current = load()


def get():
    return current


def update(partial):
    global current
    partial = partial or {}
    current = {
        "ngWords": partial.get("ngWords") if isinstance(partial.get("ngWords"), list) else current["ngWords"],
        "ngUsers": partial.get("ngUsers") if isinstance(partial.get("ngUsers"), list) else current["ngUsers"],
        "overlay": sanitize_overlay({**current["overlay"], **partial["overlay"]}) if partial.get("overlay") else current["overlay"],
    }
    save(current)
    return current


def is_blocked(message):
    ng_words = current["ngWords"]
    ng_users = current["ngUsers"]
    author = (message.get("author") or "").lower()
    if any(u.lower() == author for u in ng_users):
        return True
    text = (message.get("message") or "").lower()
    if any(w and w.lower() in text for w in ng_words):
        return True
    return False

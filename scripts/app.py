import asyncio
import json
import os
import sys
import threading

from aiohttp import web, WSMsgType

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import settings
from adapters.youtube import YouTubeAdapter
from adapters.twitch import TwitchAdapter

PORT = int(os.environ.get("PORT", 4848))

if getattr(sys, "frozen", False):
    PUBLIC_DIR = os.path.join(os.path.dirname(sys.executable), "public")
    if not os.path.isdir(PUBLIC_DIR):
        PUBLIC_DIR = os.path.join(sys._MEIPASS, "public")
else:
    PUBLIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public")

ADAPTER_CLASSES = {
    "youtube": YouTubeAdapter,
    "twitch": TwitchAdapter,
}

ws_clients = set()
adapters = {}
message_counts = {}


def broadcast(msg_type, payload):
    data = json.dumps({"type": msg_type, **payload})
    for ws in list(ws_clients):
        if not ws.closed:
            asyncio.ensure_future(ws.send_str(data))


async def start_adapter(platform, url):
    await stop_adapter(platform)
    adapter_class = ADAPTER_CLASSES.get(platform)
    if not adapter_class:
        if platform == "douyin":
            raise ValueError("Douyin is not supported in this build — use the Node/Chatterbox Overlay.exe version")
        raise ValueError(f"Unknown platform: {platform}")

    message_counts[platform] = 0

    def on_message(message):
        message_counts[platform] = message_counts.get(platform, 0) + 1
        if settings.is_blocked(message):
            return
        broadcast("chat", {"message": message, "count": message_counts[platform]})

    def on_status(status, text):
        broadcast("status", {"platform": platform, "status": status, "text": text})

    adapter = adapter_class(url, on_message, on_status)
    adapters[platform] = adapter
    await adapter.start()


async def stop_adapter(platform):
    adapter = adapters.get(platform)
    if adapter:
        adapter.stop()
        del adapters[platform]
        message_counts.pop(platform, None)
        broadcast("status", {"platform": platform, "status": "stopped", "text": f"{platform} stopped"})


async def handle_connect(request):
    body = await request.json()
    platform = body.get("platform")
    url = body.get("url")
    if not platform or not url:
        return web.json_response({"error": "platform and url are required"}, status=400)
    try:
        await start_adapter(platform, url)
        return web.json_response({"ok": True})
    except Exception as err:
        return web.json_response({"error": str(err)}, status=400)


async def handle_disconnect(request):
    body = await request.json()
    platform = body.get("platform")
    await stop_adapter(platform)
    return web.json_response({"ok": True})


async def handle_status(request):
    return web.json_response({"active": list(adapters.keys())})


async def handle_get_settings(request):
    return web.json_response(settings.get())


async def handle_post_settings(request):
    body = await request.json()
    updated = settings.update(body or {})
    broadcast("settings", {"overlay": updated["overlay"]})
    return web.json_response(updated)


async def handle_ws(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    ws_clients.add(ws)
    try:
        async for msg in ws:
            if msg.type == WSMsgType.ERROR:
                break
    finally:
        ws_clients.discard(ws)
    return ws


def create_app():
    app = web.Application()
    app.router.add_post("/api/connect", handle_connect)
    app.router.add_post("/api/disconnect", handle_disconnect)
    app.router.add_get("/api/status", handle_status)
    app.router.add_get("/api/settings", handle_get_settings)
    app.router.add_post("/api/settings", handle_post_settings)
    app.router.add_get("/ws", handle_ws)
    app.router.add_static("/", PUBLIC_DIR, show_index=False)
    return app


def run_server():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    app = create_app()
    runner = web.AppRunner(app)
    loop.run_until_complete(runner.setup())
    site = web.TCPSite(runner, "0.0.0.0", PORT)
    loop.run_until_complete(site.start())
    loop.run_forever()


def main():
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    url = f"http://localhost:{PORT}/control/control.html"
    print(f"Chatterbox Overlay running at http://localhost:{PORT}")
    print(f"  Control panel: http://localhost:{PORT}/control/control.html")
    print(f"  OBS overlay:   http://localhost:{PORT}/overlay/overlay.html")

    if getattr(sys, "frozen", False):
        import webview
        webview.create_window("Chatterbox Overlay", url, width=1000, height=700)
        webview.start()
        os._exit(0)
    else:
        print(f"  Dev mode — open {url} in a browser.")
        try:
            server_thread.join()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()

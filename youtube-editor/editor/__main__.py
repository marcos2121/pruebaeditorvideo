"""Arranca el editor: python -m editor"""
import os
import threading
import webbrowser

import uvicorn


def main() -> None:
    host = os.environ.get("YT_EDITOR_HOST", "127.0.0.1")
    port = int(os.environ.get("YT_EDITOR_PORT", "8000"))
    url = f"http://localhost:{port}"
    print(f"\n  Editor YouTube listo en {url}\n  (deja esta ventana abierta mientras lo usas)\n")
    if os.environ.get("YT_EDITOR_NO_BROWSER") != "1":
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()
    uvicorn.run("editor.server:app", host=host, port=port, log_level="warning")


if __name__ == "__main__":
    main()

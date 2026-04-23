"""app.py — Vosges Hiking Planner desktop app.

Runs a tiny Flask server (static files + Overpass proxy) and opens the UI
in a native window via pywebview. Works both as a plain Python script and
as a PyInstaller-bundled .app / .exe.

Install:  pip install -r requirements.txt
Run:      python app.py
Build:    ./build.sh   (produces dist/Vosges Hiking Planner.app on macOS)
"""

import os
import sys
import threading

import requests
import webview
from flask import Flask, jsonify, request, send_from_directory

PORT = 5173
# When frozen by PyInstaller, static files are extracted to sys._MEIPASS.
ROOT = getattr(sys, "_MEIPASS", os.path.dirname(os.path.abspath(__file__)))
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

app = Flask(__name__, static_folder=ROOT, static_url_path="")


@app.route("/")
def index():
    return send_from_directory(ROOT, "index.html")


@app.route("/api/overpass", methods=["POST"])
def overpass_proxy():
    query = request.form.get("data")
    if not query:
        return jsonify({"error": 'Missing "data" parameter'}), 400

    last_err = None
    for mirror in MIRRORS:
        try:
            r = requests.post(
                mirror,
                data={"data": query},
                timeout=45,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            if r.ok:
                return jsonify(r.json())
            last_err = f"HTTP {r.status_code}"
        except requests.RequestException as e:
            last_err = str(e)

    return jsonify({"error": "All Overpass mirrors failed", "detail": last_err}), 502


def run_server():
    app.run(host="127.0.0.1", port=PORT, debug=False, use_reloader=False)


if __name__ == "__main__":
    threading.Thread(target=run_server, daemon=True).start()
    webview.create_window(
        "Vosges Hiking Planner",
        f"http://127.0.0.1:{PORT}",
        width=1400,
        height=900,
        min_size=(900, 600),
    )
    webview.start()

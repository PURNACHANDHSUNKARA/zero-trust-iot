"""
export_snapshot.py
---------------------
PHASE 18 SOLUTION: how the React dashboard sees PostgreSQL data
without a backend and without exposing PostgreSQL to the browser.

The browser can NEVER connect to PostgreSQL directly (no driver, no
network path, and it would be a serious security hole to expose a raw
DB connection to client-side JS). Since this project intentionally has
no REST/Express backend, the practical local solution is a one-way,
read-only EXPORT: this script queries PostgreSQL, serializes the
results to plain JSON, and writes them into the frontend's `public/`
folder, where Vite serves them as static files. React then just
`fetch()`s that JSON like any static asset.

This is a snapshot, not live data - re-run this script (or wire it
into main.py) whenever you want the dashboard to reflect fresh
results. For a real product you would replace this with an API layer,
but for a local demo/course project this keeps the "no backend"
constraint while still getting data from Python into React safely.

Run with:  python export_snapshot.py
Output:    ../frontend/public/data/*.json
"""

import json
import os
from datetime import datetime, date

import database
import dataset_analysis
import ml_models

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "public", "data")


def _json_default(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return str(obj)


def _write(filename: str, data):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=_json_default)
    print(f"[export_snapshot] wrote {path}")


def export_all():
    _write("dashboard_stats.json", database.get_dashboard_stats())
    _write("devices.json", database.list_devices())
    _write("access_requests.json", database.list_access_requests(limit=200))
    _write("security_events.json", database.list_security_events(limit=200))
    _write("dataset_stats.json", dataset_analysis.overall_statistics())
    _write("model_performance.json", ml_models.get_model_evaluation_data())

    with database.get_cursor() as cur:
        cur.execute("SELECT * FROM authentication_logs ORDER BY timestamp DESC LIMIT 200;")
        auth_logs = cur.fetchall()
    _write("authentication_logs.json", auth_logs)

    print("[export_snapshot] done. Refresh the React dashboard to see updated data.")


if __name__ == "__main__":
    export_all()

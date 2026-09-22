"""
server.py
=========
Production Flask REST API Server for the Zero-Trust IoT Security Framework.
Runs on 0.0.0.0:$PORT and provides health checks, dashboard data APIs,
zero-trust evaluation endpoints, and automatic database schema setup.
"""

import os
import sys
import json
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PYTHON_DIR = os.path.join(ROOT_DIR, "python-security")
FRONTEND_DATA_DIR = os.path.join(ROOT_DIR, "frontend", "public", "data")

if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

if PYTHON_DIR not in sys.path:
    sys.path.insert(0, PYTHON_DIR)

import database
import authentication
import zero_trust
import dataset_analysis
import ml_models
import export_snapshot
import device_simulator
import run_all

app = Flask(__name__)

# Configure CORS for deployment
cors_origin = os.getenv("FRONTEND_URL", os.getenv("CORS_ORIGIN", "*"))
CORS(app, resources={r"/*": {"origins": cors_origin}})

# Handle proxy headers when running behind Render's reverse proxy
app.config['PREFERRED_URL_SCHEME'] = 'https'


def initialize_app():
    """Runs database setup, dataset check, and initial snapshot export."""
    print("\n[+] Initializing Zero-Trust IoT Backend Application...")
    try:
        run_all.setup_database()
        run_all.setup_dataset()
        run_all.setup_blockchain()
        run_all.run_security_pipeline()
        run_all.export_dashboard_data()
        print("[+] Backend initialization completed successfully.\n")
    except Exception as e:
        print(f"[!] Warning during backend initialization: {e}\n")


@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
def health_check():
    """Render health check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "zero-trust-iot-backend"
    }), 200


@app.route("/api/stats", methods=["GET"])
def get_stats():
    try:
        return jsonify(database.get_dashboard_stats()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/devices", methods=["GET"])
def get_devices():
    try:
        return jsonify(database.list_devices()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/access-requests", methods=["GET"])
def get_access_requests():
    try:
        limit = request.args.get("limit", default=200, type=int)
        return jsonify(database.list_access_requests(limit=limit)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/security-events", methods=["GET"])
def get_security_events():
    try:
        limit = request.args.get("limit", default=200, type=int)
        return jsonify(database.list_security_events(limit=limit)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/dataset-stats", methods=["GET"])
def get_dataset_stats():
    try:
        return jsonify(dataset_analysis.overall_statistics()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/model-performance", methods=["GET"])
def get_model_performance():
    try:
        return jsonify(ml_models.get_model_evaluation_data()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth-logs", methods=["GET"])
def get_auth_logs():
    try:
        with database.get_cursor() as cur:
            cur.execute("SELECT * FROM authentication_logs ORDER BY timestamp DESC LIMIT 200;")
            auth_logs = cur.fetchall()
        return jsonify(auth_logs), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/authenticate", methods=["POST"])
def authenticate():
    try:
        data = request.get_json() or {}
        device_id = data.get("device_id", "IOT001")
        sign_fn = device_simulator.get_sign_function(device_id)
        res = authentication.authenticate_device(device_id, sign_fn)
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/evaluate-access", methods=["POST"])
def evaluate_access():
    try:
        data = request.get_json() or {}
        device_id = data.get("device_id", "IOT001")
        resource = data.get("resource", "Temperature")
        action = data.get("action", "READ")
        res = zero_trust.evaluate_access(device_id, resource, action)
        return jsonify(res), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/run-pipeline", methods=["POST"])
def run_pipeline_endpoint():
    try:
        run_all.run_security_pipeline()
        export_snapshot.export_all()
        return jsonify({"status": "success", "message": "Pipeline executed and snapshot exported."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/data/<path:filename>", methods=["GET"])
def serve_data_snapshot(filename):
    """Fallback endpoint for serving static JSON snapshot files directly."""
    if os.path.exists(os.path.join(FRONTEND_DATA_DIR, filename)):
        return send_from_directory(FRONTEND_DATA_DIR, filename)
    return jsonify({"error": f"File {filename} not found"}), 404


# Perform initial setup when app starts under WSGI/Gunicorn or CLI
with app.app_context():
    initialize_app()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    print(f"[*] Starting Zero-Trust IoT Flask Server on 0.0.0.0:{port}...")
    app.run(host="0.0.0.0", port=port, debug=False)

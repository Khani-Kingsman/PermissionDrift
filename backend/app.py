"""
PermissionDrift — Local Flask REST API Server.

Serves the dashboard endpoints and coordinates non-blocking background
scans, snapshot queries, and drift analysis.
"""

import os
import sys
import uuid
import time
import logging
import threading
from pathlib import Path
from typing import Dict, Any, Optional

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from backend.scanner import WindowsSecurityScanner
from backend.storage import (
    save_snapshot, get_snapshot, get_latest_snapshot,
    get_baseline_snapshot, set_baseline, list_snapshots, DB_PATH
)
from backend.diff_engine import diff_snapshots, calculate_blast_radius

logger = logging.getLogger("PermissionDriftAPI")

app = Flask(__name__, static_folder=str(Path(__file__).resolve().parent.parent / "frontend" / "dist"))
CORS(app)

# In-memory async job tracking registry
JOBS: Dict[str, Dict[str, Any]] = {}


def _async_scan_worker(job_id: str, is_baseline_requested: bool = False):
    """Executes scan in a dedicated background worker thread."""
    try:
        JOBS[job_id]["status"] = "running"
        JOBS[job_id]["started_at"] = time.time()

        latest = get_latest_snapshot()
        prev_process_names = set(latest.get("all_process_names", [])) if latest else None
        base = get_baseline_snapshot()

        scanner = WindowsSecurityScanner(wall_clock_budget_sec=10.0)
        snapshot = scanner.run_scan(previous_process_names=prev_process_names)

        # Diff against baseline if baseline exists
        events, blast_score = diff_snapshots(base, snapshot)
        snapshot["blast_radius_score"] = blast_score

        is_first = (latest is None)
        set_as_baseline = is_baseline_requested or is_first

        saved_id = save_snapshot(
            snapshot,
            is_baseline=set_as_baseline,
            blast_radius_score=blast_score
        )

        JOBS[job_id]["status"] = "done"
        JOBS[job_id]["snapshot_id"] = saved_id
        JOBS[job_id]["blast_radius_score"] = blast_score
        JOBS[job_id]["is_baseline"] = set_as_baseline
        JOBS[job_id]["duration_ms"] = int((time.time() - JOBS[job_id]["started_at"]) * 1000)
    except Exception as e:
        logger.exception(f"Background scan error for job {job_id}: {e}")
        JOBS[job_id]["status"] = "failed"
        JOBS[job_id]["error"] = str(e)


# Support both /api/scan and /scan
@app.route("/api/scan", methods=["POST"])
@app.route("/scan", methods=["POST"])
def trigger_scan():
    """Starts scan asynchronously and returns {job_id} in under 100ms."""
    t_start = time.time()
    data = request.get_json(silent=True) or {}
    is_baseline = bool(data.get("is_baseline", False))

    job_id = str(uuid.uuid4())
    JOBS[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "created_at": time.time(),
        "snapshot_id": None,
        "error": None
    }

    thread = threading.Thread(target=_async_scan_worker, args=(job_id, is_baseline), daemon=True)
    thread.start()

    resp_time_ms = int((time.time() - t_start) * 1000)
    return jsonify({
        "job_id": job_id,
        "status": "pending",
        "response_time_ms": resp_time_ms
    }), 202


@app.route("/api/jobs/<job_id>", methods=["GET"])
@app.route("/jobs/<job_id>", methods=["GET"])
def get_job_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(job)


@app.route("/api/snapshots", methods=["GET"])
@app.route("/snapshots", methods=["GET"])
def get_snapshots():
    limit = int(request.args.get("limit", 50))
    snaps = list_snapshots(limit=limit)
    return jsonify({"snapshots": snaps})


@app.route("/api/snapshots/<scan_id>", methods=["GET"])
@app.route("/snapshots/<scan_id>", methods=["GET"])
def get_snapshot_by_id(scan_id: str):
    snap = get_snapshot(scan_id)
    if not snap:
        return jsonify({"error": "Snapshot not found"}), 404
    return jsonify(snap)


@app.route("/api/baseline/<scan_id>", methods=["POST"])
@app.route("/baseline/<scan_id>", methods=["POST"])
def set_baseline_by_id(scan_id: str):
    success = set_baseline(scan_id)
    if not success:
        return jsonify({"error": "Snapshot not found"}), 404
    return jsonify({"success": True, "baseline_scan_id": scan_id})


@app.route("/api/drift", methods=["GET"])
@app.route("/drift", methods=["GET"])
def get_drift_against_baseline():
    """Diffs the latest snapshot against baseline. Gracefully handles missing baseline."""
    latest = get_latest_snapshot()
    if not latest:
        return jsonify({"error": "No snapshots recorded yet. Please run a scan first."}), 404

    baseline = get_baseline_snapshot()
    if not baseline:
        return jsonify({
            "error": "No baseline snapshot set yet. Please designate a snapshot as baseline.",
            "latest_scan_id": latest["scan_id"]
        }), 404

    # Diff latest snapshot against active baseline
    events, score = diff_snapshots(baseline, latest)

    return jsonify({
        "latest_scan_id": latest["scan_id"],
        "baseline_scan_id": baseline["scan_id"],
        "timestamp": latest["timestamp"],
        "blast_radius_score": score,
        "events": events
    })


@app.route("/api/drift/<id1>/<id2>", methods=["GET"])
@app.route("/drift/<id1>/<id2>", methods=["GET"])
def get_two_snapshots_drift(id1: str, id2: str):
    snap1 = get_snapshot(id1)
    snap2 = get_snapshot(id2)

    if not snap1 or not snap2:
        return jsonify({"error": "One or both snapshots could not be found."}), 404

    events, score = diff_snapshots(snap1, snap2)
    return jsonify({
        "base_scan_id": id1,
        "current_scan_id": id2,
        "blast_radius_score": score,
        "events": events
    })


@app.route("/api/deep-check", methods=["POST"])
@app.route("/deep-check", methods=["POST"])
def manual_deep_check():
    """
    Opt-in manual active localhost verification.
    Probes flagged localhost ports to verify unauthenticated access.
    NEVER invoked on schedule or during normal scans.
    """
    from backend.deep_check import run_deep_check_on_ports
    data = request.get_json(silent=True) or {}
    ports = data.get("ports", [])

    if not ports:
        latest = get_latest_snapshot()
        if latest:
            ports = [p["port"] for p in latest.get("listening_ports", []) if p.get("is_risky")]
        if not ports:
            ports = [2375, 11434]

    findings = run_deep_check_on_ports(ports)
    return jsonify({"ports_checked": ports, "findings": findings})


@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "service": "PermissionDrift"})


# Serve frontend dist build if present
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if app.static_folder and os.path.exists(app.static_folder):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, "index.html")
    return jsonify({"message": "PermissionDrift API is running."})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting PermissionDrift API on http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False)

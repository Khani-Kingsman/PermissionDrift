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


# ── AI Forensic Analysis (Powered by Google Gemini API) ───────────────────────
@app.route("/api/ai/status", methods=["GET"])
@app.route("/ai/status", methods=["GET"])
def get_ai_status():
    from backend.ai_analyzer import is_ai_configured
    configured = is_ai_configured()
    return jsonify({
        "configured": configured,
        "model": "gemini-2.5-flash",
        "provider": "google-genai"
    })


@app.route("/api/ai/set-key", methods=["POST"])
@app.route("/ai/set-key", methods=["POST"])
def set_ai_key():
    data = request.get_json(silent=True) or {}
    key = data.get("api_key", "").strip()
    if not key:
        return jsonify({"error": "No api_key provided."}), 400

    os.environ["GEMINI_API_KEY"] = key
    env_path = PROJECT_ROOT / ".env"
    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.write(f"GEMINI_API_KEY={key}\n")
    except Exception as e:
        logger.warning(f"Could not save .env: {e}")

    return jsonify({"success": True, "message": "Gemini API key configured successfully."})


@app.route("/api/ai/analyze-event", methods=["POST"])
@app.route("/ai/analyze-event", methods=["POST"])
def analyze_event_ai():
    from backend.ai_analyzer import analyze_drift_event
    data = request.get_json(silent=True) or {}
    event = data.get("event")
    if not event:
        return jsonify({"error": "Drift event object required in body."}), 400

    explicit_key = data.get("api_key")
    latest = get_latest_snapshot()
    context = {"host": latest.get("host", "Local Machine")} if latest else {}

    result = analyze_drift_event(event, context=context, explicit_key=explicit_key)
    return jsonify(result)


@app.route("/api/ai/report", methods=["POST"])
@app.route("/ai/report", methods=["POST"])
def generate_report_ai():
    from backend.ai_analyzer import generate_posture_report
    data = request.get_json(silent=True) or {}
    explicit_key = data.get("api_key")
    snapshot_id = data.get("snapshot_id")

    if snapshot_id:
        target_snap = get_snapshot(snapshot_id)
    else:
        target_snap = get_latest_snapshot()

    if not target_snap:
        return jsonify({"error": "No snapshot available to analyze."}), 404

    baseline = get_baseline_snapshot()
    events = []
    if baseline:
        events, _ = diff_snapshots(baseline, target_snap)

    result = generate_posture_report(
        snapshot=target_snap,
        baseline=baseline,
        drift_events=events,
        explicit_key=explicit_key
    )
    return jsonify(result)


# ── Background Security Engine & Autostart Controls ──────────────────────────
@app.route("/api/engine/status", methods=["GET"])
@app.route("/engine/status", methods=["GET"])
def get_engine_status():
    from backend.engine import engine
    return jsonify(engine.get_status())


@app.route("/api/engine/toggle", methods=["POST"])
@app.route("/engine/toggle", methods=["POST"])
def toggle_engine():
    from backend.engine import engine
    data = request.get_json(silent=True) or {}
    action = data.get("action")  # "start", "stop", or "toggle"
    interval = data.get("interval_sec", 300)

    if action == "start" or (action == "toggle" and not engine.is_running):
        engine.start(interval_sec=interval)
    elif action == "stop" or (action == "toggle" and engine.is_running):
        engine.stop()

    return jsonify(engine.get_status())


@app.route("/api/engine/autostart", methods=["POST"])
@app.route("/engine/autostart", methods=["POST"])
def toggle_autostart():
    from backend.autostart import set_autostart, is_autostart_enabled
    data = request.get_json(silent=True) or {}
    enable = data.get("enabled", not is_autostart_enabled())
    res = set_autostart(bool(enable))
    return jsonify(res)


@app.route("/api/engine/test-notification", methods=["POST"])
@app.route("/engine/test-notification", methods=["POST"])
def test_notification():
    from backend.notifier import notify_drift_event
    notify_drift_event(
        "🛡️ PermissionDrift Alert Test",
        "Windows Desktop notifications are active! Drift events will alert you here."
    )
    return jsonify({"success": True, "message": "Notification dispatched to Windows desktop."})


@app.route("/api/engine/scan-now", methods=["POST"])
@app.route("/engine/scan-now", methods=["POST"])
def engine_scan_now():
    from backend.engine import engine
    res = engine.run_single_cycle()
    return jsonify(res)


# ── Absolute Security: Rogue Process Quarantine ─────────────────────────────
SYSTEM_CRITICAL_PROCESSES = {
    "system", "system idle process", "registry", "smss.exe", "csrss.exe",
    "wininit.exe", "services.exe", "lsass.exe", "winlogon.exe", "explorer.exe"
}

@app.route("/api/process/terminate", methods=["POST"])
@app.route("/process/terminate", methods=["POST"])
def terminate_rogue_process():
    """Quarantines/terminates a rogue process holding unauthorized credential handles."""
    import psutil
    data = request.get_json(silent=True) or {}
    pid = data.get("pid")
    process_name = (data.get("process_name") or "").lower()

    if not pid:
        return jsonify({"error": "PID is required"}), 400

    if pid == os.getpid() or process_name in SYSTEM_CRITICAL_PROCESSES:
        return jsonify({"error": "Refusing to terminate critical system or engine process"}), 403

    try:
        proc = psutil.Process(pid)
        real_name = proc.name().lower()
        if real_name in SYSTEM_CRITICAL_PROCESSES:
            return jsonify({"error": "Refusing to terminate critical system process"}), 403

        proc.terminate()
        try:
            proc.wait(timeout=2)
        except psutil.TimeoutExpired:
            proc.kill()

        return jsonify({
            "success": True,
            "message": f"Process '{real_name}' (PID {pid}) quarantined and terminated successfully."
        })
    except psutil.NoSuchProcess:
        return jsonify({"success": True, "message": f"Process (PID {pid}) has already exited."})
    except Exception as e:
        return jsonify({"error": f"Failed to terminate PID {pid}: {str(e)}"}), 500


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

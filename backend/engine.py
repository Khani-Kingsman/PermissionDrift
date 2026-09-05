"""
PermissionDrift Continuous Background Security Engine.
Runs silent periodic scans, detects permission drift in real-time,
and dispatches Windows Desktop Toast notifications when unauthorized access is discovered.
"""

import time
import logging
import threading
from typing import Dict, Any, List, Optional

from backend.scanner import WindowsSecurityScanner
from backend.storage import (
    save_snapshot, get_latest_snapshot, get_baseline_snapshot,
    set_baseline
)
from backend.diff_engine import diff_snapshots
from backend.notifier import notify_drift_event
from backend.autostart import is_autostart_enabled, set_autostart

logger = logging.getLogger("PermissionDrift.Engine")

class SecurityEngine:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(SecurityEngine, cls).__new__(cls)
                cls._instance._init_engine()
            return cls._instance

    def _init_engine(self):
        self.is_running = False
        self.interval_sec = 300  # Default: 5 minutes
        self.notifications_enabled = True
        self.last_scan_time: Optional[float] = None
        self.last_blast_radius: int = 0
        self.scan_count: int = 0
        self.recent_alerts: List[Dict[str, Any]] = []
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def start(self, interval_sec: Optional[int] = None):
        """Starts the background monitoring loop in a daemon thread."""
        with self._lock:
            if interval_sec:
                self.interval_sec = max(60, interval_sec)
            if self.is_running:
                return
            self.is_running = True
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
            self._thread.start()
            logger.info(f"Security Engine started with {self.interval_sec}s interval.")
            if self.notifications_enabled:
                notify_drift_event(
                    "🛡️ PermissionDrift Engine Active",
                    "Continuous background monitoring initialized. Real-time drift alerts enabled."
                )

    def stop(self):
        """Signals the background monitor to stop."""
        with self._lock:
            if not self.is_running:
                return
            self.is_running = False
            self._stop_event.set()
            logger.info("Security Engine stopped.")

    def run_single_cycle(self) -> Dict[str, Any]:
        """Runs an individual scan cycle and dispatches alert if drift is detected."""
        try:
            self.last_scan_time = time.time()
            latest = get_latest_snapshot()
            prev_names = set(latest.get("all_process_names", [])) if latest else None
            baseline = get_baseline_snapshot()

            scanner = WindowsSecurityScanner(wall_clock_budget_sec=10.0)
            snapshot = scanner.run_scan(previous_process_names=prev_names)

            is_first = (latest is None)
            if is_first or not baseline:
                # First run automatically acts as baseline
                events, blast_score = [], 0
                snapshot["blast_radius_score"] = 0
                saved_id = save_snapshot(snapshot, is_baseline=True, blast_radius_score=0)
                self.last_blast_radius = 0
                return {"status": "baseline_established", "scan_id": saved_id}

            events, blast_score = diff_snapshots(baseline, snapshot)
            snapshot["blast_radius_score"] = blast_score
            saved_id = save_snapshot(snapshot, is_baseline=False, blast_radius_score=blast_score)

            delta = blast_score - self.last_blast_radius
            self.last_blast_radius = blast_score
            self.scan_count += 1

            # Check for new critical/warning drift events
            critical_events = [e for e in events if e.get("severity") in ("CRITICAL", "HIGH")]
            
            if (critical_events or delta > 0) and self.notifications_enabled:
                headline = critical_events[0]["headline"] if critical_events else f"Blast radius increased (+{delta})"
                title = f"🚨 PermissionDrift Alert: Blast Radius {blast_score}"
                body = f"{headline}. Open dashboard to review forensics."
                notify_drift_event(title, body)

                alert_record = {
                    "timestamp": time.time(),
                    "title": title,
                    "body": body,
                    "blast_radius": blast_score,
                    "event_count": len(events)
                }
                self.recent_alerts.insert(0, alert_record)
                if len(self.recent_alerts) > 20:
                    self.recent_alerts.pop()

            return {
                "status": "drift_evaluated",
                "scan_id": saved_id,
                "events_count": len(events),
                "blast_radius": blast_score
            }
        except Exception as e:
            logger.exception(f"Error in engine cycle: {e}")
            return {"status": "error", "error": str(e)}

    def _monitor_loop(self):
        """Continuous background execution loop."""
        # Initial scan on startup
        self.run_single_cycle()

        while not self._stop_event.is_set():
            # Wait for interval_sec, responsive to stop_event
            if self._stop_event.wait(timeout=self.interval_sec):
                break
            self.run_single_cycle()

    def get_status(self) -> Dict[str, Any]:
        """Returns comprehensive status for API and frontend display."""
        return {
            "running": self.is_running,
            "interval_sec": self.interval_sec,
            "last_scan_time": self.last_scan_time,
            "last_blast_radius": self.last_blast_radius,
            "scan_count": self.scan_count,
            "notifications_enabled": self.notifications_enabled,
            "autostart_enabled": is_autostart_enabled(),
            "recent_alerts": self.recent_alerts[:5]
        }

# Global instance
engine = SecurityEngine()

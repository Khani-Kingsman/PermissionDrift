"""
PermissionDrift — Local SQLite Snapshot Storage & Retention Management.

Stores and queries snapshot JSON blobs, manages the active baseline,
and automatically prunes non-baseline snapshots older than 30 days.
"""

import os
import json
import sqlite3
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional

logger = logging.getLogger("PermissionDriftStorage")

DB_PATH = Path(__file__).resolve().parent.parent / "snapshots.db"


def get_connection(db_path: Optional[Path] = None) -> sqlite3.Connection:
    path = db_path or DB_PATH
    conn = sqlite3.connect(str(path), timeout=10.0)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: Optional[Path] = None) -> None:
    """Initialize SQLite table and indices."""
    conn = get_connection(db_path)
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS snapshots (
                    scan_id TEXT PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    is_baseline INTEGER NOT NULL DEFAULT 0,
                    blast_radius_score INTEGER NOT NULL DEFAULT 0,
                    data_json TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp
                ON snapshots (timestamp DESC)
            """)
    finally:
        conn.close()


def save_snapshot(
    snapshot: Dict[str, Any],
    is_baseline: bool = False,
    blast_radius_score: int = 0,
    retention_days: int = 30,
    db_path: Optional[Path] = None
) -> str:
    """Saves a snapshot and automatically prunes non-baseline records older than retention_days."""
    init_db(db_path)
    conn = get_connection(db_path)
    scan_id = snapshot.get("scan_id")
    timestamp = snapshot.get("timestamp") or datetime.now(timezone.utc).isoformat()
    json_blob = json.dumps(snapshot)

    try:
        with conn:
            if is_baseline:
                conn.execute("UPDATE snapshots SET is_baseline = 0")

            conn.execute(
                """
                INSERT OR REPLACE INTO snapshots (scan_id, timestamp, is_baseline, blast_radius_score, data_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (scan_id, timestamp, 1 if is_baseline else 0, blast_radius_score, json_blob)
            )

        # Auto-prune non-baseline snapshots older than retention_days
        pruned_count = prune_old_snapshots(retention_days=retention_days, db_path=db_path)
        if pruned_count > 0:
            logger.info(f"Auto-pruned {pruned_count} snapshots older than {retention_days} days.")

        return scan_id
    finally:
        conn.close()


def get_snapshot(scan_id: str, db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM snapshots WHERE scan_id = ?", (scan_id,))
        row = cursor.fetchone()
        if not row:
            return None
        data = json.loads(row["data_json"])
        data["is_baseline"] = bool(row["is_baseline"])
        data["blast_radius_score"] = row["blast_radius_score"]
        return data
    finally:
        conn.close()


def get_latest_snapshot(db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM snapshots ORDER BY timestamp DESC LIMIT 1")
        row = cursor.fetchone()
        if not row:
            return None
        data = json.loads(row["data_json"])
        data["is_baseline"] = bool(row["is_baseline"])
        data["blast_radius_score"] = row["blast_radius_score"]
        return data
    finally:
        conn.close()


def get_baseline_snapshot(db_path: Optional[Path] = None) -> Optional[Dict[str, Any]]:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM snapshots WHERE is_baseline = 1 ORDER BY timestamp DESC LIMIT 1")
        row = cursor.fetchone()
        if not row:
            # Fallback to the earliest snapshot if no explicit baseline flag exists
            cursor.execute("SELECT * FROM snapshots ORDER BY timestamp ASC LIMIT 1")
            row = cursor.fetchone()
        if not row:
            return None
        data = json.loads(row["data_json"])
        data["is_baseline"] = bool(row["is_baseline"])
        data["blast_radius_score"] = row["blast_radius_score"]
        return data
    finally:
        conn.close()


def set_baseline(scan_id: str, db_path: Optional[Path] = None) -> bool:
    """Sets a specific scan as baseline; ensures only one baseline exists."""
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute("SELECT scan_id FROM snapshots WHERE scan_id = ?", (scan_id,))
            if not cursor.fetchone():
                return False
            cursor.execute("UPDATE snapshots SET is_baseline = 0")
            cursor.execute("UPDATE snapshots SET is_baseline = 1 WHERE scan_id = ?", (scan_id,))
        return True
    finally:
        conn.close()


def list_snapshots(limit: int = 50, db_path: Optional[Path] = None) -> List[Dict[str, Any]]:
    init_db(db_path)
    conn = get_connection(db_path)
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT scan_id, timestamp, is_baseline, blast_radius_score
            FROM snapshots
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (limit,)
        )
        rows = cursor.fetchall()
        return [
            {
                "scan_id": r["scan_id"],
                "timestamp": r["timestamp"],
                "is_baseline": bool(r["is_baseline"]),
                "blast_radius_score": r["blast_radius_score"]
            }
            for r in rows
        ]
    finally:
        conn.close()


def prune_old_snapshots(retention_days: int = 30, db_path: Optional[Path] = None) -> int:
    conn = get_connection(db_path)
    cutoff = (datetime.now(timezone.utc) - timedelta(days=retention_days)).isoformat()
    try:
        with conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM snapshots
                WHERE is_baseline = 0 AND timestamp < ?
                """,
                (cutoff,)
            )
            return cursor.rowcount
    finally:
        conn.close()

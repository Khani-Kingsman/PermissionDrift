"""
Self-check unit test for Phase 5 SQLite Storage.
"""

import os
import time
import unittest
from pathlib import Path
from datetime import datetime, timedelta, timezone

from backend.storage import (
    init_db, save_snapshot, get_snapshot, get_baseline_snapshot,
    set_baseline, list_snapshots, prune_old_snapshots, get_connection
)

TEST_DB = Path(__file__).resolve().parent / "test_snapshots.db"


class TestStoragePhase5(unittest.TestCase):
    def setUp(self):
        if TEST_DB.exists():
            TEST_DB.unlink()
        init_db(TEST_DB)

    def tearDown(self):
        if TEST_DB.exists():
            try:
                TEST_DB.unlink()
            except Exception:
                pass

    def test_two_scans_produce_distinct_rows(self):
        snap1 = {
            "scan_id": "scan-001",
            "timestamp": "2026-09-01T10:00:00Z",
            "sensitive_paths": []
        }
        snap2 = {
            "scan_id": "scan-002",
            "timestamp": "2026-09-01T10:30:00Z",
            "sensitive_paths": []
        }

        save_snapshot(snap1, is_baseline=True, db_path=TEST_DB)
        save_snapshot(snap2, is_baseline=False, db_path=TEST_DB)

        snaps = list_snapshots(db_path=TEST_DB)
        self.assertEqual(len(snaps), 2)
        self.assertEqual(snaps[0]["scan_id"], "scan-002")
        self.assertEqual(snaps[1]["scan_id"], "scan-001")

    def test_exactly_one_baseline_exists(self):
        snap1 = {"scan_id": "scan-001", "timestamp": "2026-09-01T10:00:00Z"}
        snap2 = {"scan_id": "scan-002", "timestamp": "2026-09-01T10:30:00Z"}
        save_snapshot(snap1, is_baseline=True, db_path=TEST_DB)
        save_snapshot(snap2, is_baseline=False, db_path=TEST_DB)

        base = get_baseline_snapshot(db_path=TEST_DB)
        self.assertEqual(base["scan_id"], "scan-001")

        # Switch baseline to snap2
        set_baseline("scan-002", db_path=TEST_DB)
        base_updated = get_baseline_snapshot(db_path=TEST_DB)
        self.assertEqual(base_updated["scan_id"], "scan-002")

        # Query raw table to verify exactly one row has is_baseline = 1
        conn = get_connection(TEST_DB)
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM snapshots WHERE is_baseline = 1")
            count = cursor.fetchone()[0]
            self.assertEqual(count, 1)
        finally:
            conn.close()

    def test_pruning_old_non_baseline_rows(self):
        # 1. Old baseline snapshot (40 days old) -> must NOT be pruned
        old_base = {
            "scan_id": "old-baseline",
            "timestamp": (datetime.now(timezone.utc) - timedelta(days=40)).isoformat()
        }
        save_snapshot(old_base, is_baseline=True, db_path=TEST_DB)

        # 2. Old non-baseline snapshot (45 days old) -> MUST be pruned
        old_non_base = {
            "scan_id": "old-prunable",
            "timestamp": (datetime.now(timezone.utc) - timedelta(days=45)).isoformat()
        }
        # Insert without auto-pruning to test pruning trigger
        save_snapshot(old_non_base, is_baseline=False, retention_days=100, db_path=TEST_DB)

        # Confirm 2 rows exist
        self.assertEqual(len(list_snapshots(db_path=TEST_DB)), 2)

        # 3. New snapshot (today) with retention_days=30 triggers pruning of old_non_base
        new_snap = {
            "scan_id": "new-today",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        save_snapshot(new_snap, is_baseline=False, retention_days=30, db_path=TEST_DB)

        snaps = list_snapshots(db_path=TEST_DB)
        scan_ids = [s["scan_id"] for s in snaps]
        self.assertIn("old-baseline", scan_ids)
        self.assertIn("new-today", scan_ids)
        self.assertNotIn("old-prunable", scan_ids)


if __name__ == "__main__":
    unittest.main()

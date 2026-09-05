"""
Self-check unit test for Phase 7 Flask API.
"""

import time
import unittest
from backend.app import app
from backend.storage import init_db, get_connection, DB_PATH


class TestAPIPhase7(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        init_db()

    def test_post_scan_returns_under_100ms(self):
        start = time.time()
        res = self.client.post("/api/scan", json={"is_baseline": True})
        elapsed_ms = (time.time() - start) * 1000

        self.assertEqual(res.status_code, 202)
        data = res.get_json()
        self.assertIn("job_id", data)
        self.assertEqual(data.get("status"), "pending")
        # Assert returned in well under 100ms
        self.assertLess(elapsed_ms, 100.0, f"POST /scan took {elapsed_ms}ms; should be < 100ms")
        print(f"POST /scan returned in {elapsed_ms:.2f}ms (Target: < 100ms).")

    def test_polling_job_transitions(self):
        res = self.client.post("/api/scan")
        self.assertEqual(res.status_code, 202)
        job_id = res.get_json()["job_id"]

        # Poll job status
        states_seen = set()
        start = time.time()
        final_job = None

        while time.time() - start < 15.0:
            poll_res = self.client.get(f"/api/jobs/{job_id}")
            self.assertEqual(poll_res.status_code, 200)
            job_data = poll_res.get_json()
            st = job_data.get("status")
            states_seen.add(st)
            if st in ("done", "failed"):
                final_job = job_data
                break
            time.sleep(0.3)

        self.assertIsNotNone(final_job)
        self.assertEqual(final_job.get("status"), "done")
        self.assertIsNotNone(final_job.get("snapshot_id"))
        self.assertTrue("running" in states_seen or "done" in states_seen)

    def test_drift_with_no_baseline_returns_clean_message_not_crash(self):
        # Clear snapshots table to test empty database drift call
        conn = get_connection()
        try:
            with conn:
                conn.execute("DELETE FROM snapshots")
        finally:
            conn.close()

        res = self.client.get("/api/drift")
        # Should return 404 with friendly JSON error, not 500 or stack trace
        self.assertEqual(res.status_code, 404)
        data = res.get_json()
        self.assertIn("error", data)
        self.assertIn("No snapshots recorded", data["error"])


if __name__ == "__main__":
    unittest.main()

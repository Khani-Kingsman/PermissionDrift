"""
Tests for AI Forensic Analyzer (Google Gemini integration).
"""

import unittest
from backend.ai_analyzer import (
    analyze_drift_event, generate_posture_report,
    get_gemini_api_key, is_ai_configured
)


class TestAIAnalyzer(unittest.TestCase):

    def test_unconfigured_fallback(self):
        # Should gracefully return structured forensic response when no key is set
        event = {
            "event_id": "test-1",
            "category": "ipc_exposure",
            "resource": "Port 2375 (Docker API)",
            "accessor": "docker.exe",
            "previous_state": "closed",
            "current_state": "LISTEN on 127.0.0.1:2375",
            "severity": "critical",
            "impact_statement": "Docker daemon unauthenticated port open."
        }
        res = analyze_drift_event(event)
        self.assertIn("ai_powered", res)
        self.assertIn("forensic_summary", res)
        self.assertIn("threat_vector", res)
        self.assertIn("recommended_actions", res)

    def test_posture_report_fallback(self):
        snapshot = {
            "host": "TEST-HOST",
            "timestamp": "2026-09-05T12:00:00Z",
            "blast_radius_score": 45,
            "listening_ports": [{"port": 2375, "is_risky": True, "process_name": "docker"}],
            "sensitive_paths": [{"name": "ssh_dir", "exists": True}],
            "browser_extensions": []
        }
        report = generate_posture_report(snapshot)
        self.assertIn("ai_powered", report)
        self.assertEqual(report["host"], "TEST-HOST")


if __name__ == "__main__":
    unittest.main()

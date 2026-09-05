"""
Self-check unit test for Phase 6 Diff Engine & Risk Rules.
"""

import unittest
from backend.diff_engine import diff_snapshots, calculate_blast_radius


class TestDiffEnginePhase6(unittest.TestCase):
    def test_diff_snapshot_against_itself(self):
        snap = {
            "timestamp": "2026-09-01T10:00:00Z",
            "sensitive_paths": [
                {
                    "name": "ssh_dir",
                    "path": "C:\\Users\\default\\.ssh",
                    "exists": True,
                    "permissions": "700",
                    "accessed_by_processes": ["ssh-agent.exe"]
                }
            ],
            "docker_socket_accessible_by": ["docker.exe"],
            "browser_extensions": [
                {
                    "id": "ext1",
                    "name": "Grammar Checker",
                    "permissions": ["tabs"],
                    "host_permissions": []
                }
            ],
            "cli_tools": ["git", "ssh"],
            "listening_ports": []
        }

        events, score = diff_snapshots(snap, snap)
        self.assertEqual(len(events), 0)
        self.assertEqual(score, 0)

    def test_gained_aws_access_produces_critical_event(self):
        base = {
            "timestamp": "2026-09-01T10:00:00Z",
            "sensitive_paths": [
                {
                    "name": "aws_dir",
                    "path": "C:\\Users\\default\\.aws",
                    "exists": True,
                    "permissions": "700",
                    "accessed_by_processes": []
                }
            ],
            "docker_socket_accessible_by": [],
            "browser_extensions": [],
            "cli_tools": [],
            "listening_ports": []
        }

        # Current differs ONLY by VSCode gaining access to ~/.aws
        current = {
            "timestamp": "2026-09-01T11:00:00Z",
            "sensitive_paths": [
                {
                    "name": "aws_dir",
                    "path": "C:\\Users\\default\\.aws",
                    "exists": True,
                    "permissions": "700",
                    "accessed_by_processes": ["Code.exe"]
                }
            ],
            "docker_socket_accessible_by": [],
            "browser_extensions": [],
            "cli_tools": [],
            "listening_ports": []
        }

        events, score = diff_snapshots(base, current)
        self.assertEqual(len(events), 1)
        ev = events[0]
        self.assertEqual(ev["category"], "credential_access")
        self.assertEqual(ev["accessor"], "Code.exe")
        self.assertEqual(ev["change_type"], "gained_access")
        self.assertEqual(ev["severity"], "critical")
        self.assertTrue(len(ev["remediation"]) > 0)
        self.assertIn("aws sts get-session-token", ev["remediation"])
        # Critical severity weight is 25
        self.assertEqual(score, 25)

    def test_blast_radius_score_direction(self):
        # Base with Code.exe accessing ~/.aws (score = 25)
        base = {
            "timestamp": "2026-09-01T10:00:00Z",
            "sensitive_paths": [
                {
                    "name": "aws_dir",
                    "path": "C:\\Users\\default\\.aws",
                    "exists": True,
                    "permissions": "700",
                    "accessed_by_processes": ["Code.exe"]
                }
            ],
            "docker_socket_accessible_by": [],
            "browser_extensions": [],
            "cli_tools": []
        }

        # Current 1: Additional Docker access gained -> score goes UP
        current_gained = {
            "timestamp": "2026-09-01T11:00:00Z",
            "sensitive_paths": base["sensitive_paths"],
            "docker_socket_accessible_by": ["wsl.exe"],
            "browser_extensions": [],
            "cli_tools": []
        }
        events_up, score_up = diff_snapshots(base, current_gained)
        self.assertGreater(score_up, 0)
        self.assertEqual(score_up, 25)  # wsl.exe gained docker access = 25

        # Current 2: Access revoked (Code.exe no longer accessing ~/.aws) -> score is 0
        current_revoked = {
            "timestamp": "2026-09-01T11:00:00Z",
            "sensitive_paths": [
                {
                    "name": "aws_dir",
                    "path": "C:\\Users\\default\\.aws",
                    "exists": True,
                    "permissions": "700",
                    "accessed_by_processes": []
                }
            ],
            "docker_socket_accessible_by": [],
            "browser_extensions": [],
            "cli_tools": []
        }
        events_down, score_down = diff_snapshots(base, current_revoked)
        self.assertEqual(len(events_down), 1)
        self.assertEqual(events_down[0]["change_type"], "lost_access")
        self.assertEqual(score_down, 0)


if __name__ == "__main__":
    unittest.main()

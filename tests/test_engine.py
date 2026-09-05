import unittest
from backend.engine import SecurityEngine
from backend.autostart import is_autostart_enabled

class TestEngine(unittest.TestCase):
    def setUp(self):
        self.engine = SecurityEngine()

    def test_engine_singleton_and_status(self):
        engine2 = SecurityEngine()
        self.assertIs(self.engine, engine2)
        status = self.engine.get_status()
        self.assertIn("running", status)
        self.assertIn("interval_sec", status)
        self.assertIn("autostart_enabled", status)
        self.assertIn("notifications_enabled", status)

    def test_autostart_permanently_disabled(self):
        self.assertFalse(is_autostart_enabled())

if __name__ == "__main__":
    unittest.main()

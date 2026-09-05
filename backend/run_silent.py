"""
PermissionDrift Silent Daemon Launcher.
Runs the Flask API and continuous Security Engine in the background with zero terminal window.
"""

import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app import app
from backend.engine import engine

if __name__ == "__main__":
    # Start continuous background monitoring thread
    engine.start(interval_sec=300)
    
    port = int(os.environ.get("PORT", 5000))
    # Run Flask server locally
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)

r"""
Windows Autostart Manager for PermissionDrift.
Uses standard Windows Registry (HKCU\Software\Microsoft\Windows\CurrentVersion\Run)
to enable/disable silent automatic startup on Windows boot/login without requiring Admin privileges.
"""

import sys
import os
import winreg
from pathlib import Path
from typing import Dict, Any

REG_PATH = r"Software\Microsoft\Windows\CurrentVersion\Run"
APP_NAME = "PermissionDrift"

def get_launch_command() -> str:
    """Returns the windowless execution command for PermissionDrift using pythonw.exe."""
    project_root = Path(__file__).resolve().parent.parent
    python_dir = Path(sys.executable).parent
    pythonw = python_dir / "pythonw.exe"
    if not pythonw.exists():
        pythonw = Path(sys.executable)

    target_script = project_root / "backend" / "run_silent.py"
    return f'"{pythonw}" "{target_script}"'

def is_autostart_enabled() -> bool:
    """Checks whether PermissionDrift is registered in HKCU Run."""
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_PATH, 0, winreg.KEY_READ) as key:
            winreg.QueryValueEx(key, APP_NAME)
            return True
    except FileNotFoundError:
        return False
    except Exception:
        return False

def set_autostart(enabled: bool) -> Dict[str, Any]:
    """Enables or disables autostart in Windows Registry."""
    try:
        if enabled:
            cmd = get_launch_command()
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_PATH, 0, winreg.KEY_SET_VALUE) as key:
                winreg.SetValueEx(key, APP_NAME, 0, winreg.REG_SZ, cmd)
            return {"success": True, "enabled": True, "command": cmd}
        else:
            if is_autostart_enabled():
                with winreg.OpenKey(winreg.HKEY_CURRENT_USER, REG_PATH, 0, winreg.KEY_SET_VALUE) as key:
                    winreg.DeleteValue(key, APP_NAME)
            return {"success": True, "enabled": False}
    except Exception as e:
        return {"success": False, "error": str(e), "enabled": is_autostart_enabled()}

if __name__ == "__main__":
    print("Autostart status:", is_autostart_enabled())
    print("Launch command:", get_launch_command())

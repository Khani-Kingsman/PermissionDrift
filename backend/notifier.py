"""
Windows Toast Notification Dispatcher for PermissionDrift.
Features:
1. Native Windows Runtime (WinRT) Toast with interactive URL protocol click redirect.
2. Focus Assist / Full-Screen Gaming Detection (via SHQueryUserNotificationState).
3. Intelligent Deferred Queue: If user is gaming or busy, notification is queued
   and quietly delivered as soon as the user returns to normal desktop mode.
4. SW_HIDE / CREATE_NO_WINDOW so no console window ever flashes.
"""

import subprocess
import logging
import threading
import time
import ctypes
from typing import List, Dict, Optional

logger = logging.getLogger("PermissionDrift.Notifier")

# Queue for notifications deferred while gaming/busy
_PENDING_QUEUE: List[Dict[str, str]] = []
_QUEUE_LOCK = threading.Lock()
_DRAIN_THREAD_STARTED = False

def is_user_gaming_or_busy() -> bool:
    """
    Queries Windows Shell API (SHQueryUserNotificationState).
    Returns True if user is in full-screen D3D gaming, presentation, or busy state.
    QUNS_ACCEPTS_NOTIFICATIONS = 5 (Standard desktop, safe to notify)
    """
    try:
        state = ctypes.c_int()
        res = ctypes.windll.shell32.SHQueryUserNotificationState(ctypes.byref(state))
        if res == 0:
            # 5 = QUNS_ACCEPTS_NOTIFICATIONS. Any other state (2=busy, 3=D3D full screen, 4=presentation) means gaming/busy.
            return state.value != 5
        return False
    except Exception:
        return False

def _dispatch_toast_now(title: str, message: str, redirect_url: str = "http://127.0.0.1:5000/#drift-events"):
    """Dispatches PowerShell WinRT toast notification with protocol link redirect."""
    try:
        safe_title = title.replace('"', '`"').replace("'", "''")
        safe_message = message.replace('"', '`"').replace("'", "''")
        safe_url = redirect_url.replace('"', '`"').replace("'", "''")

        ps_script = f"""
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$template = @"
<toast launch="{safe_url}" activationType="protocol">
    <visual>
        <binding template="ToastGeneric">
            <text>{safe_title}</text>
            <text>{safe_message}</text>
            <text>Click to inspect threat forensics &amp; remediation in PermissionDrift</text>
        </binding>
    </visual>
    <actions>
        <action content="Inspect Incident →" arguments="{safe_url}" activationType="protocol"/>
    </actions>
</toast>
"@
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($template)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("PermissionDrift").Show($toast)
"""

        startupinfo = subprocess.STARTUPINFO()
        startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
        startupinfo.wShowWindow = 0  # SW_HIDE
        creationflags = subprocess.CREATE_NO_WINDOW

        subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps_script],
            startupinfo=startupinfo,
            creationflags=creationflags,
            timeout=8,
            capture_output=True,
            check=False
        )
    except Exception as e:
        logger.warning(f"Failed to dispatch toast: {e}")

def _queue_worker():
    """Background monitor that drains enqueued notifications once gaming/busy state ends."""
    while True:
        time.sleep(5)
        with _QUEUE_LOCK:
            if not _PENDING_QUEUE:
                continue
            # If user has returned to desktop and is no longer gaming
            if not is_user_gaming_or_busy():
                item = _PENDING_QUEUE.pop(0)
                _dispatch_toast_now(item["title"], item["message"], item["url"])

def notify_drift_event(
    title: str,
    message: str,
    redirect_url: str = "http://127.0.0.1:5000/#drift-events",
    force: bool = False
):
    """
    Dispatches a native Windows notification.
    If the user is currently gaming or in a full-screen application, defers the notification
    until gaming/full-screen finishes to avoid disrupting performance or gameplay.
    """
    global _DRAIN_THREAD_STARTED

    # Start queue watcher thread once
    if not _DRAIN_THREAD_STARTED:
        t_drain = threading.Thread(target=_queue_worker, daemon=True)
        t_drain.start()
        _DRAIN_THREAD_STARTED = True

    if not force and is_user_gaming_or_busy():
        logger.info("User is in gaming/full-screen/busy mode. Enqueueing notification until done.")
        with _QUEUE_LOCK:
            _PENDING_QUEUE.append({"title": title, "message": message, "url": redirect_url})
            # Cap queue to avoid flood
            if len(_PENDING_QUEUE) > 5:
                _PENDING_QUEUE.pop(0)
        return

    # Dispatch immediately
    t = threading.Thread(target=_dispatch_toast_now, args=(title, message, redirect_url), daemon=True)
    t.start()

if __name__ == "__main__":
    print("Gaming / Busy state:", is_user_gaming_or_busy())
    print("Testing immediate notification...")
    notify_drift_event("🛡️ PermissionDrift Alert", "Test notification with click-to-redirect", force=True)
    time.sleep(2)
    print("Dispatched.")

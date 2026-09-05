"""
Windows Toast Notification Dispatcher for PermissionDrift.
Uses native Windows Runtime (WinRT) ToastNotificationManager via PowerShell
with SW_HIDE / CREATE_NO_WINDOW so no console window ever flashes.
"""

import subprocess
import logging
import threading

logger = logging.getLogger("PermissionDrift.Notifier")

def _send_toast_worker(title: str, message: str):
    """Executes PowerShell toast notification silently in background thread."""
    try:
        # Escape single and double quotes
        safe_title = title.replace('"', '`"').replace("'", "''")
        safe_message = message.replace('"', '`"').replace("'", "''")

        ps_script = f"""
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$template = @"
<toast duration="short">
    <visual>
        <binding template="ToastGeneric">
            <text>{safe_title}</text>
            <text>{safe_message}</text>
        </binding>
    </visual>
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
        logger.warning(f"Failed to dispatch Windows toast notification: {e}")

def notify_drift_event(title: str, message: str):
    """Non-blocking fire-and-forget toast notification."""
    t = threading.Thread(target=_send_toast_worker, args=(title, message), daemon=True)
    t.start()

if __name__ == "__main__":
    import time
    print("Testing toast notification...")
    notify_drift_event("🛡️ PermissionDrift Active", "Silent background monitoring initialized.")
    time.sleep(2)
    print("Dispatched.")

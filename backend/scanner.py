"""
PermissionDrift — Local-First Windows Security Posture Scanner.

Safely collects machine posture metadata across sensitive developer directories,
Docker named pipes, process handles, browser extensions, listening ports, and CLI tools.
Enforces low process priority, per-process timeouts, and zero file content reads.
"""

import os
import sys
import time
import json
import uuid
import ctypes
import shutil
import logging
import platform
import concurrent.futures
from pathlib import Path
from typing import Dict, List, Any, Optional, Set

try:
    import psutil
except ImportError:
    psutil = None

# Configure plaintext audit logging
LOG_FILE = Path(__file__).resolve().parent.parent / "permissiondrift.log"
logging.basicConfig(
    filename=str(LOG_FILE),
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("PermissionDriftScanner")

# Win32 Constants for Named Pipe Detection
GENERIC_READ = 0x80000000
OPEN_EXISTING = 3
INVALID_HANDLE_VALUE = -1
ERROR_PIPE_BUSY = 231
ERROR_FILE_NOT_FOUND = 2

SYSTEM_PROCESS_BLACKLIST = {
    "system", "system idle process", "registry", "smss.exe", "csrss.exe",
    "wininit.exe", "services.exe", "lsass.exe", "svchost.exe", "fontdrvhost.exe",
    "memory compression", "winlogon.exe", "dwm.exe", "spoolsv.exe", "sihost.exe",
    "taskhostw.exe", "explorer.exe", "runtimebroker.exe", "searchhost.exe",
    "startmenuexperiencehost.exe", "shellexperiencehost.exe", "ctfmon.exe",
    "securityhealthservice.exe", "msmpeng.exe", "nissrv.exe"
}

WATCHLIST_PROCESS_NAMES = {
    "chrome.exe", "msedge.exe", "firefox.exe",
    "code.exe", "cursor.exe", "windowsterminal.exe",
    "docker.exe", "dockerd.exe", "kubectl.exe", "aws.exe", "az.exe", "gcloud.cmd",
    "ssh.exe", "ollama.exe", "claude.exe", "wsl.exe", "com.docker.backend.exe",
    "node.exe", "python.exe", "cmd.exe", "powershell.exe", "pwsh.exe"
}

DOCKER_PROCESS_NAMES = {"docker.exe", "dockerd.exe", "com.docker.backend.exe", "wsl.exe"}

AI_AGENT_KEYWORDS = [
    "mcp", "ollama", "cursor", "claude", "model-context-protocol",
    "@modelcontextprotocol", "anthropic", "openai"
]

# Known CLI tools watchlist on PATH
CLI_TOOLS_WATCHLIST = [
    "docker", "kubectl", "aws", "az", "gcloud", "gh", "terraform",
    "ssh", "git", "python", "node"
]

# Known risky ports if found in LISTEN state on localhost
RISKY_PORTS = {
    2375: "Docker Daemon (Unauthenticated HTTP API)",
    2376: "Docker Daemon (TLS Socket)",
    6379: "Redis Database (Default No-Auth)",
    9200: "Elasticsearch REST API",
    11434: "Ollama Local LLM API",
    27017: "MongoDB Database",
    5432: "PostgreSQL Database",
    3306: "MySQL Database",
    8080: "Generic Dev HTTP Server",
    3000: "Node Dev Server",
    5000: "Flask / Python Dev Server"
}


def set_process_priority_below_normal() -> bool:
    if not psutil:
        return False
    try:
        p = psutil.Process()
        if hasattr(psutil, "BELOW_NORMAL_PRIORITY_CLASS"):
            p.nice(psutil.BELOW_NORMAL_PRIORITY_CLASS)
            logger.info("Scanner priority configured to BELOW_NORMAL_PRIORITY_CLASS.")
            return True
    except Exception as e:
        logger.warning(f"Could not set process priority: {e}")
    return False


def get_process_priority_nice() -> Optional[int]:
    if psutil:
        try:
            return psutil.Process().nice()
        except Exception:
            return None
    return None


def check_docker_named_pipe() -> Dict[str, Any]:
    pipe_path = r"\\.\pipe\docker_engine"
    result = {
        "name": "docker_pipe",
        "path": pipe_path,
        "exists": False,
        "is_dir": False,
        "permissions": "pipe",
        "last_modified": None,
        "size_bytes": 0,
        "status": "not_found",
        "accessed_by_processes": []
    }

    try:
        handle = ctypes.windll.kernel32.CreateFileW(
            pipe_path,
            GENERIC_READ,
            0,
            None,
            OPEN_EXISTING,
            0,
            None
        )

        if handle != INVALID_HANDLE_VALUE:
            ctypes.windll.kernel32.CloseHandle(handle)
            result["exists"] = True
            result["status"] = "active"
            logger.info("Docker named pipe detected: handle acquired.")
        else:
            last_err = ctypes.windll.kernel32.GetLastError()
            if last_err == ERROR_PIPE_BUSY:
                result["exists"] = True
                result["status"] = "busy_active"
                logger.info("Docker named pipe detected: pipe busy (active daemon).")
            else:
                result["exists"] = False
                result["status"] = f"absent_code_{last_err}"
                logger.info(f"Docker named pipe absent (WinError {last_err}).")
    except Exception as e:
        logger.warning(f"Exception during Docker named pipe query: {e}")
        result["exists"] = False
        result["status"] = f"error: {str(e)}"

    return result


def get_sensitive_paths_config() -> Dict[str, Path]:
    user_profile = Path(os.environ.get("USERPROFILE", "C:\\Users\\Default"))
    app_data = Path(os.environ.get("APPDATA", str(user_profile / "AppData" / "Roaming")))

    return {
        "ssh_dir": user_profile / ".ssh",
        "aws_dir": user_profile / ".aws",
        "azure_dir": user_profile / ".azure",
        "kube_config": user_profile / ".kube" / "config",
        "gcloud_config": app_data / "gcloud"
    }


def scan_sensitive_filesystem_paths() -> List[Dict[str, Any]]:
    results = []
    paths_config = get_sensitive_paths_config()

    for name, p in paths_config.items():
        path_str = str(p)
        entry = {
            "name": name,
            "path": path_str,
            "exists": False,
            "is_dir": False,
            "permissions": None,
            "last_modified": None,
            "size_bytes": 0,
            "accessed_by_processes": []
        }

        try:
            if p.exists():
                st = p.stat()
                entry["exists"] = True
                entry["is_dir"] = p.is_dir()
                entry["permissions"] = oct(st.st_mode)[-3:]
                entry["last_modified"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(st.st_mtime))
                entry["size_bytes"] = st.st_size
            else:
                entry["exists"] = False
        except Exception as e:
            logger.info(f"Metadata read error for {path_str}: {e}")
            entry["exists"] = False

        results.append(entry)

    return results


def _inspect_single_process(
    proc: Any,
    executor: concurrent.futures.ThreadPoolExecutor,
    per_proc_timeout_sec: float = 0.2
) -> Optional[Dict[str, Any]]:
    def _target():
        try:
            info = {}
            info["pid"] = proc.pid
            info["name"] = proc.name()
            info["ppid"] = proc.ppid()

            try:
                cmd = proc.cmdline()
                info["cmdline"] = " ".join(cmd) if cmd else ""
                info["cmd_args"] = cmd or []
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                info["cmdline"] = ""
                info["cmd_args"] = []

            cmd_lower = info["cmdline"].lower()
            if "--type=renderer" in cmd_lower or "--type=crashpad-handler" in cmd_lower:
                info["open_files"] = []
                return info

            try:
                open_files = proc.open_files()
                info["open_files"] = [f.path for f in open_files if f and f.path]
            except (psutil.AccessDenied, psutil.NoSuchProcess):
                info["open_files"] = []

            return info
        except (psutil.AccessDenied, psutil.NoSuchProcess):
            return None
        except Exception as e:
            logger.debug(f"Process inspection exception for PID {getattr(proc, 'pid', 'unknown')}: {e}")
            return None

    future = executor.submit(_target)
    try:
        return future.result(timeout=per_proc_timeout_sec)
    except concurrent.futures.TimeoutError:
        logger.debug(f"PID {proc.pid} handle inspection timed out (> {per_proc_timeout_sec}s). Skipping.")
        return None
    except Exception as e:
        logger.debug(f"Handle inspection worker error: {e}")
        return None


def scan_processes_and_handles(
    sensitive_paths: List[Dict[str, Any]],
    previous_process_names: Optional[Set[str]] = None,
    wall_clock_budget_sec: float = 10.0,
    start_time: Optional[float] = None
) -> Dict[str, Any]:
    if not psutil:
        return {
            "process_handles": [],
            "process_tree": [],
            "docker_socket_accessible_by": [],
            "cross_workspace_access": [],
            "all_process_names": []
        }

    scan_start = start_time or time.time()

    all_procs = []
    all_process_names = set()
    for p in psutil.process_iter(["pid", "name", "ppid"]):
        try:
            name = p.info.get("name") or ""
            if name.lower() not in SYSTEM_PROCESS_BLACKLIST:
                all_procs.append(p)
                all_process_names.add(name.lower())
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    sensitive_dir_prefixes = []
    for s in sensitive_paths:
        if s["exists"] and s["name"] != "docker_pipe":
            norm_p = os.path.normpath(s["path"]).lower()
            sensitive_dir_prefixes.append((s["path"], norm_p))

    process_handles = []
    process_tree = []
    docker_accessible_by = set()
    cross_workspace_access = []
    workspace_map: Dict[int, str] = {}

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as proc_executor:
        for proc in all_procs:
            if (time.time() - scan_start) > wall_clock_budget_sec:
                break

            p_name = (proc.info.get("name") or "").lower()
            is_watchlisted = (
                p_name in WATCHLIST_PROCESS_NAMES or
                (previous_process_names is not None and p_name not in previous_process_names)
            )

            if not is_watchlisted:
                continue

            proc_details = _inspect_single_process(proc, proc_executor, per_proc_timeout_sec=0.2)
            if not proc_details:
                continue

            pid = proc_details["pid"]
            name = proc_details["name"]
            ppid = proc_details["ppid"]
            cmdline = proc_details["cmdline"]
            open_files = proc_details["open_files"]

            is_ai_agent = any(k in cmdline.lower() for k in AI_AGENT_KEYWORDS) or p_name in {"ollama.exe", "claude.exe", "cursor.exe"}

            if p_name in DOCKER_PROCESS_NAMES:
                docker_accessible_by.add(name)

            workspace_path = None
            if "code" in p_name or "cursor" in p_name:
                for arg in proc_details.get("cmd_args", []):
                    if os.path.isabs(arg) and os.path.isdir(arg) and not arg.lower().startswith("c:\\windows"):
                        workspace_path = os.path.normpath(arg)
                        workspace_map[pid] = workspace_path.lower()
                        break

            tree_entry = {
                "pid": pid,
                "ppid": ppid,
                "name": name,
                "cmdline": cmdline[:250],
                "workspace_path": workspace_path,
                "is_ai_agent": is_ai_agent,
                "parent_name": None
            }
            process_tree.append(tree_entry)

            sensitive_handles_found = []
            for fpath in open_files:
                norm_f = os.path.normpath(fpath).lower()

                for orig_path, norm_prefix in sensitive_dir_prefixes:
                    if norm_f.startswith(norm_prefix):
                        sensitive_handles_found.append(fpath)
                        for sp in sensitive_paths:
                            if sp["path"] == orig_path and name not in sp["accessed_by_processes"]:
                                sp["accessed_by_processes"].append(name)

                if workspace_path:
                    norm_ws = workspace_path.lower()
                    if not norm_f.startswith(norm_ws) and (norm_f.endswith(".env") or norm_f.endswith("config.json") or norm_f.endswith(".git\\config")):
                        if "appdata" not in norm_f and "temp" not in norm_f:
                            cross_workspace_access.append({
                                "pid": pid,
                                "process_name": name,
                                "workspace": workspace_path,
                                "accessed_path": fpath,
                                "is_heuristic": True
                            })

            if sensitive_handles_found:
                process_handles.append({
                    "process_name": name,
                    "pid": pid,
                    "is_ai_agent": is_ai_agent,
                    "open_handles": list(set(sensitive_handles_found))
                })

    pid_name_map = {t["pid"]: t["name"] for t in process_tree}
    for t in process_tree:
        t["parent_name"] = pid_name_map.get(t["ppid"])

    return {
        "process_handles": process_handles,
        "process_tree": process_tree,
        "docker_socket_accessible_by": list(docker_accessible_by),
        "cross_workspace_access": cross_workspace_access,
        "all_process_names": list(all_process_names)
    }


def scan_browser_extensions() -> List[Dict[str, Any]]:
    extensions = []
    local_app_data = Path(os.environ.get("LOCALAPPDATA", "C:\\Users\\Default\\AppData\\Local"))

    browser_paths = [
        ("chrome", local_app_data / "Google" / "Chrome" / "User Data"),
        ("edge", local_app_data / "Microsoft" / "Edge" / "User Data")
    ]

    for browser_name, base_path in browser_paths:
        if not base_path.exists():
            continue

        try:
            profile_dirs = [p for p in base_path.iterdir() if p.is_dir() and (p.name == "Default" or p.name.startswith("Profile"))]
        except (PermissionError, OSError):
            profile_dirs = []

        for prof in profile_dirs:
            ext_root = prof / "Extensions"
            if not ext_root.exists() or not ext_root.is_dir():
                continue

            try:
                ext_dirs = [d for d in ext_root.iterdir() if d.is_dir()]
            except (PermissionError, OSError):
                continue

            for ext_dir in ext_dirs:
                ext_id = ext_dir.name
                try:
                    ver_dirs = [v for v in ext_dir.iterdir() if v.is_dir()]
                except (PermissionError, OSError):
                    continue

                for ver_dir in ver_dirs:
                    manifest_path = ver_dir / "manifest.json"
                    if manifest_path.exists():
                        try:
                            with open(manifest_path, "r", encoding="utf-8", errors="ignore") as mf:
                                data = json.load(mf)
                                name = data.get("name", "Unknown Extension")
                                if str(name).startswith("__MSG_"):
                                    name = f"{ext_id} (Localized)"
                                permissions = data.get("permissions", [])
                                host_permissions = data.get("host_permissions", [])

                                perm_list = [str(p) for p in permissions] if isinstance(permissions, list) else []
                                host_list = [str(h) for h in host_permissions] if isinstance(host_permissions, list) else []
                                has_all_urls = any("<all_urls>" in p or "*://*/*" in p for p in (perm_list + host_list))

                                extensions.append({
                                    "browser": browser_name,
                                    "profile": prof.name,
                                    "id": ext_id,
                                    "name": str(name),
                                    "version": str(data.get("version", ver_dir.name)),
                                    "permissions": perm_list,
                                    "host_permissions": host_list,
                                    "has_all_urls": has_all_urls
                                })
                                break
                        except (PermissionError, OSError, json.JSONDecodeError) as e:
                            logger.warning(f"Skipping locked/unreadable extension manifest {ext_id}: {e}")
                            continue

    return extensions


def scan_passive_listening_ports() -> List[Dict[str, Any]]:
    """
    Passive enumeration of listening local ports.
    SECURITY GUARANTEE:
    This function strictly queries the local kernel connection table via psutil.net_connections().
    It makes ZERO outbound or inbound network connections (no connect(), no bind(), no HTTP requests).
    """
    if not psutil:
        return []

    listening_ports = []
    try:
        conns = psutil.net_connections(kind="inet")
        pid_name_cache: Dict[int, str] = {}

        for c in conns:
            if c.status == "LISTEN":
                laddr = c.laddr
                ip = getattr(laddr, "ip", "127.0.0.1")
                port = getattr(laddr, "port", 0)

                # Filter to localhost or all-interface sockets
                if ip in ("127.0.0.1", "0.0.0.0", "::1", "::") and port > 0:
                    pid = c.pid
                    proc_name = "unknown"
                    if pid:
                        if pid not in pid_name_cache:
                            try:
                                proc_name = psutil.Process(pid).name()
                            except Exception:
                                proc_name = "unknown"
                            pid_name_cache[pid] = proc_name
                        else:
                            proc_name = pid_name_cache[pid]

                    is_risky = port in RISKY_PORTS
                    desc = RISKY_PORTS.get(port, "Local Network Service")

                    listening_ports.append({
                        "port": port,
                        "ip": ip,
                        "pid": pid,
                        "process_name": proc_name,
                        "is_risky": is_risky,
                        "description": desc
                    })
    except (psutil.AccessDenied, Exception) as e:
        logger.info(f"Port listing note: {e}")

    return listening_ports


def scan_cli_tools() -> List[str]:
    """Inspects $PATH for developer CLI tools watchlist."""
    present_tools = []
    for tool in CLI_TOOLS_WATCHLIST:
        if shutil.which(tool):
            present_tools.append(tool)
    return present_tools


class WindowsSecurityScanner:
    """Full Windows Security Scanner orchestrator."""
    def __init__(self, wall_clock_budget_sec: float = 10.0):
        self.wall_clock_budget_sec = wall_clock_budget_sec

    def run_scan(self, previous_process_names: Optional[Set[str]] = None) -> Dict[str, Any]:
        set_process_priority_below_normal()
        start_time = time.time()
        scan_id = str(uuid.uuid4())
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        host = platform.node()

        # 1. Sensitive paths & Docker pipe
        fs_paths = scan_sensitive_filesystem_paths()
        pipe_entry = check_docker_named_pipe()
        sensitive_paths = fs_paths + [pipe_entry]

        # 2. Process handles & AI agent detection
        proc_data = scan_processes_and_handles(
            sensitive_paths=sensitive_paths,
            previous_process_names=previous_process_names,
            wall_clock_budget_sec=self.wall_clock_budget_sec,
            start_time=start_time
        )

        # 3. Browser extensions
        extensions = scan_browser_extensions()

        # 4. Passive local listening ports (zero network calls)
        listening_ports = scan_passive_listening_ports()

        # 5. CLI tools on PATH
        cli_tools = scan_cli_tools()

        elapsed_ms = int((time.time() - start_time) * 1000)
        is_partial = (time.time() - start_time) > self.wall_clock_budget_sec

        return {
            "scan_id": scan_id,
            "timestamp": timestamp,
            "host": host,
            "partial_scan": is_partial,
            "scan_duration_ms": elapsed_ms,
            "sensitive_paths": sensitive_paths,
            "process_handles": proc_data["process_handles"],
            "process_tree": proc_data["process_tree"],
            "browser_extensions": extensions,
            "cli_tools": cli_tools,
            "docker_socket_accessible_by": proc_data["docker_socket_accessible_by"],
            "listening_ports": listening_ports,
            "cross_workspace_access": proc_data["cross_workspace_access"],
            "all_process_names": proc_data["all_process_names"],
            "blast_radius_score": 0
        }


if __name__ == "__main__":
    scanner = WindowsSecurityScanner(wall_clock_budget_sec=10.0)
    res = scanner.run_scan()
    print("Scan completed in", res["scan_duration_ms"], "ms")
    print("CLI Tools found:", res["cli_tools"])
    print("Listening ports found:", len(res["listening_ports"]))
    risky = [p for p in res["listening_ports"] if p.get("is_risky")]
    print("Risky ports:", risky)

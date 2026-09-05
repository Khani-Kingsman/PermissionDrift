"""
PermissionDrift — Opt-In Manual Local Port Deep Check.

Safety constraints:
- Manually triggered only; never invoked on schedule or automatic scans.
- Strictly targets localhost (127.0.0.1) with a 1-second timeout.
"""

import socket
import logging
from typing import Dict, List, Any
import urllib.request
import urllib.error

logger = logging.getLogger("PermissionDriftDeepCheck")

# Service probe mappings for common local services
PROBE_TARGETS = {
    2375: {"path": "/version", "service": "Docker Engine HTTP API", "expected": "Docker"},
    11434: {"path": "/api/tags", "service": "Ollama LLM API", "expected": "models"},
    9200: {"path": "/", "service": "Elasticsearch REST API", "expected": "tagline"},
    6379: {"path": "/", "service": "Redis (HTTP Probe)", "expected": ""},
    8080: {"path": "/", "service": "Generic Dev HTTP Server", "expected": ""},
    3000: {"path": "/", "service": "Node Dev Server", "expected": ""},
    5000: {"path": "/api/health", "service": "Flask API Server", "expected": "PermissionDrift"}
}


def probe_local_port(port: int) -> Dict[str, Any]:
    """
    Performs a single unauthenticated HTTP GET probe against 127.0.0.1:<port>.
    """
    target = PROBE_TARGETS.get(port, {"path": "/", "service": f"Service on Port {port}"})
    url = f"http://127.0.0.1:{port}{target.get('path', '/')}"

    result = {
        "port": port,
        "service": target.get("service"),
        "url": url,
        "is_unauthenticated": False,
        "status_code": None,
        "message": "Port closed or connection refused.",
        "raw_snippet": ""
    }

    req = urllib.request.Request(
        url,
        headers={"User-Agent": "PermissionDrift-LocalAudit/1.0"}
    )

    try:
        with urllib.request.urlopen(req, timeout=1.0) as resp:
            status = resp.status
            body = resp.read(256).decode("utf-8", errors="ignore")
            result["status_code"] = status
            result["is_unauthenticated"] = (200 <= status < 300)
            result["message"] = f"CRITICAL: Port {port} responded without authentication (HTTP {status})!"
            result["raw_snippet"] = body[:120]
            logger.warning(f"Deep Check: Port {port} confirmed unauthenticated (HTTP {status}).")
    except urllib.error.HTTPError as e:
        result["status_code"] = e.code
        if e.code in (401, 403):
            result["is_unauthenticated"] = False
            result["message"] = f"Protected: HTTP {e.code} (Authentication Required)"
        else:
            result["message"] = f"HTTP {e.code} received."
    except (urllib.error.URLError, TimeoutError, socket.timeout):
        result["message"] = "Connection refused or timed out (Port inactive or not HTTP)."
    except Exception as e:
        result["message"] = f"Probe error: {str(e)}"

    return result


def run_deep_check_on_ports(ports: List[int]) -> List[Dict[str, Any]]:
    """Probes a list of flagged listening localhost ports."""
    logger.info(f"Explicit manual Deep Check initiated on ports: {ports}")
    findings = []
    for p in ports:
        findings.append(probe_local_port(p))
    return findings

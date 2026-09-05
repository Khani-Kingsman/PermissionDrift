"""
PermissionDrift — Diff Engine, Risk Mapper & Blast Radius Scoring.

Compares snapshots to detect permission widening, unauthorized process handles,
newly exposed ports, and calculates the 0–100 Blast Radius Score.
"""

import os
import re
import json
import uuid
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple

RULES_PATH = Path(__file__).resolve().parent / "risk_rules.json"


def load_risk_rules() -> Dict[str, Any]:
    if RULES_PATH.exists():
        try:
            with open(RULES_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "rules": [],
        "severity_weights": {"critical": 25, "high": 15, "medium": 8, "low": 3}
    }


def match_rule(category: str, resource: str, is_ai_agent: bool = False) -> Tuple[str, str, str]:
    rules_data = load_risk_rules()
    rules = rules_data.get("rules", [])

    target_category = "ai_agent" if is_ai_agent else category

    for r in rules:
        if r.get("category") == target_category:
            pattern = r.get("resource_pattern", ".*")
            if re.search(pattern, resource, re.IGNORECASE):
                return r.get("severity", "medium"), r.get("impact_statement", ""), r.get("remediation", "")

    return "medium", f"Access change detected for {resource}.", "Review if this accessor requires access."


def calculate_blast_radius(events: List[Dict[str, Any]]) -> int:
    rules_data = load_risk_rules()
    weights = rules_data.get("severity_weights", {"critical": 25, "high": 15, "medium": 8, "low": 3})

    score = 0
    for ev in events:
        if ev.get("change_type") in ("gained_access", "permission_widened"):
            sev = ev.get("severity", "low").lower()
            score += weights.get(sev, 3)

    return min(100, max(0, score))


def diff_snapshots(
    base: Optional[Dict[str, Any]],
    current: Dict[str, Any]
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Diffs current snapshot against base.
    Returns (drift_events, blast_radius_score).
    """
    events: List[Dict[str, Any]] = []
    detected_at = current.get("timestamp", "")

    # Identify AI agent process names in current snapshot
    ai_agent_names = set()
    for item in current.get("process_tree", []):
        if item.get("is_ai_agent"):
            ai_agent_names.add(item.get("name", "").lower())
    for item in current.get("process_handles", []):
        if item.get("is_ai_agent"):
            ai_agent_names.add(item.get("process_name", "").lower())

    # 1. Sensitive Paths & Accessors
    base_paths = {p["path"]: p for p in base.get("sensitive_paths", [])} if base else {}
    for curr_p in current.get("sensitive_paths", []):
        path_str = curr_p.get("path", "")
        base_p = base_paths.get(path_str)

        # Existence change (e.g. newly initialized directory)
        if base and curr_p.get("exists") and not (base_p and base_p.get("exists")):
            sev, impact, recipe = match_rule("credential_access", path_str)
            events.append({
                "event_id": str(uuid.uuid4()),
                "detected_at": detected_at,
                "category": "credential_access",
                "resource": path_str,
                "accessor": "Filesystem",
                "change_type": "gained_access",
                "previous_state": "non-existent",
                "current_state": f"initialized (perms: {curr_p.get('permissions')})",
                "severity": sev,
                "impact_statement": f"Sensitive credential location initialized: {impact}",
                "remediation": recipe,
                "is_heuristic": False
            })

        # Process accessors gaining or losing access
        curr_accessors = set(curr_p.get("accessed_by_processes", []))
        base_accessors = set(base_p.get("accessed_by_processes", [])) if base_p else set()

        for acc in (curr_accessors - base_accessors):
            is_agent = acc.lower() in ai_agent_names
            cat = "ai_agent" if is_agent else "credential_access"
            sev, impact, recipe = match_rule(cat, path_str, is_ai_agent=is_agent)

            events.append({
                "event_id": str(uuid.uuid4()),
                "detected_at": detected_at,
                "category": cat,
                "resource": path_str,
                "accessor": acc,
                "change_type": "gained_access",
                "previous_state": "no open handle in baseline",
                "current_state": f"active file handle held by {acc}",
                "severity": sev,
                "impact_statement": f"{acc} gained access to {path_str}. {impact}",
                "remediation": recipe,
                "is_heuristic": False
            })

        for acc in (base_accessors - curr_accessors):
            events.append({
                "event_id": str(uuid.uuid4()),
                "detected_at": detected_at,
                "category": "credential_access",
                "resource": path_str,
                "accessor": acc,
                "change_type": "lost_access",
                "previous_state": f"open handle by {acc}",
                "current_state": "handle closed / access released",
                "severity": "low",
                "impact_statement": f"{acc} no longer holds handles to {path_str}.",
                "remediation": "No action required.",
                "is_heuristic": False
            })

    # 2. Docker Access (inferred via docker_socket_accessible_by)
    curr_docker_acc = set(current.get("docker_socket_accessible_by", []))
    base_docker_acc = set(base.get("docker_socket_accessible_by", [])) if base else set()

    for acc in (curr_docker_acc - base_docker_acc):
        sev, impact, recipe = match_rule("credential_access", "docker")
        events.append({
            "event_id": str(uuid.uuid4()),
            "detected_at": detected_at,
            "category": "credential_access",
            "resource": r"\\.\pipe\docker_engine",
            "accessor": acc,
            "change_type": "gained_access",
            "previous_state": "no Docker access in baseline",
            "current_state": f"Docker access inferred via running process {acc}",
            "severity": "critical",
            "impact_statement": f"{acc} gained Docker daemon access. {impact}",
            "remediation": recipe,
            "is_heuristic": False
        })

    for acc in (base_docker_acc - curr_docker_acc):
        events.append({
            "event_id": str(uuid.uuid4()),
            "detected_at": detected_at,
            "category": "credential_access",
            "resource": r"\\.\pipe\docker_engine",
            "accessor": acc,
            "change_type": "lost_access",
            "previous_state": f"Docker access via {acc}",
            "current_state": "process terminated / access released",
            "severity": "low",
            "impact_statement": f"{acc} is no longer running Docker access.",
            "remediation": "No action required.",
            "is_heuristic": False
        })

    # 3. Browser Extensions
    base_exts = {e["id"]: e for e in base.get("browser_extensions", [])} if base else {}
    for curr_ext in current.get("browser_extensions", []):
        eid = curr_ext.get("id")
        ename = curr_ext.get("name", eid)
        base_ext = base_exts.get(eid)

        curr_perms = set(curr_ext.get("permissions", []) + curr_ext.get("host_permissions", []))

        if not base_ext:
            # New extension installed
            has_all_urls = curr_ext.get("has_all_urls", False) or any("<all_urls>" in p or "*://*/*" in p for p in curr_perms)
            sev, impact, recipe = match_rule("extension_permission", "<all_urls>" if has_all_urls else ename)

            events.append({
                "event_id": str(uuid.uuid4()),
                "detected_at": detected_at,
                "category": "extension_permission",
                "resource": f"{ename} ({curr_ext.get('browser')})",
                "accessor": ename,
                "change_type": "gained_access",
                "previous_state": "not installed",
                "current_state": f"installed with {len(curr_perms)} permissions",
                "severity": "high" if has_all_urls else sev,
                "impact_statement": f"New extension '{ename}' installed. {impact}",
                "remediation": recipe,
                "is_heuristic": False
            })
        else:
            # Existing extension — check for permission widening to <all_urls>
            base_perms = set(base_ext.get("permissions", []) + base_ext.get("host_permissions", []))
            base_has_all_urls = any("<all_urls>" in p or "*://*/*" in p for p in base_perms)
            curr_has_all_urls = curr_ext.get("has_all_urls", False) or any("<all_urls>" in p or "*://*/*" in p for p in curr_perms)

            if curr_has_all_urls and not base_has_all_urls:
                sev, impact, recipe = match_rule("extension_permission", "<all_urls>")
                events.append({
                    "event_id": str(uuid.uuid4()),
                    "detected_at": detected_at,
                    "category": "extension_permission",
                    "resource": f"{ename} ({curr_ext.get('browser')})",
                    "accessor": ename,
                    "change_type": "permission_widened",
                    "previous_state": "scoped permissions",
                    "current_state": "permission widened to <all_urls>",
                    "severity": "high",
                    "impact_statement": f"Extension '{ename}' widened permissions to broad web access. {impact}",
                    "remediation": recipe,
                    "is_heuristic": False
                })

    # 4. CLI Tools on PATH
    curr_tools = set(current.get("cli_tools", []))
    base_tools = set(base.get("cli_tools", [])) if base else set()

    for tool in (curr_tools - base_tools):
        sev, impact, recipe = match_rule("cli_tool", tool)
        events.append({
            "event_id": str(uuid.uuid4()),
            "detected_at": detected_at,
            "category": "cli_tool",
            "resource": f"PATH binary: {tool}",
            "accessor": tool,
            "change_type": "gained_access",
            "previous_state": "not present on PATH",
            "current_state": "available on system PATH",
            "severity": sev,
            "impact_statement": f"New binary '{tool}' detected on PATH. {impact}",
            "remediation": recipe,
            "is_heuristic": False
        })

    for tool in (base_tools - curr_tools):
        events.append({
            "event_id": str(uuid.uuid4()),
            "detected_at": detected_at,
            "category": "cli_tool",
            "resource": f"PATH binary: {tool}",
            "accessor": tool,
            "change_type": "lost_access",
            "previous_state": "present on PATH",
            "current_state": "removed from PATH",
            "severity": "low",
            "impact_statement": f"CLI tool '{tool}' is no longer on PATH.",
            "remediation": "No action required.",
            "is_heuristic": False
        })

    # 5. Listening Risky Ports
    curr_risky = {p["port"]: p for p in current.get("listening_ports", []) if p.get("is_risky")}
    base_risky = {p["port"]: p for p in base.get("listening_ports", []) if p.get("is_risky")} if base else {}

    for port, pinfo in curr_risky.items():
        if port not in base_risky:
            sev, impact, recipe = match_rule("ipc_exposure", str(port))
            events.append({
                "event_id": str(uuid.uuid4()),
                "detected_at": detected_at,
                "category": "ipc_exposure",
                "resource": f"Port {port} ({pinfo.get('description')})",
                "accessor": pinfo.get("process_name", "unknown"),
                "change_type": "gained_access",
                "previous_state": "port closed / not listening",
                "current_state": f"LISTEN on {pinfo.get('ip')}:{port} owned by {pinfo.get('process_name')}",
                "severity": sev,
                "impact_statement": f"Risky local port {port} opened. {impact}",
                "remediation": recipe,
                "is_heuristic": False
            })

    # 6. Cross-Workspace File Access (Heuristic)
    for cwa in current.get("cross_workspace_access", []):
        pname = cwa.get("process_name", "IDE")
        ws = cwa.get("workspace", "")
        fpath = cwa.get("accessed_path", "")
        sev, impact, recipe = match_rule("workspace_isolation", fpath)

        events.append({
            "event_id": str(uuid.uuid4()),
            "detected_at": detected_at,
            "category": "workspace_isolation",
            "resource": fpath,
            "accessor": f"{pname} (Workspace: {os.path.basename(ws)})",
            "change_type": "gained_access",
            "previous_state": "workspace boundary respected",
            "current_state": f"handle to file outside active workspace: {fpath}",
            "severity": sev,
            "impact_statement": f"[HEURISTIC SIGNAL] {impact} ({pname} in {ws} touched {fpath}).",
            "remediation": recipe,
            "is_heuristic": True
        })

    blast_radius = calculate_blast_radius(events)
    return events, blast_radius

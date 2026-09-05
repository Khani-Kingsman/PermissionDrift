"""
PermissionDrift — AI Forensic Analyzer powered by Google Gemini API.

Provides deep neural threat analysis, process intention explanation, attack
vector modeling, and concrete step-by-step remediation recipes for detected drift events.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger("PermissionDriftAI")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = PROJECT_ROOT / ".env"


def get_gemini_api_key(explicit_key: Optional[str] = None) -> Optional[str]:
    """Resolves Gemini API key from parameter, environment, or .env file."""
    if explicit_key and explicit_key.strip():
        return explicit_key.strip()

    # Environment variable
    env_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if env_key:
        return env_key

    # Check .env file
    if ENV_FILE.exists():
        try:
            with open(ENV_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("GEMINI_API_KEY="):
                        val = line.split("=", 1)[1].strip().strip('"').strip("'")
                        if val:
                            return val
        except Exception as e:
            logger.debug(f"Failed to read .env file: {e}")

    return None


def is_ai_configured(explicit_key: Optional[str] = None) -> bool:
    """Returns True if a valid Gemini API key is available."""
    key = get_gemini_api_key(explicit_key)
    return bool(key and len(key) > 5)


def _call_gemini(prompt: str, api_key: str, model_name: str = "gemini-2.5-flash") -> str:
    """Calls Gemini API via official google-genai SDK with graceful fallback."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.2,
            max_output_tokens=1500,
        )
    )
    return response.text or ""


def analyze_drift_event(
    event: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None,
    explicit_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Performs deep forensic analysis on a specific drift event using Gemini.
    Returns structured analysis with threat vectors, plain-English impact, and remediation.
    """
    api_key = get_gemini_api_key(explicit_key)
    context = context or {}

    resource = event.get("resource", "Unknown resource")
    accessor = event.get("accessor", "Unknown accessor")
    category = event.get("category", "General drift")
    severity = event.get("severity", "medium")
    previous_state = event.get("previous_state", "None")
    current_state = event.get("current_state", "Active")
    impact_statement = event.get("impact_statement", "")
    host = context.get("host", "Windows Developer Machine")

    if not api_key:
        return {
            "ai_powered": False,
            "message": "Gemini API key not configured. Set GEMINI_API_KEY in environment or .env.",
            "forensic_summary": (
                f"Observed access change on {resource} held by {accessor}. "
                f"The process transitioned from '{previous_state}' to '{current_state}'."
            ),
            "threat_vector": (
                "Exposure of sensitive local file handles, unauthenticated loopback listeners, or "
                "widened extension privileges can be exploited by malicious workspaces, sub-processes, "
                "or adjacent scripts running with user privileges."
            ),
            "plain_english_verdict": impact_statement or f"{accessor} holds an unauthorized handle or open port on {resource}.",
            "recommended_actions": [
                f"Verify if {accessor} legitimately requires access to {resource}.",
                "Check running child processes with `Get-Process` or `tasklist /m`.",
                "Set GEMINI_API_KEY to unlock AI-powered threat modeling."
            ],
            "severity_assessment": severity.upper()
        }

    prompt = f"""You are an elite cyber-forensics engineer analyzing developer machine security drift for PermissionDrift.
A security sensor on a Windows developer workstation ({host}) detected an unannounced privilege/handle drift event.

Event Details:
- Category: {category}
- Resource: {resource}
- Accessor (Process / Entity): {accessor}
- Initial / Baseline State: {previous_state}
- Observed Runtime State: {current_state}
- Severity: {severity}
- Preliminary Observation: {impact_statement}

Contextual Metadata:
- Host OS: Windows (Win32 API handle audit)
- Environment: Local developer workspace with IDEs, Docker, cloud CLIs, and dev tools.

Please provide a rigorous, professional cybersecurity analysis formatted in clear Markdown sections:
1. **Forensic Breakdown**: Exactly what is happening under the hood (Win32 handles, TCP sockets, process execution context).
2. **Threat Vector & Abuse Potential**: How an adversary, rogue extension, or untrusted supply-chain dependency could weaponize this specific access.
3. **Plain-English Impact**: 2-3 sentences explaining directly to a developer why this matters and what could be stolen or compromised.
4. **Actionable Remediation**: Concrete Windows PowerShell or CMD commands to inspect, isolate, or remediate this risk immediately.
5. **Verdict & Classification**: A definitive classification (e.g. CRITICAL_BREACH_RISK, UNWANTED_EXPOSURE, NORMAL_DEV_FLOW, HIGH_PRIVILEGE_DAEMON) with brief justification.

Provide crisp, authoritative technical insight with zero fluff.
"""

    try:
        response_text = _call_gemini(prompt, api_key=api_key)
        return {
            "ai_powered": True,
            "model": "gemini-2.5-flash",
            "analysis_markdown": response_text,
            "resource": resource,
            "accessor": accessor,
            "severity": severity
        }
    except Exception as e:
        logger.error(f"Gemini API analysis failed: {e}")
        return {
            "ai_powered": False,
            "error": str(e),
            "message": "Gemini API query encountered an error.",
            "forensic_summary": f"Access change on {resource} by {accessor}.",
            "plain_english_verdict": impact_statement,
            "recommended_actions": [
                "Verify process authenticity.",
                "Review network listeners with `netstat -ano`."
            ]
        }


def generate_posture_report(
    snapshot: Dict[str, Any],
    baseline: Optional[Dict[str, Any]] = None,
    drift_events: Optional[List[Dict[str, Any]]] = None,
    explicit_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generates a full AI Cyber-Forensic Posture Audit Report for the current machine snapshot.
    """
    api_key = get_gemini_api_key(explicit_key)
    drift_events = drift_events or []

    host = snapshot.get("host", "Local Machine")
    timestamp = snapshot.get("timestamp", "")
    score = snapshot.get("blast_radius_score", 0)

    ports = snapshot.get("listening_ports", [])
    risky_ports = [p for p in ports if p.get("is_risky")]
    extensions = snapshot.get("browser_extensions", [])
    cli_tools = snapshot.get("cli_tools", [])
    sensitive_paths = [p for p in snapshot.get("sensitive_paths", []) if p.get("exists")]

    if not api_key:
        return {
            "ai_powered": False,
            "message": "Configure GEMINI_API_KEY to generate an executive AI forensic report.",
            "score": score,
            "host": host,
            "summary": f"Machine posture score is {score}/100 with {len(drift_events)} detected drift events and {len(risky_ports)} risky listening ports."
        }

    prompt = f"""You are a Lead Security Architect preparing an Executive Developer Posture & Drift Assessment.

Target Machine:
- Host: {host}
- Scan Timestamp: {timestamp}
- Blast Radius Score: {score} / 100
- Detected Drift Events Count: {len(drift_events)}

Audit Findings:
1. Sensitive Credential Locations Present ({len(sensitive_paths)}):
{json.dumps([p.get('name') for p in sensitive_paths[:10]], indent=2)}

2. High-Privilege / Risky Listening Ports ({len(risky_ports)}):
{json.dumps(risky_ports[:8], indent=2)}

3. Active Browser Extensions ({len(extensions)}):
{json.dumps([{'name': e.get('name'), 'all_urls': e.get('has_all_urls')} for e in extensions[:10]], indent=2)}

4. Drift Events Observed Against Baseline ({len(drift_events)}):
{json.dumps([{'category': e.get('category'), 'resource': e.get('resource'), 'accessor': e.get('accessor'), 'severity': e.get('severity')} for e in drift_events[:10]], indent=2)}

Please write a comprehensive, executive cyber-posture assessment report in Markdown:
- **Executive Security Summary**: Overall posture posture and blast radius analysis.
- **Critical Exposure Vectors**: Detailed breakdown of where attacker leverage exists.
- **Process & Handle Threat Assessment**: Evaluation of processes accessing tokens or sockets.
- **Top 3 Strategic Fixes**: Prioritized actions the developer must take today.
"""

    try:
        report_markdown = _call_gemini(prompt, api_key=api_key)
        return {
            "ai_powered": True,
            "model": "gemini-2.5-flash",
            "report_markdown": report_markdown,
            "blast_radius_score": score,
            "host": host,
            "timestamp": timestamp
        }
    except Exception as e:
        logger.error(f"Failed to generate Gemini posture report: {e}")
        return {
            "ai_powered": False,
            "error": str(e),
            "score": score,
            "host": host
        }

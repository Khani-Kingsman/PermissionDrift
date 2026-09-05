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

# Active supported models in priority order
CANDIDATE_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-1.5-flash",
]


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


def _call_gemini(prompt: str, api_key: str) -> str:
    """Calls Gemini API with automatic model fallback."""
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    last_err = None

    for model_name in CANDIDATE_MODELS:
        try:
            # Set thinking_budget=0 on 3.7 to prevent slow dynamic thinking delays
            config = types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=2048,
            )
            if "3.7" in model_name:
                try:
                    config.thinking_config = types.ThinkingConfig(thinking_budget=0)
                except Exception:
                    pass

            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config
            )
            if response.text:
                return response.text
        except Exception as e:
            last_err = e
            logger.warning(f"Model {model_name} failed: {e}. Trying fallback...")
            continue

    if last_err:
        raise last_err
    return ""


def analyze_drift_event(
    event: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None,
    explicit_key: Optional[str] = None
) -> Dict[str, Any]:
    """
    Performs deep forensic analysis on a specific drift event using Gemini.
    Returns structured analysis with program explanation, location, threat vectors,
    how to reduce impact, and concrete remediation commands.
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
    host = context.get("host", os.environ.get("COMPUTERNAME", "Windows Developer Machine"))
    username = os.environ.get("USERNAME", "Developer")

    # If no API key configured, generate a comprehensive domain-specific fallback analysis
    if not api_key:
        return _generate_heuristic_forensic_analysis(resource, accessor, category, severity, previous_state, current_state, impact_statement, username)

    prompt = f"""You are a Principal Windows Cybersecurity & Cloud Infrastructure Security Architect.
A local security sensor (PermissionDrift) on a Windows developer workstation detected an unannounced privilege / handle drift event.

EVENT METADATA:
- Resource Target: {resource}
- Accessor (Process / Program / Subsystem): {accessor}
- Category: {category}
- Severity Level: {severity.upper()}
- Baseline / Initial State: {previous_state}
- Observed Runtime State: {current_state}
- Preliminary Observation: {impact_statement}
- Current Host & User: {host} (User: {username})

Provide an authoritative, highly detailed, practical cyber-forensic analysis in structured Markdown.
Make sure you provide real, genuine technical depth — explain the actual software tools involved, where they run on Windows, what files or sockets are involved, what attacks look like in practice, and how to reduce the blast radius:

### 1. What This Program / Resource Is About
Explain in depth what this software, process, or directory actually is in real-world software engineering (e.g. AWS CLI / SDK credentials directory storing `credentials`, `config`, session tokens; or Docker Engine named pipe; or a process like VSCode or Python opening loopback listeners). Explain what files or tokens live here, what developer tools interact with it (e.g. AWS CLI, boto3, Terraform, SDKs), and why it exists.

### 2. Execution & Location Context
Explain where and how it is running on Windows (e.g. `{resource}`, file system permissions like 777 or Everyone-access, or 127.0.0.1 loopback listening socket). Explain why the transition from '{previous_state}' to '{current_state}' represents a dangerous drift or widened attack surface.

### 3. Real-World Security Impact
Explain what happens if this resource or handle is weaponized. Detail realistic attack scenarios:
- Infostealer malware (Lumma, RedLine, Vidar) scanning for this specific path or port.
- Cloud account takeover / lateral movement (S3 bucket enumeration, IAM privilege escalation, EC2 instance creation, database dumps).
- Supply-chain npm/pip packages or malicious VSCode extensions reading user tokens.
- Ransomware or unauthorized execution.

### 4. How to Reduce the Impact & Harden
Provide concrete, defense-in-depth architectural steps to minimize the blast radius:
- Restricting filesystem permissions to only `{username}` using Windows ACLs.
- Migrating from static long-lived credentials to AWS IAM Identity Center (SSO) or short-lived STS tokens.
- Enforcing MFA on IAM roles and setting short session timeouts.
- Least-privilege IAM policies and Service Control Policies (SCPs).

### 5. Executable Windows Fix Commands
Provide exact, copyable PowerShell and CMD commands that the developer can run right now in their terminal to:
1. Audit current permissions and inspect holding processes.
2. Remove broad permissions (e.g. `icacls "{resource}" /inheritance:r /grant:r "{username}:(OI)(CI)F"`).
3. Verify that only `{username}` and SYSTEM have access.
"""

    try:
        response_text = _call_gemini(prompt, api_key=api_key)
        return {
            "ai_powered": True,
            "model": "gemini-3.6-flash",
            "analysis_markdown": response_text,
            "resource": resource,
            "accessor": accessor,
            "severity": severity
        }
    except Exception as e:
        logger.error(f"Gemini API analysis call failed: {e}")
        # Return enhanced forensic fallback with error message noted
        fallback = _generate_heuristic_forensic_analysis(
            resource, accessor, category, severity, previous_state, current_state, impact_statement, username
        )
        fallback["error"] = str(e)
        return fallback


def _generate_heuristic_forensic_analysis(
    resource: str,
    accessor: str,
    category: str,
    severity: str,
    previous_state: str,
    current_state: str,
    impact_statement: str,
    username: str
) -> Dict[str, Any]:
    """Generates an extensive, highly informative heuristic analysis if API key is not yet provided."""
    is_aws = ".aws" in resource.lower()
    is_ssh = ".ssh" in resource.lower()
    is_docker = "docker" in resource.lower() or "2375" in resource
    is_port = "port" in resource.lower() or "127.0.0.1" in resource

    if is_aws:
        what_it_is = (
            "The `.aws` directory is the core credential store for the Amazon Web Services ecosystem on Windows "
            f"(located at `{resource}`). It stores plaintext configuration files: `credentials` (containing "
            "`aws_access_key_id` and `aws_secret_access_key`), `config` (containing AWS profiles, default regions, "
            "and IAM role ARNs), and temporary session caches used by the AWS CLI, AWS SDKs, boto3, Terraform, and IDE toolkits."
        )
        where_it_runs = (
            f"Resides directly under the user's home profile at `{resource}`. On Windows, permissions of `777` or "
            "inherited `Authenticated Users` / `Everyone` grant every local process running under any user session "
            "the ability to read your cloud master keys."
        )
        impact = (
            "High-risk target for infostealers (RedLine, Lumma, Vidar). If an untrusted npm/pip dependency, malicious "
            "extension, or compromised script accesses this path, attackers can exfiltrate your access keys and gain "
            "programmatic control over your AWS account: downloading S3 customer data, spinning up crypto-mining EC2 "
            "instances, or creating rogue IAM backdoor credentials."
        )
        reduce_impact = (
            "1. Eliminate static long-lived credentials: Use AWS IAM Identity Center (AWS SSO) or `aws sts get-session-token` "
            "with short expiration (1 hour).\n"
            "2. Enforce MFA: Require multi-factor authentication for any privileged API action.\n"
            "3. Restrict Windows ACLs: Remove all inherited permissions so only your Windows account can read the folder."
        )
        commands = (
            f"# 1. Strip inherited permissions and grant exclusive access to {username}:\n"
            f'icacls "{resource}" /inheritance:r /grant:r "{username}:(OI)(CI)F"\n\n'
            f"# 2. Remove broad group permissions:\n"
            f'icacls "{resource}" /remove "NT AUTHORITY\\Authenticated Users" /remove "Everyone"\n\n'
            f"# 3. Verify current ACL permissions:\n"
            f'icacls "{resource}"'
        )
    elif is_ssh:
        what_it_is = (
            f"The `.ssh` directory at `{resource}` holds SSH private authentication keys (`id_ed25519`, `id_rsa`), "
            "`known_hosts`, and SSH client configurations used for Git commits, GitHub/GitLab authentication, and remote server administration."
        )
        where_it_runs = f"Local user directory at `{resource}`. Held or scanned by Git, IDEs, or terminal sessions."
        impact = (
            "Unrestricted access permits unauthorized processes to clone private repositories, push backdoored code "
            "under your Git identity, or access production Linux bastion servers."
        )
        reduce_impact = (
            "1. Protect keys with strong passphrases.\n"
            "2. Use hardware-backed FIDO2 keys (e.g. `ssh-keygen -t ed25519-sk`).\n"
            "3. Enforce strict Windows file ACLs."
        )
        commands = (
            f'icacls "{resource}" /inheritance:r /grant:r "{username}:(OI)(CI)F"\n'
            f'icacls "{resource}\\id_*" /inheritance:r /grant:r "{username}:F"'
        )
    else:
        what_it_is = (
            f"Resource `{resource}` is accessed or initialized by `{accessor}`. "
            "In a developer workstation, this represents active process handles or listening network sockets."
        )
        where_it_runs = f"Active on local host under `{accessor}` with current state: `{current_state}`."
        impact = impact_statement or f"Unauthorized process `{accessor}` holding access to `{resource}` widens local blast radius."
        reduce_impact = "Verify whether this process requires continuous handles. Close unneeded listeners and scope process permissions."
        commands = f"# Inspect process holding handle:\nGet-Process -Name '{accessor.replace('.exe', '')}' -ErrorAction SilentlyContinue | Format-List Path, Id, Company"

    markdown_report = f"""### 1. What This Program / Resource Is About
{what_it_is}

### 2. Execution & Location Context
{where_it_runs}
- **Previous State**: `{previous_state}`
- **Observed State**: `{current_state}`
- **Severity**: `{severity.upper()}`

### 3. Real-World Security Impact
{impact}

### 4. How to Reduce the Impact & Harden
{reduce_impact}

### 5. Executable Windows Fix Commands
```powershell
{commands}
```
"""

    return {
        "ai_powered": False,
        "analysis_markdown": markdown_report,
        "forensic_summary": what_it_is,
        "threat_vector": impact,
        "recommended_actions": [
            "Review process handles with PowerShell.",
            "Enforce least-privilege Windows ACLs.",
            "Configure GEMINI_API_KEY in environment for dynamic neural threat modeling."
        ],
        "resource": resource,
        "accessor": accessor,
        "severity": severity
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

    host = snapshot.get("host", os.environ.get("COMPUTERNAME", "Local Machine"))
    timestamp = snapshot.get("timestamp", "")
    score = snapshot.get("blast_radius_score", 0)

    ports = snapshot.get("listening_ports", [])
    risky_ports = [p for p in ports if p.get("is_risky")]
    extensions = snapshot.get("browser_extensions", [])
    cli_tools = snapshot.get("cli_tools", [])
    sensitive_paths = [p for p in snapshot.get("sensitive_paths", []) if p.get("exists")]

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

    if api_key:
        try:
            report_markdown = _call_gemini(prompt, api_key=api_key)
            return {
                "ai_powered": True,
                "model": "gemini-3.6-flash",
                "report_markdown": report_markdown,
                "blast_radius_score": score,
                "host": host,
                "timestamp": timestamp
            }
        except Exception as e:
            logger.error(f"Failed to generate Gemini posture report: {e}")

    # Fallback report if key missing or failed
    fallback_report = f"""### Executive Security Summary
Machine **{host}** is operating with an active Blast Radius Score of **{score} / 100**.
The scan identified **{len(drift_events)} permission drift events**, **{len(risky_ports)} exposed loopback ports**, and **{len(sensitive_paths)} active credential directories**.

### Critical Exposure Vectors
1. **Cloud & Local Credential Directories**: Sensitive keys detected on the filesystem. If permissions are unconstrained, any process running in the user session can read them.
2. **Loopback Listeners**: {len(risky_ports)} high-privilege daemons active on 127.0.0.1. Unauthenticated endpoints can be reached via browser SSRF or local scripts.
3. **Drift from Baseline**: {len(drift_events)} unannounced changes detected since your established clean baseline.

### Top 3 Strategic Fixes
1. Lock down directory ACLs on `~/.aws` and `~/.ssh` using `icacls`.
2. Move from static cloud keys to short-lived temporary STS credentials.
3. Bind development servers and daemons strictly with authentication.
"""
    return {
        "ai_powered": False,
        "report_markdown": fallback_report,
        "score": score,
        "host": host,
        "timestamp": timestamp
    }

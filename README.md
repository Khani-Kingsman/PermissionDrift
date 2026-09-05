# PermissionDrift

> **A Windows-Only, Local-First Developer Security Posture Monitor.**
>
> Snapshots what your development machine can access (SSH keys, cloud CLI credentials, Docker Desktop named pipes, Kubernetes configs, browser extensions, installed CLI tools, and listening local ports) and alerts you to **silent permission drift** over time with plain-English impact statements and actionable remediation recipes.

---

## 🎯 Core Promise

> *"Your VSCode didn't have access to `~/.aws` on Monday. It does now. Here's why that matters."*

---

## 🛡️ Anti-Tamper & Security Guarantees

1. **Metadata Only — Zero Secrets Read**:
   - `os.stat()` and handle-queries only.
   - We **NEVER** call `open()`, read, or parse file contents inside `~/.ssh`, `~/.aws`, `~/.azure`, `~/.kube`, or `%APPDATA%\gcloud`.
   - Your private keys, access tokens, and passwords remain completely untouched.
2. **Strictly Local-First — Zero External Network Calls**:
   - The scanner, SQLite storage, and diff engine operate 100% offline.
   - Passive port listing queries only the local kernel connection table.
   - The only network component is the Flask local web interface and the **manual, opt-in Deep Check** feature, which strictly targets `127.0.0.1` / `localhost`.
3. **EDR & AV Friendly (No Freezing or Crashing)**:
   - Sets process priority to `BELOW_NORMAL_PRIORITY_CLASS` at startup.
   - Enforces a strict 10-second wall-clock budget for every scan.
   - Enforces 200ms worker thread timeouts per process with instant fail-soft skips on `AccessDenied`.
   - Auditable plaintext logging in `permissiondrift.log`.

---

## 🚀 Quick Start

### 1. Prerequisites
- **OS**: Windows 10 or 11 (64-bit)
- **Python**: 3.10+ (with `psutil`, `flask`, `flask_cors`, `colorama`)
- **Node.js**: 18+ (for building frontend)

### 2. Setup
```powershell
# Navigate to project directory
cd d:\PermissionDrift

# Install Python dependencies
pip install psutil flask flask-cors colorama

# Build the frontend production assets
cd frontend
npm install
npm run build
cd ..
```

---

## 🖥️ Flagship CLI Mode

PermissionDrift includes a standalone CLI diff tool that runs directly against `snapshots.db` without requiring the Flask API server.

### 1. Take a Baseline Snapshot
```powershell
python cli.py scan --baseline
```

### 2. Check for Permission Drift (Git-Style Diff)
```powershell
python cli.py diff
```

**Example Terminal Output:**
```
======================================================================
PermissionDrift: Blast Radius 0 -> 40 (+40)
Diff: Baseline (34e1cbe3) vs Current (9a4f210d)
======================================================================

+ Code.exe gained access to C:\Users\User\.aws     [CRITICAL]
  -> recipe: Use 'aws sts get-session-token' for scoped credentials instead of long-lived profiles.
+ Docker named pipe accessed by wsl.exe            [CRITICAL]
  -> recipe: Front with docker-socket-proxy scoped to read-only safe endpoints.
- kubectl config access revoked

======================================================================
```

### 3. List Recorded Snapshots
```powershell
python cli.py list
```

---

## 🌐 Web Dashboard

Start the local Flask application:
```powershell
python backend/app.py
```
Open **[http://127.0.0.1:5000](http://127.0.0.1:5000)** in your browser.

- **Blast Radius Score**: A 0–100 weighted index trending over time.
- **Current Posture Tree**: Expandable breakdown of credentials, Docker pipe, extensions, AI agents/MCPs, and local ports.
- **Drift Feed**: Severity-coded cards with expandable "Fix it" remediation recipes.
- **Timeline Diff ("Monday vs Friday")**: Compare any two historical snapshots side by side.
- **Deep Check Button**: Visually distinct, opt-in active verification for local listening ports.

---

## ⏰ Automated Background Scanning (Windows Task Scheduler)

PermissionDrift avoids always-on background daemons by using native Windows Task Scheduler (`schtasks.exe`).

### Register Task (Every 30 Minutes)
```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\schedule_task.ps1 -Action Install -IntervalMinutes 30
```

> [!IMPORTANT]
> The setup script automatically registers the task under your **current Windows user account** (`/RU %USERNAME% /RL LIMITED`), ensuring `%USERPROFILE%` correctly resolves to your home directory (`C:\Users\<Username>`) and **NEVER** systemprofile (`C:\Windows\System32\config\systemprofile`).

### Query Task Status
```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\schedule_task.ps1 -Action Status
```

### Trigger Immediate Background Scan
```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\schedule_task.ps1 -Action RunNow
```

### Remove Scheduled Task
```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\schedule_task.ps1 -Action Uninstall
```

---

## 🔍 What the "Deep Check" Does (and Why It's Opt-In)

- **Regular Scans (Passive)**:
  Only queries the local kernel TCP table (`psutil.net_connections()`) for `LISTEN` state sockets bound to `127.0.0.1`. **Zero network calls or socket probes are initiated.**
- **Deep Check (Active, Opt-In)**:
  Available exclusively via the manual **Deep Check** button in the Web UI. It sends a single HTTP `GET` request with a 1-second timeout to `127.0.0.1:<port>` (e.g. `127.0.0.1:2375/version` for Docker or `127.0.0.1:11434/api/tags` for Ollama) to verify whether the service is genuinely open without authentication.
- **Why It's Opt-In**:
  Automated routine port scanning can trigger false alarms in corporate EDR / Windows Defender. By making active probing strictly manual and user-triggered, normal scans remain 100% passive.

---

## 🛡️ Windows Defender & Antivirus Advice

PermissionDrift inspects processes and credential directory metadata — the same surface area infostealers examine. If Windows Defender flags the tool during development:

1. **Do NOT disable Real-Time Protection system-wide.**
2. Instead, add a targeted local exclusion for the project folder:
   ```powershell
   # Run in an elevated PowerShell prompt if desired
   Add-MpPreference -ExclusionPath "D:\PermissionDrift"
   ```
3. Inspect `permissiondrift.log` to audit all tool actions at any time.

---

## 📋 Data Collection Matrix

| Resource | Collected Data | What is NEVER Collected |
|---|---|---|
| `~/.ssh/` | Existence, octal mode, mtime, process handles | Key file contents, passwords, identities |
| `~/.aws/`, `~/.azure/`, `gcloud` | Existence, octal mode, mtime, process handles | Secret keys, credentials, tokens |
| Docker Named Pipe | Win32 pipe existence, active daemon processes | Pipe stream contents, container data |
| Browser Extensions | Extension name, ID, version, manifest permissions | Browsing history, cookies, tab data |
| CLI Tools | Binary presence on `%PATH%` | Execution history, environment variables |
| AI Agents & MCP | PID, command line keywords, process hierarchy | Prompts, agent memory, LLM completions |
| Localhost Ports | Port number, bound IP, owning PID/name | Network traffic packets, payload data |

---

## 🧪 Running Automated Tests

```powershell
python -m unittest discover tests
```
All 9 unit tests cover:
- Standalone SQLite storage and 30-day auto-pruning.
- Diff engine, risk mapping, and blast radius scoring.
- Flask API async execution and job polling under 100ms.

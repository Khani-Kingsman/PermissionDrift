# PermissionDrift: Open-Source Community Launch Kit 🚀

> Everything you need to launch, distribute, and grow **PermissionDrift** across Hacker News, Reddit, Twitter/X, Product Hunt, and security newsletters.

---

## 📅 Optimal Launch Window
- **Best Days**: Tuesday or Wednesday
- **Best Time**: 13:00 – 15:00 UTC (8:00 – 10:00 AM EST / 5:30 – 7:30 PM IST)
- **Rule**: Launch Hacker News first, then Twitter thread 30 minutes later, followed by Reddit subreddits staggered by 1–2 hours to avoid spam filters.

---

## 1. Hacker News — Show HN
**Target URL**: https://news.ycombinator.com/submit  
**Title**: 
```text
Show HN: PermissionDrift – Local-first Windows developer security posture monitor
```
**URL**: `https://github.com/Khani-Kingsman/PermissionDrift`

**Submission Text / First Comment**:
```markdown
Hi HN,

I built PermissionDrift (https://github.com/Khani-Kingsman/PermissionDrift) because developer workstations are now primary targets for infostealers, malicious VSCode extensions, and rogue npm/pip postinstall scripts. 

Most security teams know what's in their CI/CD, but individual dev laptops suffer from silent "permission drift":
- On Monday, your IDE only opened a local repo.
- By Friday, three new background processes hold active open handles to `~/.aws/credentials` or `~/.ssh/id_rsa`.
- An unauthenticated Ollama or Docker port (`127.0.0.1:2375` or `11434`) was spun up by a local script and left listening indefinitely.

I wanted something that monitors this without being invasive or heavy:

1. **Zero Secrets Read**: It only inspects filesystem metadata (`os.stat`) and Win32 process handles. It never calls `open()` on credentials, private keys, or tokens.
2. **Strictly Local-First**: Runs entirely on a local SQLite database (`snapshots.db`). No cloud telemetry, no account signup.
3. **EDR/AV Friendly**: Drops to `BELOW_NORMAL_PRIORITY_CLASS`, caps scans to a strict 10s budget, and catches `psutil.AccessDenied` gracefully.
4. **Git-style CLI Diff**: Run `python cli.py scan --baseline` and `python cli.py diff` to see exactly what changed in terminal.
5. **Obsidian Dashboard & AI Threat Modeling**: A React 19 + Three.js interface that calculates a 0–100 "Blast Radius" score, with optional Gemini 2.5 Flash threat analysis to explain what specific handle access means in plain English.

The code is 100% open source under the MIT License. Would love feedback on handle-inspection edge cases or credential directories you think we should monitor next!
```

---

## 2. Reddit Playbook

### A. r/netsec (Strict Technical Guidelines)
- **Title**: `PermissionDrift: Local-First Windows Tool for Auditing Process Handle Access to Developer Credentials`
- **Link**: `https://github.com/Khani-Kingsman/PermissionDrift`
- **Comment / Body**: Focus on Windows handle mechanics (`NtQuerySystemInformation`, process object tables), lack of payload reading, and defense-in-depth against malicious extensions.

### B. r/cybersecurity & r/blueteamsec
- **Title**: `I open-sourced a local-first security tool to catch "Permission Drift" on Windows developer laptops`
- **Body**: Focus on the problem of developer machine compromise, shadow access, and how blue teams can use the standalone CLI in local scheduled tasks to baseline developer workstations.

### C. r/Python
- **Title**: `I built PermissionDrift in Python: Auditing Windows developer credential access and port exposure with zero secrets read`
- **Body**: Detail the architecture: Python `psutil`, Win32 API interactions, local SQLite storage, fail-soft threading timeouts, and the optional Gemini API integration.

### D. r/devops
- **Title**: `Your VSCode didn't have access to ~/.aws on Monday. It does now. Built an open-source tool to track dev posture drift`

---

## 3. Twitter / X Viral Launch Thread

### Tweet 1 (Hook + Media)
> Your VSCode didn't have access to `~/.aws` on Monday.
> It does now. 
> 
> Most developers have zero visibility into what background processes are touching their SSH keys, cloud configs, or Docker sockets.
> 
> So I open-sourced PermissionDrift: a local-first developer posture monitor for Windows. 🧵👇
> [Attach screenshot of Dashboard or 5-second video recording]

### Tweet 2 (Core Architecture)
> The biggest challenge with developer security tools: NOBODY wants a tool reading their private keys.
> 
> PermissionDrift has a strict Zero-Secrets guarantee:
> 🔍 Uses `os.stat` and Win32 handle metadata only.
> ❌ NEVER reads file contents of `~/.ssh` or `~/.aws`.
> 💻 100% offline local SQLite database.

### Tweet 3 (The Blast Radius)
> It computes a real-time "Blast Radius" score (0-100) based on:
> • Cloud CLI credentials (`~/.aws`, `~/.azure`, `gcloud`)
> • Docker Desktop named pipes
> • Open loopback daemon listeners (`127.0.0.1:11434`, `2375`)
> • Suspicious browser / IDE extensions

### Tweet 4 (CLI + AI Threat Modeling)
> Prefer terminal? Use the Git-style CLI diff:
> `python cli.py scan --baseline`
> `python cli.py diff`
> 
> Prefer visual? It includes a React + Three.js dark terminal UI and one-click AI threat analysis powered by Gemini to explain risks in plain English.

### Tweet 5 (Call to Action)
> 100% free, MIT licensed, zero telemetry.
> 
> Check out the repo, star if you like it, and help make developer machines more secure:
> 🔗 https://github.com/Khani-Kingsman/PermissionDrift

---

## 4. Curated Newsletters Outreach (Direct Email Pitch)

Send this brief email to Clint Gibler (**tl;dr sec** - `clint@tldrsec.com`) and **Daily.dev**:

> **Subject**: Tool Submission: PermissionDrift – Local-first developer posture monitor for Windows
> 
> Hi Clint,
> 
> Long time reader of tl;dr sec! Wanted to share an open-source project I just released that your readers might find interesting:
> 
> **PermissionDrift**: https://github.com/Khani-Kingsman/PermissionDrift
> 
> **What it does**: Tracks silent permission drift on Windows dev machines (e.g., when a new process touches `~/.aws`, `~/.ssh`, Docker named pipes, or unauthenticated loopback ports).
> 
> **Why it's different**: Zero secrets read (metadata and Win32 handle inspect only), strictly offline SQLite storage, and a git-style CLI diff + dashboard to see what changed between Monday and Friday.
> 
> Open source under MIT. Would love to hear your thoughts!

---

## 5. GitHub Repository Tags & Optimization

To maximize GitHub search algorithm rankings, configure these **Topics** on `https://github.com/Khani-Kingsman/PermissionDrift`:
- `cybersecurity`
- `security-tools`
- `devsecops`
- `infosec`
- `windows-security`
- `developer-tools`
- `gemini-api`
- `threat-modeling`
- `threejs`
- `privacy`
- `local-first`

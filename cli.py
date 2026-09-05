"""
PermissionDrift — Command Line Interface.

Provides a git-style terminal diff report showing newly gained or revoked access,
severity tags, and remediation recipes directly from the local snapshot store.
"""

import sys
import argparse
from typing import Optional

# Ensure UTF-8 output on Windows terminal
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    import colorama
    from colorama import Fore, Back, Style
    colorama.init(autoreset=True)
    HAS_COLOR = True
except ImportError:
    HAS_COLOR = False
    class EmptyColor:
        def __getattr__(self, name):
            return ""
    Fore = Back = Style = EmptyColor()

from backend.scanner import WindowsSecurityScanner
from backend.storage import (
    save_snapshot, get_snapshot, get_latest_snapshot,
    get_baseline_snapshot, set_baseline, list_snapshots
)
from backend.diff_engine import diff_snapshots, calculate_blast_radius

SEVERITY_COLORS = {
    "critical": Fore.RED + Style.BRIGHT,
    "high": Fore.MAGENTA + Style.BRIGHT,
    "medium": Fore.YELLOW,
    "low": Fore.CYAN
}


def format_diff_report(
    base_score: int,
    curr_score: int,
    events: list,
    base_id: Optional[str] = None,
    curr_id: Optional[str] = None
) -> str:
    """Generates git-style terminal diff report."""
    diff_val = curr_score - base_score
    diff_str = f"+{diff_val}" if diff_val > 0 else f"{diff_val}"
    score_color = Fore.RED if diff_val > 0 else (Fore.GREEN if diff_val < 0 else Fore.WHITE)

    lines = []
    lines.append("")
    lines.append(f"{Style.BRIGHT}{Fore.CYAN}======================================================================{Style.RESET_ALL}")
    lines.append(f"{Style.BRIGHT}PermissionDrift: Blast Radius {base_score} -> {curr_score} ({score_color}{diff_str}{Style.RESET_ALL}{Style.BRIGHT}){Style.RESET_ALL}")
    if base_id and curr_id:
        lines.append(f"{Fore.BLACK + Style.BRIGHT}Diff: Baseline ({base_id[:8]}) vs Current ({curr_id[:8]}){Style.RESET_ALL}")
    lines.append(f"{Style.BRIGHT}{Fore.CYAN}======================================================================{Style.RESET_ALL}")
    lines.append("")

    if not events:
        lines.append(f"{Fore.GREEN}✓ No drift detected. Machine access strictly matches baseline.{Style.RESET_ALL}")
        lines.append("")
        return "\n".join(lines)

    for ev in events:
        change_type = ev.get("change_type", "gained_access")
        sev = ev.get("severity", "low").lower()
        sev_color = SEVERITY_COLORS.get(sev, Fore.WHITE)
        resource = ev.get("resource", "")
        accessor = ev.get("accessor", "Unknown")
        recipe = ev.get("remediation", "")
        is_heuristic = ev.get("is_heuristic", False)

        if change_type in ("gained_access", "permission_widened"):
            symbol = f"{Fore.RED}{Style.BRIGHT}+{Style.RESET_ALL}"
            tag = f"{sev_color}[{sev.upper()}]{Style.RESET_ALL}"
            if is_heuristic:
                tag += f" {Fore.YELLOW}(heuristic){Style.RESET_ALL}"

            desc = f"{accessor} gained access to {resource}"
            if change_type == "permission_widened":
                desc = f"{accessor} widened permissions on {resource}"
            lines.append(f"{symbol} {Style.BRIGHT}{desc:<48}{Style.RESET_ALL} {tag}")
            if recipe:
                lines.append(f"  {Fore.BLACK + Style.BRIGHT}-> recipe:{Style.RESET_ALL} {Fore.LIGHTYELLOW_EX}{recipe}{Style.RESET_ALL}")
        else:
            symbol = f"{Fore.GREEN}{Style.BRIGHT}-{Style.RESET_ALL}"
            lines.append(f"{symbol} {Fore.GREEN}{accessor} access to {resource} revoked{Style.RESET_ALL}")

    lines.append("")
    return "\n".join(lines)


def cmd_scan(args):
    """Executes a scan and updates SQLite."""
    print(f"{Fore.CYAN}Initiating PermissionDrift posture scan...{Style.RESET_ALL}")
    latest = get_latest_snapshot()
    prev_names = set(latest.get("all_process_names", [])) if latest else None
    base = get_baseline_snapshot()

    scanner = WindowsSecurityScanner(wall_clock_budget_sec=10.0)
    snapshot = scanner.run_scan(previous_process_names=prev_names)

    events, score = diff_snapshots(base, snapshot)
    snapshot["blast_radius_score"] = score

    is_baseline = args.baseline or (latest is None)
    scan_id = save_snapshot(
        snapshot,
        is_baseline=is_baseline,
        blast_radius_score=score
    )

    status_tag = f"{Fore.MAGENTA}[BASELINE]{Style.RESET_ALL} " if is_baseline else ""
    print(f"{Fore.GREEN}✓ Scan completed:{Style.RESET_ALL} {status_tag}ID: {scan_id[:8]} (Duration: {snapshot['scan_duration_ms']}ms, Score: {score}/100)")

    if not is_baseline and base:
        base_score = base.get("blast_radius_score", 0)
        report = format_diff_report(base_score, score, events, base["scan_id"], scan_id)
        print(report)


def cmd_diff(args):
    """Prints the git-style terminal diff report."""
    latest = get_latest_snapshot()
    if not latest:
        print(f"{Fore.RED}No snapshots found in database. Run 'python cli.py scan' first.{Style.RESET_ALL}")
        return

    base = get_baseline_snapshot()
    base_id = base["scan_id"] if base else None
    base_score = base.get("blast_radius_score", 0) if base else 0

    events, curr_score = diff_snapshots(base, latest)
    report = format_diff_report(base_score, curr_score, events, base_id, latest["scan_id"])
    print(report)


def cmd_baseline(args):
    """View or set baseline snapshot."""
    if args.scan_id:
        success = set_baseline(args.scan_id)
        if success:
            print(f"{Fore.GREEN}✓ Successfully set snapshot {args.scan_id} as baseline.{Style.RESET_ALL}")
        else:
            print(f"{Fore.RED}Snapshot {args.scan_id} not found.{Style.RESET_ALL}")
    else:
        base = get_baseline_snapshot()
        if base:
            print(f"{Fore.CYAN}Current Baseline:{Style.RESET_ALL} {base['scan_id']} (Captured: {base['timestamp']}, Blast Score: {base.get('blast_radius_score', 0)})")
        else:
            print(f"{Fore.YELLOW}No baseline set yet.{Style.RESET_ALL}")


def cmd_list(args):
    """List recent snapshots."""
    snaps = list_snapshots(limit=args.limit)
    if not snaps:
        print(f"{Fore.YELLOW}No snapshots recorded yet.{Style.RESET_ALL}")
        return

    print(f"\n{Style.BRIGHT}{'SCAN ID':<38} {'TIMESTAMP':<24} {'SCORE':<8} {'STATUS'}{Style.RESET_ALL}")
    print("-" * 80)
    for s in snaps:
        base_str = f"{Fore.GREEN}BASELINE{Style.RESET_ALL}" if s["is_baseline"] else ""
        print(f"{s['scan_id']:<38} {s['timestamp']:<24} {s['blast_radius_score']:<8} {base_str}")
    print("")


def main():
    parser = argparse.ArgumentParser(
        prog="PermissionDrift",
        description="Local-First Developer Security Posture Monitor for Windows"
    )
    subparsers = parser.add_subparsers(dest="command")

    subparsers.add_parser("diff", help="Print git-style colored drift diff against baseline")

    p_scan = subparsers.add_parser("scan", help="Run a security posture scan")
    p_scan.add_argument("--baseline", action="store_true", help="Set this scan as the new baseline")

    p_base = subparsers.add_parser("baseline", help="View or set baseline snapshot")
    p_base.add_argument("scan_id", nargs="?", help="Optional snapshot ID to mark as baseline")

    p_list = subparsers.add_parser("list", help="List recent snapshot history")
    p_list.add_argument("--limit", type=int, default=15, help="Number of records to show")

    args = parser.parse_args()

    if args.command == "diff":
        cmd_diff(args)
    elif args.command == "scan":
        cmd_scan(args)
    elif args.command == "baseline":
        cmd_baseline(args)
    elif args.command == "list":
        cmd_list(args)
    else:
        cmd_diff(args)


if __name__ == "__main__":
    main()

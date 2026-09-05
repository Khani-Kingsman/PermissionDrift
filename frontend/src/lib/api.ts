import type { SnapshotSummary, FullSnapshot, DriftEvent, TreeItem } from '../types/drift';

// ── API helpers ───────────────────────────────────────────────────────────────
export async function apiScan(): Promise<{ job_id: string }> {
  const res = await fetch('/api/scan', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to start scan');
  return res.json();
}

export async function apiPollJob(jobId: string) {
  const res = await fetch(`/api/jobs/${jobId}`);
  if (!res.ok) throw new Error('Failed to poll job');
  return res.json();
}

export async function apiGetSnapshots(): Promise<{ snapshots: SnapshotSummary[] }> {
  const res = await fetch('/api/snapshots');
  if (!res.ok) throw new Error('Failed to fetch snapshots');
  return res.json();
}

export async function apiGetSnapshot(id: string): Promise<FullSnapshot> {
  const res = await fetch(`/api/snapshots/${id}`);
  if (!res.ok) throw new Error('Failed to fetch snapshot');
  return res.json();
}

export async function apiGetDrift(): Promise<{ baseline_id: string | null; current_id: string | null; blast_radius_score: number; events: DriftEvent[] }> {
  const res = await fetch('/api/drift');
  if (!res.ok) throw new Error('Failed to fetch drift');
  return res.json();
}

export async function apiCompareDrift(fromId: string, toId: string) {
  const res = await fetch(`/api/drift/${fromId}/${toId}`);
  if (!res.ok) throw new Error('Failed to compare');
  return res.json();
}

export async function apiSetBaseline(id: string) {
  const res = await fetch(`/api/baseline/${id}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to set baseline');
  return res.json();
}

export async function apiDeepCheck(ports: number[]) {
  const res = await fetch('/api/deep-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ports }),
  });
  if (!res.ok) throw new Error('Deep check failed');
  return res.json();
}

// ── AI Forensic Analysis (Gemini) ─────────────────────────────────────────────
export async function apiGetAIStatus(): Promise<{ configured: boolean; model: string; provider: string }> {
  const res = await fetch('/api/ai/status');
  if (!res.ok) throw new Error('Failed to get AI status');
  return res.json();
}

export async function apiSetAIKey(apiKey: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/ai/set-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) throw new Error('Failed to configure AI key');
  return res.json();
}

export async function apiAnalyzeEvent(event: DriftEvent, apiKey?: string): Promise<any> {
  const res = await fetch('/api/ai/analyze-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, api_key: apiKey }),
  });
  if (!res.ok) throw new Error('Failed to analyze event');
  return res.json();
}

export async function apiGetAIReport(snapshotId?: string, apiKey?: string): Promise<any> {
  const res = await fetch('/api/ai/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snapshot_id: snapshotId, api_key: apiKey }),
  });
  if (!res.ok) throw new Error('Failed to generate AI report');
  return res.json();
}

// ── Background Security Engine & Windows Autostart ─────────────────────────
export interface EngineStatus {
  running: boolean;
  interval_sec: number;
  last_scan_time: number | null;
  last_blast_radius: number;
  scan_count: number;
  notifications_enabled: boolean;
  autostart_enabled: boolean;
  recent_alerts: {
    timestamp: number;
    title: string;
    body: string;
    blast_radius: number;
    event_count: number;
  }[];
}

export async function apiGetEngineStatus(): Promise<EngineStatus> {
  const res = await fetch('/api/engine/status');
  if (!res.ok) throw new Error('Failed to fetch engine status');
  return res.json();
}

export async function apiToggleEngine(action?: 'start' | 'stop' | 'toggle', intervalSec?: number): Promise<EngineStatus> {
  const res = await fetch('/api/engine/toggle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action ?? 'toggle', interval_sec: intervalSec }),
  });
  if (!res.ok) throw new Error('Failed to toggle engine');
  return res.json();
}

export async function apiToggleAutostart(enabled?: boolean): Promise<{ success: boolean; enabled: boolean; error?: string }> {
  const res = await fetch('/api/engine/autostart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  if (!res.ok) throw new Error('Failed to toggle autostart');
  return res.json();
}

export async function apiTestNotification(): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/engine/test-notification', { method: 'POST' });
  if (!res.ok) throw new Error('Failed to trigger test notification');
  return res.json();
}

export async function apiTerminateProcess(pid: number, processName?: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/process/terminate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pid, process_name: processName }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to terminate process');
  return data;
}

// ── Snapshot → TreeItem adapter ───────────────────────────────────────────────
export function snapshotToTrees(baseline: FullSnapshot | null, current: FullSnapshot | null): {
  baselineTree: TreeItem[];
  currentTree: TreeItem[];
} {
  const makePathItem = (p: { name: string; path: string; exists: boolean; accessed_by_processes: string[] }, isBaseline: boolean): TreeItem => ({
    id: `${isBaseline ? 'b' : 'c'}-${p.name}`,
    name: p.name,
    type: 'resource',
    status: p.exists ? 'baseline' : 'revoked',
    detail: p.path,
    children: p.accessed_by_processes.map((proc, i) => ({
      id: `${isBaseline ? 'b' : 'c'}-${p.name}-proc-${i}`,
      name: proc,
      type: 'process' as const,
      status: 'added' as const,
      detail: 'Active handle',
    })),
  });

  const makeHandleItem = (h: { process_name: string; pid: number; open_handles: string[]; is_ai_agent: boolean }, isBaseline: boolean): TreeItem => ({
    id: `${isBaseline ? 'b' : 'c'}-proc-${h.pid}`,
    name: `${h.process_name} (PID ${h.pid})`,
    type: h.is_ai_agent ? 'extension' : 'process',
    status: isBaseline ? 'baseline' : 'added',
    detail: h.is_ai_agent ? 'AI Agent' : undefined,
    children: h.open_handles.slice(0, 5).map((handle, i) => ({
      id: `${isBaseline ? 'b' : 'c'}-${h.pid}-h${i}`,
      name: handle,
      type: handle.includes('pipe') ? 'pipe' as const : 'resource' as const,
      status: 'baseline' as const,
    })),
  });

  const baselineTree: TreeItem[] = baseline
    ? [
        ...baseline.sensitive_paths.filter(p => p.exists).map(p => makePathItem(p, true)),
        ...baseline.process_handles.slice(0, 3).map(h => makeHandleItem(h, true)),
      ]
    : [];

  const currentTree: TreeItem[] = current
    ? [
        ...current.sensitive_paths.filter(p => p.exists).map(p => makePathItem(p, false)),
        ...current.process_handles.slice(0, 4).map(h => makeHandleItem(h, false)),
      ]
    : [];

  return { baselineTree, currentTree };
}

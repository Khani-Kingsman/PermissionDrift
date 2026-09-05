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

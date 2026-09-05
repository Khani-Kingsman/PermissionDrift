import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Navbar } from './components/Navbar';
import { BlastRadiusGauge } from './components/BlastRadiusGauge';
import { MondayVsFriday } from './components/MondayVsFriday';
import { DriftFeed } from './components/DriftFeed';
import { SurfaceRadar } from './components/SurfaceRadar';
import { DeepCheckModal } from './components/DeepCheckModal';
import {
  apiScan, apiPollJob, apiGetSnapshots, apiGetSnapshot,
  apiGetDrift, apiSetBaseline, snapshotToTrees,
} from './lib/api';
import type { SnapshotSummary, FullSnapshot, DriftEvent, TreeItem, ListeningPort } from './types/drift';
import { Database, Star, Clock, AlertTriangle } from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

// ── Snapshot sidebar ──────────────────────────────────────────────────────────
interface SnapshotPanelProps {
  snapshots: SnapshotSummary[];
  selectedId: string | null;
  onSelect: (s: SnapshotSummary) => void;
  onBaseline: (id: string) => void;
}

const SnapshotPanel: React.FC<SnapshotPanelProps> = ({ snapshots, selectedId, onSelect, onBaseline }) => {
  const sorted = [...snapshots].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="rounded-xl border border-cyan-950/80 bg-[#0d1017]/90 p-4 backdrop-blur-md">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800/60">
        <Database className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-mono text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Scan History ({snapshots.length})
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center py-8 gap-2 text-center">
          <Clock className="w-8 h-8 text-slate-700" />
          <p className="font-mono text-xs text-slate-600">No scans yet.<br />Click "Scan Posture" to start.</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
          {sorted.map((snap, i) => {
            const isSelected = snap.scan_id === selectedId;
            const scoreColor =
              snap.blast_radius_score >= 70 ? 'text-red-400' :
              snap.blast_radius_score >= 40 ? 'text-amber-400' : 'text-emerald-400';

            return (
              <div
                key={snap.scan_id}
                onClick={() => onSelect(snap)}
                className={`group relative flex items-start gap-2.5 p-2.5 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-cyan-950/30 border border-cyan-800/40'
                    : 'hover:bg-slate-900/40 border border-transparent'
                }`}
              >
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center flex-shrink-0 pt-1">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: snap.is_baseline ? '#f59e0b' : isSelected ? '#22d3ee' : '#1e2d45',
                      boxShadow: snap.is_baseline ? '0 0 6px rgba(245,158,11,0.5)' :
                                 isSelected ? '0 0 6px rgba(34,211,238,0.5)' : 'none',
                    }}
                  />
                  {i < sorted.length - 1 && (
                    <div className="w-px flex-1 mt-1 min-h-[14px]" style={{ background: '#1e2d45' }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono text-[11px] ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
                      {fmt(snap.timestamp)}
                    </span>
                    {snap.is_baseline && <Star className="w-3 h-3 text-amber-400" />}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`font-mono text-[10px] font-bold ${scoreColor}`}>
                      {snap.blast_radius_score}
                    </span>
                    {snap.partial_scan && (
                      <span className="font-mono text-[10px] text-slate-600">partial</span>
                    )}
                  </div>

                  {/* Baseline button */}
                  {!snap.is_baseline && (
                    <button
                      onClick={e => { e.stopPropagation(); onBaseline(snap.scan_id); }}
                      className="mt-1 font-mono text-[10px] text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-amber-300"
                    >
                      ★ Set as baseline
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [snapshots, setSnapshots]       = useState<SnapshotSummary[]>([]);
  const [baselineSnap, setBaselineSnap] = useState<FullSnapshot | null>(null);
  const [currentSnap, setCurrentSnap]   = useState<FullSnapshot | null>(null);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [driftEvents, setDriftEvents]   = useState<DriftEvent[]>([]);
  const [driftScore, setDriftScore]     = useState(0);
  const [prevScore, setPrevScore]       = useState(0);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const [baselineTree, setBaselineTree] = useState<TreeItem[]>([]);
  const [currentTree, setCurrentTree]   = useState<TreeItem[]>([]);
  const [ports, setPorts]               = useState<ListeningPort[]>([]);
  const [isScanning, setIsScanning]     = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [deepCheckOpen, setDeepCheckOpen] = useState(false);
  const [error, setError]               = useState('');
  const [host, setHost]                 = useState('');
  const [lastScanAt, setLastScanAt]     = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load snapshot list + drift on mount
  const loadAll = useCallback(async () => {
    try {
      const { snapshots: list } = await apiGetSnapshots();
      setSnapshots(list);
      if (list.length) {
        setScoreHistory(list.slice(-20).map(s => s.blast_radius_score ?? 0));
        const latest = list.reduce((a, b) =>
          new Date(a.timestamp) > new Date(b.timestamp) ? a : b);
        setLastScanAt(latest.timestamp);
        setHost(latest.host ?? '');
        // Load full snapshot for current + baseline
        const baseline = list.find(s => s.is_baseline);
        const [full, base] = await Promise.all([
          apiGetSnapshot(latest.scan_id),
          baseline ? apiGetSnapshot(baseline.scan_id) : Promise.resolve(null),
        ]);
        setCurrentSnap(full);
        setBaselineSnap(base);
        setSelectedId(latest.scan_id);
        setPorts(full.listening_ports ?? []);
        if (full.host) setHost(full.host);

        // Save for export
        localStorage.setItem('pd_last_snapshot', JSON.stringify(full));

        // Drift
        try {
          const drift = await apiGetDrift();
          setDriftEvents(drift.events ?? []);
          setPrevScore(driftScore);
          setDriftScore(drift.blast_radius_score ?? 0);
        } catch { /* no baseline yet */ }
      }
    } catch (e: any) {
      setError('Could not reach API — is the Flask server running?');
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Rebuild trees whenever baseline/current changes
  useEffect(() => {
    const { baselineTree: bt, currentTree: ct } = snapshotToTrees(baselineSnap, currentSnap);
    setBaselineTree(bt);
    setCurrentTree(ct);
  }, [baselineSnap, currentSnap]);

  // When user selects a snapshot in sidebar
  const handleSelectSnapshot = async (snap: SnapshotSummary) => {
    setSelectedId(snap.scan_id);
    try {
      const full = await apiGetSnapshot(snap.scan_id);
      setCurrentSnap(full);
      setPorts(full.listening_ports ?? []);
    } catch {}
  };

  // Scan
  const handleScan = async () => {
    setIsScanning(true);
    setScanProgress(5);
    setError('');
    try {
      const { job_id } = await apiScan();
      setScanProgress(20);
      let prog = 20;
      const tick = async () => {
        try {
          const job = await apiPollJob(job_id);
          prog = Math.min(prog + 15, 92);
          setScanProgress(prog);
          if (job.status === 'done') {
            setScanProgress(100);
            setTimeout(async () => {
              setIsScanning(false);
              setScanProgress(0);
              await loadAll();
            }, 500);
          } else if (job.status === 'error') {
            setError(job.error || 'Scan failed');
            setIsScanning(false);
          } else {
            pollTimer.current = setTimeout(tick, 800);
          }
        } catch {
          setError('Lost contact with API during scan');
          setIsScanning(false);
        }
      };
      pollTimer.current = setTimeout(tick, 800);
    } catch (e: any) {
      setError(e.message);
      setIsScanning(false);
    }
  };

  useEffect(() => () => { if (pollTimer.current) clearTimeout(pollTimer.current); }, []);

  // Baseline
  const handleBaseline = async (id: string) => {
    await apiSetBaseline(id);
    await loadAll();
  };

  return (
    <div className="min-h-screen text-slate-200 relative" style={{ background: '#07090d' }}>
      {/* Scanline grid overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(to right, #0e131f 1px, transparent 1px), linear-gradient(to bottom, #0e131f 1px, transparent 1px)',
          backgroundSize: '3.5rem 3.5rem',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)',
        }}
      />

      <Navbar
        host={host}
        isScanning={isScanning}
        scanProgress={scanProgress}
        lastScanAt={lastScanAt}
        onScan={handleScan}
        onOpenDeepCheck={() => setDeepCheckOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-3.5 rounded-xl border border-red-900/60 bg-red-950/20 font-mono text-xs text-red-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* No baseline notice */}
        {snapshots.length > 0 && !snapshots.some(s => s.is_baseline) && (
          <div className="mb-6 flex items-center gap-3 p-3.5 rounded-xl border border-amber-900/40 bg-amber-950/10 font-mono text-xs text-amber-400">
            <Star className="w-4 h-4 flex-shrink-0" />
            Hover a snapshot in the sidebar and click <strong className="mx-1">"Set as baseline"</strong>
            to begin drift detection.
          </div>
        )}

        {/* Top grid: Blast radius + Privilege diff */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-1">
            <BlastRadiusGauge
              score={driftScore}
              prevScore={prevScore}
              scoreHistory={scoreHistory}
            />
          </div>
          <div className="lg:col-span-2">
            <MondayVsFriday
              baselineTree={baselineTree}
              currentTree={currentTree}
              baselineLabel={snapshots.find(s => s.is_baseline) ? 'BASELINE POSTURE' : 'BASELINE (not set)'}
              currentLabel={currentSnap ? `CURRENT · ${fmt(currentSnap.timestamp)}` : 'CURRENT AUDIT'}
            />
          </div>
        </div>

        {/* 2-col lower grid: Radar + History sidebar */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
          <div className="xl:col-span-3">
            <SurfaceRadar ports={ports} />
          </div>
          <div className="xl:col-span-1">
            <SnapshotPanel
              snapshots={snapshots}
              selectedId={selectedId}
              onSelect={handleSelectSnapshot}
              onBaseline={handleBaseline}
            />
          </div>
        </div>

        {/* Drift feed */}
        <DriftFeed events={driftEvents} loading={isScanning && driftEvents.length === 0} />
      </main>

      <DeepCheckModal isOpen={deepCheckOpen} onClose={() => setDeepCheckOpen(false)} />
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ThreeHeroBackground } from './components/ThreeHeroBackground';
import { BlastRadiusGauge } from './components/BlastRadiusGauge';
import { MondayVsFriday } from './components/MondayVsFriday';
import { DriftFeed } from './components/DriftFeed';
import { SurfaceRadar } from './components/SurfaceRadar';
import { DeepCheckModal } from './components/DeepCheckModal';
import { AIReportModal } from './components/AIReportModal';
import {
  apiScan,
  apiPollJob,
  apiGetSnapshots,
  apiGetSnapshot,
  apiGetDrift,
  apiSetBaseline,
  snapshotToTrees,
} from './lib/api';
import type {
  SnapshotSummary,
  FullSnapshot,
  DriftEvent,
  TreeItem,
  ListeningPort,
} from './types/drift';
import {
  ShieldAlert,
  Terminal,
  RefreshCw,
  Radio,
  HardDriveDownload,
  Star,
  Database,
  Clock,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
  Search,
  Sparkles,
} from 'lucide-react';

function fmt(ts: string) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function relTime(ts: string | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function App() {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [baselineSnap, setBaselineSnap] = useState<FullSnapshot | null>(null);
  const [currentSnap, setCurrentSnap] = useState<FullSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [driftEvents, setDriftEvents] = useState<DriftEvent[]>([]);
  const [driftScore, setDriftScore] = useState(0);
  const [prevScore, setPrevScore] = useState(0);
  const [scoreHistory, setScoreHistory] = useState<number[]>([]);
  const [baselineTree, setBaselineTree] = useState<TreeItem[]>([]);
  const [currentTree, setCurrentTree] = useState<TreeItem[]>([]);
  const [ports, setPorts] = useState<ListeningPort[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [deepCheckOpen, setDeepCheckOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [host, setHost] = useState('');
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const { snapshots: list } = await apiGetSnapshots();
      setSnapshots(list);
      if (list.length) {
        setScoreHistory(list.slice(-20).map((s) => s.blast_radius_score ?? 0));
        const latest = list.reduce((a, b) =>
          new Date(a.timestamp) > new Date(b.timestamp) ? a : b
        );
        setLastScanAt(latest.timestamp);
        setHost(latest.host ?? '');

        const baseline = list.find((s) => s.is_baseline);
        const [full, base] = await Promise.all([
          apiGetSnapshot(latest.scan_id),
          baseline ? apiGetSnapshot(baseline.scan_id) : Promise.resolve(null),
        ]);
        setCurrentSnap(full);
        setBaselineSnap(base);
        setSelectedId(latest.scan_id);
        setPorts(full.listening_ports ?? []);
        if (full.host) setHost(full.host);

        localStorage.setItem('pd_last_snapshot', JSON.stringify(full));

        try {
          const drift = await apiGetDrift();
          setDriftEvents(drift.events ?? []);
          setPrevScore(driftScore);
          setDriftScore(drift.blast_radius_score ?? 0);
        } catch {
          /* no baseline yet */
        }
      }
    } catch {
      setError('Could not reach API — is the Flask server running?');
    }
  }, [driftScore]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    const { baselineTree: bt, currentTree: ct } = snapshotToTrees(baselineSnap, currentSnap);
    setBaselineTree(bt);
    setCurrentTree(ct);
  }, [baselineSnap, currentSnap]);

  const handleSelectSnapshot = async (snap: SnapshotSummary) => {
    setSelectedId(snap.scan_id);
    try {
      const full = await apiGetSnapshot(snap.scan_id);
      setCurrentSnap(full);
      setPorts(full.listening_ports ?? []);
    } catch {}
  };

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

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  const handleBaseline = async (id: string) => {
    await apiSetBaseline(id);
    await loadAll();
  };

  const scrollToTelemetry = () => {
    const el = document.getElementById('telemetry-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen bg-white text-neutral-900 antialiased selection:bg-neutral-200 selection:text-black">
      {/* 1. Live Three.js Wireframe Torus & Sparkle Particles Background */}
      <ThreeHeroBackground />

      {/* 2. Top Navigation Bar (Industrial Minimalist Header) */}
      <header className="relative z-20 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md sticky top-0 px-6 sm:px-12 py-4">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shadow-sm">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-bold tracking-tight text-neutral-900">PermissionDrift</span>
                <span className="text-[10px] uppercase font-geist-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                  Local-First EDR
                </span>
              </div>
              <p className="font-geist-mono text-xs text-neutral-500 flex items-center gap-1.5 mt-0.5">
                <Terminal className="w-3 h-3 text-neutral-400" />
                <span>Host:</span>
                <span className="text-neutral-800 font-semibold">{host || '127.0.0.1'}</span>
                <span className="text-neutral-300">·</span>
                <span>Last scan: {relTime(lastScanAt)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setAiModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 font-geist-mono text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm font-medium"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>AI Threat Report</span>
            </button>

            <button
              onClick={() => setDeepCheckOpen(true)}
              className="px-3.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100/70 font-geist-mono text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Radio className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>Port Probe</span>
            </button>

            <button
              onClick={handleScan}
              disabled={isScanning}
              className={`px-4 py-1.5 rounded-lg font-medium text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                isScanning
                  ? 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                  : 'bg-black text-white hover:bg-neutral-800'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? `Auditing handles (${scanProgress}%)` : 'Scan Posture'}</span>
            </button>

            <button
              title="Export Snapshot JSON"
              onClick={() => {
                const data = localStorage.getItem('pd_last_snapshot');
                if (data) {
                  const blob = new Blob([data], { type: 'application/json' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = 'permissiondrift_snapshot.json';
                  a.click();
                }
              }}
              className="p-2 rounded-lg border border-neutral-200 hover:bg-neutral-100 text-neutral-600 hover:text-black transition-colors"
            >
              <HardDriveDownload className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 3. Hero Section directly over the Three.js canvas */}
      <section className="relative z-10 w-full min-h-[calc(100vh-73px)] flex flex-col justify-between p-6 sm:p-12 max-w-[1400px] mx-auto pointer-events-none">
        <div />

        {/* Hero Footer Statement */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-12 pointer-events-auto mb-6">
          <div className="max-w-md space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-geist-mono border border-neutral-200 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Zero secret values read · Process &amp; Handle monitor
            </div>
            <p className="text-base sm:text-lg leading-relaxed text-neutral-600 font-normal">
              Continuous baseline auditing for developer machines. Snapshots file handles, Docker pipes, AWS/Kube tokens, and flags unannounced permission widening with instant remediation.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={scrollToTelemetry}
                className="group flex items-center gap-2 text-xs font-bold tracking-widest uppercase border-b-2 border-black pb-1 hover:text-neutral-600 hover:border-neutral-400 transition-all cursor-pointer font-geist-mono"
              >
                Inspect Live Posture <span className="group-hover:translate-y-0.5 transition-transform duration-300">↓</span>
              </button>
              <button
                onClick={() => setAiModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-geist-mono uppercase tracking-wider font-semibold text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Forensic Report →</span>
              </button>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="text-xs font-geist-mono uppercase tracking-wider font-semibold text-neutral-500 hover:text-black transition-colors"
              >
                Run Scan Now →
              </button>
            </div>
          </div>

          <div className="text-right">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.88] text-neutral-950">
              <span className="block">Permission</span>
              <span className="block">Drift</span>
            </h1>
            <p className="text-xl md:text-3xl text-neutral-400 font-light mt-3 tracking-tight font-geist-mono">
              Machine Access &amp; Handle Radar
            </p>
          </div>
        </div>
      </section>

      {/* 4. Telemetry Console (Cards floating gracefully over the Three.js canvas with glassmorphism) */}
      <main id="telemetry-section" className="relative z-10 max-w-[1400px] mx-auto px-6 sm:px-12 pb-24 space-y-8">
        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-200 bg-red-50/90 backdrop-blur-md font-geist-mono text-xs text-red-700 shadow-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Baseline Guidance */}
        {snapshots.length > 0 && !snapshots.some((s) => s.is_baseline) && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-200 bg-amber-50/90 backdrop-blur-md font-geist-mono text-xs text-amber-800 shadow-sm">
            <Star className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              Click <strong>"★ Set baseline"</strong> on any historical snapshot to begin automated drift detection against that clean state.
            </span>
          </div>
        )}

        {/* Top telemetry grid: Blast Radius Gauge + Mutation Diff */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <BlastRadiusGauge score={driftScore} prevScore={prevScore} scoreHistory={scoreHistory} />
          </div>
          <div className="lg:col-span-2">
            <MondayVsFriday
              baselineTree={baselineTree}
              currentTree={currentTree}
              baselineLabel={snapshots.find((s) => s.is_baseline) ? 'ESTABLISHED BASELINE' : 'BASELINE (NOT SET)'}
              currentLabel={currentSnap ? `ACTIVE SCAN (${fmt(currentSnap.timestamp)})` : 'ACTIVE SCAN'}
            />
          </div>
        </div>

        {/* Middle grid: Socket Radar + History Panel */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-3">
            <SurfaceRadar ports={ports} />
          </div>
          <div className="xl:col-span-1">
            <div className="rounded-2xl border border-neutral-200/80 bg-white/75 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all h-full">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-neutral-100">
                <Database className="w-4 h-4 text-neutral-800" />
                <span className="font-geist-mono text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Audit History ({snapshots.length})
                </span>
              </div>
              {snapshots.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2 text-center">
                  <Clock className="w-8 h-8 text-neutral-300" />
                  <p className="font-geist-mono text-xs text-neutral-400">No audits recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {snapshots.map((snap) => {
                    const isSelected = snap.scan_id === selectedId;
                    return (
                      <div
                        key={snap.scan_id}
                        onClick={() => handleSelectSnapshot(snap)}
                        className={`group relative p-3 rounded-xl cursor-pointer border transition-all ${
                          isSelected
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                            : 'bg-neutral-50/70 text-neutral-700 border-neutral-200/80 hover:bg-neutral-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-geist-mono text-xs font-semibold">
                            {fmt(snap.timestamp)}
                          </span>
                          {snap.is_baseline && (
                            <span className="text-[10px] font-geist-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/40 font-bold">
                              ★ BASELINE
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-neutral-200/40 text-[11px] font-geist-mono">
                          <span className={isSelected ? 'text-neutral-300' : 'text-neutral-500'}>
                            Blast Radius: <strong className={isSelected ? 'text-white' : 'text-neutral-900'}>{snap.blast_radius_score}</strong>
                          </span>
                          {!snap.is_baseline && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBaseline(snap.scan_id);
                              }}
                              className={`text-[10px] font-semibold underline cursor-pointer ${
                                isSelected ? 'text-amber-400' : 'text-amber-600'
                              }`}
                            >
                              Set baseline
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom: Detected Drift Events Feed */}
        <DriftFeed events={driftEvents} loading={isScanning && driftEvents.length === 0} />
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-neutral-200/80 bg-white/80 backdrop-blur-md px-6 sm:px-12 py-8 text-center sm:text-left">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-geist-mono text-xs text-neutral-500">
          <div>
            <strong className="text-neutral-900">PermissionDrift</strong> — Local-first Developer Security Posture Monitor
          </div>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2 text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              127.0.0.1 Daemon Connected
            </span>
            <span>© 2026</span>
          </div>
        </div>
      </footer>

      {/* Deep Probe Modal */}
      <DeepCheckModal isOpen={deepCheckOpen} onClose={() => setDeepCheckOpen(false)} />

      {/* AI Cyber-Forensic Posture Report Modal */}
      <AIReportModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        snapshotId={selectedId}
      />
    </div>
  );
}

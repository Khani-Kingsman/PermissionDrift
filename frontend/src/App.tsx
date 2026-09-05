import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ThreeHeroBackground } from './components/ThreeHeroBackground';
import { BlastRadiusGauge } from './components/BlastRadiusGauge';
import { MondayVsFriday } from './components/MondayVsFriday';
import { DriftFeed } from './components/DriftFeed';
import { SurfaceRadar } from './components/SurfaceRadar';
import { DeepCheckModal } from './components/DeepCheckModal';
import { AIReportModal } from './components/AIReportModal';
import { EngineControlModal } from './components/EngineControlModal';
import logoDark from './assets/logo-dark.png';
import logoLight from './assets/logo-light.png';
import {
  apiScan,
  apiPollJob,
  apiGetSnapshots,
  apiGetSnapshot,
  apiGetDrift,
  apiSetBaseline,
  snapshotToTrees,
  apiGetEngineStatus,
  type EngineStatus,
} from './lib/api';
import type {
  SnapshotSummary,
  FullSnapshot,
  DriftEvent,
  TreeItem,
  ListeningPort,
} from './types/drift';
import {
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
  Sparkles,
  Moon,
  Sun,
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
  const [theme, setTheme] = useState<'black' | 'white'>(() => {
    const saved = localStorage.getItem('pd_theme');
    return saved === 'white' ? 'white' : 'black';
  });
  const isBlack = theme === 'black';

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
  const [engineModalOpen, setEngineModalOpen] = useState(false);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [error, setError] = useState('');
  const [host, setHost] = useState('');
  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggleTheme = (newTheme: 'black' | 'white') => {
    setTheme(newTheme);
    localStorage.setItem('pd_theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'black');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'black');
  }, [theme]);

  const loadEngineStatus = useCallback(async () => {
    try {
      const st = await apiGetEngineStatus();
      setEngineStatus(st);
    } catch {
      /* ignore if not yet available */
    }
  }, []);

  const loadAll = useCallback(async () => {
    try {
      loadEngineStatus();
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
  }, [driftScore, loadEngineStatus]);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadEngineStatus, 8000);
    return () => clearInterval(interval);
  }, [loadAll, loadEngineStatus]);

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
    <div className={`relative min-h-screen antialiased transition-colors duration-300 ${
      isBlack
        ? 'bg-[#090b10] text-slate-100 selection:bg-neutral-800 selection:text-white'
        : 'bg-white text-neutral-900 selection:bg-neutral-200 selection:text-black'
    }`}>
      {/* 1. Live Three.js Wireframe Torus & Sparkle Particles Background */}
      <ThreeHeroBackground theme={theme} />

      {/* 2. Top Navigation Bar (Industrial Minimalist Header) */}
      <header className={`relative z-20 border-b backdrop-blur-md sticky top-0 px-6 sm:px-12 py-3.5 transition-colors duration-300 ${
        isBlack
          ? 'border-neutral-800/80 bg-[#090b10]/90 text-white'
          : 'border-neutral-200/80 bg-white/80 text-neutral-900'
      }`}>
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Real Project Logo (Dynamic dark/light variant) */}
            <div className={`w-10 h-10 rounded-xl p-1 flex items-center justify-center transition-all ${
              isBlack
                ? 'bg-neutral-900/90 border border-neutral-700/80 shadow-[0_0_15px_rgba(249,115,22,0.2)]'
                : 'bg-white border border-neutral-200 shadow-sm'
            }`}>
              <img
                src={isBlack ? logoDark : logoLight}
                alt="PermissionDrift Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-lg font-bold tracking-tight ${isBlack ? 'text-white' : 'text-neutral-900'}`}>
                  PermissionDrift
                </span>
                <span className={`text-[10px] uppercase font-geist-mono px-2 py-0.5 rounded-full border ${
                  isBlack
                    ? 'bg-neutral-900 text-neutral-300 border-neutral-700'
                    : 'bg-neutral-100 text-neutral-600 border-neutral-200'
                }`}>
                  Local-First EDR
                </span>
              </div>
              <p className={`font-geist-mono text-xs flex items-center gap-1.5 mt-0.5 ${
                isBlack ? 'text-neutral-400' : 'text-neutral-500'
              }`}>
                <Terminal className={`w-3 h-3 ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`} />
                <span>Host:</span>
                <span className={`font-semibold ${isBlack ? 'text-neutral-200' : 'text-neutral-800'}`}>{host || '127.0.0.1'}</span>
                <span className={isBlack ? 'text-neutral-600' : 'text-neutral-300'}>·</span>
                <span>Last scan: {relTime(lastScanAt)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Tactile Black & White Toggle Button */}
            <div className={`flex items-center p-0.5 rounded-xl border transition-all ${
              isBlack
                ? 'border-neutral-800 bg-neutral-900/90'
                : 'border-neutral-200 bg-neutral-100/90'
            }`}>
              <button
                type="button"
                onClick={() => toggleTheme('black')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-geist-mono text-xs font-semibold transition-all cursor-pointer ${
                  isBlack
                    ? 'bg-black text-white shadow-sm ring-1 ring-neutral-700'
                    : 'text-neutral-500 hover:text-black'
                }`}
                title="Switch to Black Mode"
              >
                <Moon className="w-3.5 h-3.5 text-amber-400" />
                <span>Black</span>
              </button>
              <button
                type="button"
                onClick={() => toggleTheme('white')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-geist-mono text-xs font-semibold transition-all cursor-pointer ${
                  !isBlack
                    ? 'bg-white text-black shadow-sm ring-1 ring-neutral-200'
                    : 'text-neutral-500 hover:text-white'
                }`}
                title="Switch to White Mode"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>White</span>
              </button>
            </div>

            <button
              onClick={() => setEngineModalOpen(true)}
              className={`px-3 py-1.5 rounded-lg border font-geist-mono text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm font-medium ${
                engineStatus?.running
                  ? isBlack
                    ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/70'
                  : isBlack
                  ? 'border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:text-white hover:bg-neutral-800'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:text-black hover:bg-neutral-50'
              }`}
              title="Background Security Engine & Windows Boot Autostart"
            >
              <span className={`w-2 h-2 rounded-full ${engineStatus?.running ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-500'}`} />
              <Shield className="w-3.5 h-3.5" />
              <span>{engineStatus?.running ? 'Engine Active' : 'Start Engine'}</span>
            </button>

            <button
              onClick={() => setAiModalOpen(true)}
              className={`px-3.5 py-1.5 rounded-lg border font-geist-mono text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm font-medium ${
                isBlack
                  ? 'border-neutral-700 bg-neutral-900 text-white hover:bg-neutral-800'
                  : 'border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>AI Threat Report</span>
            </button>

            <button
              onClick={() => setDeepCheckOpen(true)}
              className={`px-3.5 py-1.5 rounded-lg border font-geist-mono text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                isBlack
                  ? 'border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50'
                  : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100/70'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
              <span>Port Probe</span>
            </button>

            <button
              onClick={handleScan}
              disabled={isScanning}
              className={`px-4 py-1.5 rounded-lg font-medium text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm ${
                isScanning
                  ? isBlack
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-neutral-200 text-neutral-500 cursor-not-allowed'
                  : isBlack
                  ? 'bg-white text-black hover:bg-neutral-200 font-semibold shadow-[0_0_20px_rgba(255,255,255,0.1)]'
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
              className={`p-2 rounded-lg border transition-colors ${
                isBlack
                  ? 'border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white'
                  : 'border-neutral-200 hover:bg-neutral-100 text-neutral-600 hover:text-black'
              }`}
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
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-geist-mono border shadow-sm ${
              isBlack
                ? 'bg-neutral-900/90 text-neutral-200 border-neutral-700'
                : 'bg-neutral-100 text-neutral-800 border-neutral-200'
            }`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Zero secret values read · Process &amp; Handle monitor
            </div>
            <p className={`text-base sm:text-lg leading-relaxed font-normal ${
              isBlack ? 'text-neutral-300' : 'text-neutral-600'
            }`}>
              Continuous baseline auditing for developer machines. Snapshots file handles, Docker pipes, AWS/Kube tokens, and flags unannounced permission widening with instant remediation.
            </p>
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={scrollToTelemetry}
                className={`group flex items-center gap-2 text-xs font-bold tracking-widest uppercase border-b-2 pb-1 transition-all cursor-pointer font-geist-mono ${
                  isBlack
                    ? 'border-white text-white hover:text-neutral-300 hover:border-neutral-400'
                    : 'border-black text-neutral-900 hover:text-neutral-600 hover:border-neutral-400'
                }`}
              >
                Inspect Live Posture <span className="group-hover:translate-y-0.5 transition-transform duration-300">↓</span>
              </button>
              <button
                onClick={() => setAiModalOpen(true)}
                className={`inline-flex items-center gap-1.5 text-xs font-geist-mono uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
                  isBlack ? 'text-amber-400 hover:text-amber-300' : 'text-amber-700 hover:text-amber-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Forensic Report →</span>
              </button>
              <button
                onClick={handleScan}
                disabled={isScanning}
                className={`text-xs font-geist-mono uppercase tracking-wider font-semibold transition-colors ${
                  isBlack ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-black'
                }`}
              >
                Run Scan Now →
              </button>
              <button
                onClick={() => setEngineModalOpen(true)}
                className={`inline-flex items-center gap-1.5 text-xs font-geist-mono uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
                  engineStatus?.running
                    ? 'text-emerald-500 hover:text-emerald-400'
                    : isBlack
                    ? 'text-neutral-400 hover:text-neutral-200'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>{engineStatus?.running ? '● Engine Running' : '⚙️ Setup Autostart →'}</span>
              </button>
            </div>
          </div>

          <div className="text-right">
            {/* Prominent Logo Badge in Hero */}
            <div className="flex justify-end mb-3">
              <div className={`p-2.5 rounded-2xl border transition-all ${
                isBlack
                  ? 'bg-neutral-900/70 border-neutral-700/70 shadow-[0_0_30px_rgba(249,115,22,0.25)] ring-1 ring-neutral-700/50'
                  : 'bg-white/85 border-neutral-200/90 shadow-md ring-1 ring-neutral-100'
              }`}>
                <img
                  src={isBlack ? logoDark : logoLight}
                  alt="PermissionDrift Mesh Knot Logo"
                  className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-sm transition-all"
                />
              </div>
            </div>
            <h1 className={`text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.88] ${
              isBlack ? 'text-white' : 'text-neutral-950'
            }`}>
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
          <div className={`flex items-center gap-3 p-4 rounded-2xl border backdrop-blur-md font-geist-mono text-xs shadow-sm ${
            isBlack
              ? 'border-amber-800/60 bg-amber-950/30 text-amber-200'
              : 'border-amber-200 bg-amber-50/90 text-amber-800'
          }`}>
            <Star className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>
              Click <strong>"★ Set baseline"</strong> on any historical snapshot to begin automated drift detection against that clean state.
            </span>
          </div>
        )}

        {/* Top telemetry grid: Blast Radius Gauge + Mutation Diff */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <BlastRadiusGauge score={driftScore} prevScore={prevScore} scoreHistory={scoreHistory} theme={theme} />
          </div>
          <div className="lg:col-span-2">
            <MondayVsFriday
              baselineTree={baselineTree}
              currentTree={currentTree}
              baselineLabel={snapshots.find((s) => s.is_baseline) ? 'ESTABLISHED BASELINE' : 'BASELINE (NOT SET)'}
              currentLabel={currentSnap ? `ACTIVE SCAN (${fmt(currentSnap.timestamp)})` : 'ACTIVE SCAN'}
              theme={theme}
            />
          </div>
        </div>

        {/* Middle grid: Socket Radar + History Panel */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-3">
            <SurfaceRadar ports={ports} theme={theme} />
          </div>
          <div className="xl:col-span-1">
            <div className={`rounded-2xl border backdrop-blur-md p-6 transition-all h-full ${
              isBlack
                ? 'border-neutral-800/80 bg-[#0f1219]/85 text-white shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
                : 'border-neutral-200/80 bg-white/75 text-neutral-900 shadow-sm hover:shadow-md'
            }`}>
              <div className={`flex items-center gap-2 mb-4 pb-3 border-b ${
                isBlack ? 'border-neutral-800' : 'border-neutral-100'
              }`}>
                <Database className={`w-4 h-4 ${isBlack ? 'text-neutral-300' : 'text-neutral-800'}`} />
                <span className={`font-geist-mono text-xs font-bold uppercase tracking-wider ${
                  isBlack ? 'text-neutral-300' : 'text-neutral-700'
                }`}>
                  Audit History ({snapshots.length})
                </span>
              </div>
              {snapshots.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2 text-center">
                  <Clock className={`w-8 h-8 ${isBlack ? 'text-neutral-700' : 'text-neutral-300'}`} />
                  <p className={`font-geist-mono text-xs ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    No audits recorded yet.
                  </p>
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
                            ? isBlack
                              ? 'bg-white text-black border-white shadow-sm'
                              : 'bg-neutral-900 text-white border-neutral-900 shadow-sm'
                            : isBlack
                            ? 'bg-[#151922]/70 text-neutral-300 border-neutral-800/80 hover:bg-[#1c2230]'
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
                        <div className={`flex items-center justify-between mt-2 pt-1 border-t text-[11px] font-geist-mono ${
                          isSelected
                            ? isBlack
                              ? 'border-neutral-200 text-neutral-700'
                              : 'border-neutral-700 text-neutral-300'
                            : isBlack
                            ? 'border-neutral-800 text-neutral-400'
                            : 'border-neutral-200/40 text-neutral-500'
                        }`}>
                          <span>
                            Blast Radius: <strong className={isSelected ? (isBlack ? 'text-black' : 'text-white') : (isBlack ? 'text-white' : 'text-neutral-900')}>{snap.blast_radius_score}</strong>
                          </span>
                          {!snap.is_baseline && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBaseline(snap.scan_id);
                              }}
                              className={`text-[10px] font-semibold underline cursor-pointer ${
                                isSelected ? (isBlack ? 'text-amber-800 font-bold' : 'text-amber-400') : (isBlack ? 'text-amber-400' : 'text-amber-600')
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
        <DriftFeed events={driftEvents} loading={isScanning && driftEvents.length === 0} theme={theme} />
      </main>

      {/* Footer */}
      <footer className={`relative z-10 border-t backdrop-blur-md px-6 sm:px-12 py-8 text-center sm:text-left transition-colors duration-300 ${
        isBlack
          ? 'border-neutral-800/80 bg-[#090b10]/90 text-neutral-400'
          : 'border-neutral-200/80 bg-white/80 text-neutral-500'
      }`}>
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 font-geist-mono text-xs">
          <div className="flex items-center gap-2.5 justify-center sm:justify-start">
            <img
              src={isBlack ? logoDark : logoLight}
              alt="PermissionDrift Logo"
              className="w-5 h-5 object-contain"
            />
            <span>
              <strong className={isBlack ? 'text-white' : 'text-neutral-900'}>PermissionDrift</strong> — Local-first Developer Security Posture Monitor
            </span>
          </div>
          <div className="flex items-center gap-6 justify-center sm:justify-end">
            <span className="flex items-center gap-2 text-emerald-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              127.0.0.1 Daemon Connected
            </span>
            <span>© 2026</span>
          </div>
        </div>
      </footer>

      {/* Deep Probe Modal */}
      <DeepCheckModal isOpen={deepCheckOpen} onClose={() => setDeepCheckOpen(false)} theme={theme} />

      {/* AI Cyber-Forensic Posture Report Modal */}
      <AIReportModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        snapshotId={selectedId}
        theme={theme}
      />

      {/* Background Security Engine & Windows Autostart Modal */}
      <EngineControlModal
        isOpen={engineModalOpen}
        onClose={() => setEngineModalOpen(false)}
        status={engineStatus}
        onStatusChange={setEngineStatus}
        theme={theme}
      />
    </div>
  );
}

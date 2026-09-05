import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ThreeHeroBackground } from './components/ThreeHeroBackground';
import { SideRail } from './components/SideRail';
import { BlastRadiusGauge } from './components/BlastRadiusGauge';
import { MondayVsFriday } from './components/MondayVsFriday';
import { DriftFeed } from './components/DriftFeed';
import { SurfaceRadar } from './components/SurfaceRadar';
import { DeepCheckModal } from './components/DeepCheckModal';
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
  ArrowDownRight,
  ArrowRight,
  Paintbrush,
  Code2,
  Layout,
  Plus,
  Quote,
  CheckCircle2,
  Lock,
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

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-white text-neutral-900 antialiased selection:bg-neutral-200 selection:text-black min-h-screen">
      {/* Side Rail Navigation (Fixed, Light Theme) */}
      <SideRail onScrollTo={scrollToSection} />

      {/* SECTION 1 - Hero Section with Contained 3D Background */}
      <header className="relative w-full h-screen flex flex-col justify-between p-6 sm:p-12 z-10 pointer-events-none overflow-hidden bg-white">
        {/* Contained Three.js Canvas */}
        <ThreeHeroBackground />

        {/* Top Nav */}
        <div className="flex justify-between items-start pointer-events-auto w-full max-w-[1400px] mx-auto z-10">
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold tracking-tight text-black">ux.jonny</div>
            <span className="hidden sm:inline-block text-[10px] uppercase font-geist-mono px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
              Security · PermissionDrift
            </span>
          </div>
          <nav className="hidden sm:flex gap-8 text-xs font-medium text-neutral-500 uppercase tracking-wide items-center">
            <a href="#main-content" className="hover:text-black transition-colors">
              sobre
            </a>
            <a href="#posture-console" className="hover:text-black transition-colors font-bold text-cyan-600">
              posture telemetry
            </a>
            <a href="#work" className="hover:text-black transition-colors">
              projetos
            </a>
            <a
              href="https://www.linkedin.com/in/jonathan-fernandes-a8208410a/"
              target="_blank"
              rel="noreferrer"
              className="hover:text-black transition-colors"
            >
              Linkedin
            </a>
            <a
              href="https://api.whatsapp.com/send/?phone=5521972139499&text=Preciso+de+ajuda+com+a+plataforma+Gamble+Sports&type=phone_number&app_absent=0"
              target="_blank"
              rel="noreferrer"
              className="hover:text-black transition-colors"
            >
              contato
            </a>
          </nav>
        </div>

        {/* Hero Footer Content */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-12 pointer-events-auto w-full max-w-[1400px] mx-auto mb-4 z-10">
          {/* Left Info */}
          <div className="max-w-xs space-y-8">
            <p className="text-sm leading-relaxed text-neutral-600 font-medium">
              Senior Product Designer na Allos. Construo Design Systems e experiências de produto escaláveis,
              aplicando IA para criar, acelerar consistência, documentação e entrega.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => scrollToSection('main-content')}
                className="group flex items-center gap-2 text-xs font-bold tracking-widest uppercase border-b border-black pb-1 hover:text-neutral-600 hover:border-neutral-400 transition-all cursor-pointer"
              >
                Explorar <span className="group-hover:translate-y-0.5 transition-transform duration-300">↓</span>
              </button>
              <button
                onClick={() => scrollToSection('posture-console')}
                className="flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-800 transition-colors uppercase tracking-wider font-geist-mono"
              >
                Inspect Drift →
              </button>
            </div>
          </div>

          {/* Right Title */}
          <div className="text-right">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tighter leading-[0.85] text-black">
              <span className="block">Product Designer</span>
              <span className="block">&amp; Design System</span>
            </h1>
            <p className="text-2xl md:text-4xl text-neutral-400 font-normal mt-3 tracking-tight">since 2018</p>
          </div>
        </div>
      </header>

      {/* Main Content Flow */}
      <main id="main-content" className="relative z-20 bg-white">
        {/* SECTION 2 - Profile & Intro Section */}
        <section id="about" className="sm:px-8 px-6 pt-20 pb-16 border-t border-neutral-100">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              {/* Portrait Section (Grayscale hover transition) */}
              <div className="lg:col-span-5 icon:lg:col-span-5">
                <div className="relative overflow-hidden bg-neutral-100 rounded-2xl aspect-[4/5] shadow-sm">
                  <img
                    src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/27df3787-21a9-4fa7-b980-f3d42a608eed_800w.png"
                    alt="Portrait"
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700 cursor-pointer"
                  />
                </div>
              </div>

              {/* Content Section */}
              <div className="lg:col-span-7">
                <div className="flex flex-col justify-center h-full">
                  <div className="flex items-center gap-3 mb-6">
                    <ArrowDownRight className="w-4 h-4 text-neutral-400" />
                    <div className="h-px flex-1 bg-neutral-200"></div>
                  </div>

                  <h2 className="text-3xl font-semibold text-neutral-900 mb-6 tracking-tight">Product Designer</h2>
                  <p className="text-lg leading-relaxed text-neutral-600 mb-8 font-geist-mono">
                    Sou Product Designer com 9 anos de experiência e atualmente atuo como Senior Product Designer na
                    Allos. Crio interfaces escaláveis com Design Systems sólidos — de tokens a componentes — garantindo
                    consistência, eficiência e experiências digitais de alta qualidade para times de produto e
                    tecnologia.
                  </p>

                  {/* Skills / Industrias */}
                  <div className="grid grid-cols-2 gap-4 mb-10">
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-neutral-900 font-geist-mono uppercase tracking-wide">
                        SKILLS
                      </h3>
                      <ul className="text-sm text-neutral-500 space-y-2">
                        <li className="font-geist-mono">• UI/UX Design</li>
                        <li className="font-geist-mono">• UX/AI Design</li>
                        <li className="font-geist-mono">• Design Systems</li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-neutral-900 font-geist-mono uppercase tracking-wide">
                        INDUSTRIAS
                      </h3>
                      <ul className="text-sm text-neutral-500 space-y-2">
                        <li className="font-geist-mono">• Seguros</li>
                        <li className="font-geist-mono">• Shopping Centers</li>
                        <li className="font-geist-mono">• Enterprise Solutions</li>
                      </ul>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <a
                      href="#work"
                      className="px-6 py-3 rounded-lg bg-neutral-900 text-white font-medium hover:bg-neutral-800 transition-colors font-geist-mono text-sm shadow-sm"
                    >
                      Ver portfolio
                    </a>
                    <a
                      href="https://api.whatsapp.com/send/?phone=5521972139499&text=Preciso+de+ajuda+com+a+plataforma+Gamble+Sports&type=phone_number&app_absent=0"
                      target="_blank"
                      rel="noreferrer"
                      className="px-6 py-3 rounded-lg border border-neutral-200 text-neutral-900 font-medium hover:bg-neutral-50 transition-colors font-geist-mono text-sm"
                    >
                      Falar no Whatsapp
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── HIGH-ENGINEERING SECURITY MONITOR / PERMISSIONDRIFT TELEMETRY SECTION ── */}
        <section id="posture-console" className="border-t border-neutral-200 bg-[#07090d] text-slate-200 py-20 px-6 sm:px-8 relative">
          {/* Subtle grid pattern background */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage:
                'linear-gradient(to right, #0e131f 1px, transparent 1px), linear-gradient(to bottom, #0e131f 1px, transparent 1px)',
              backgroundSize: '3.5rem 3.5rem',
            }}
          />

          <div className="max-w-7xl mx-auto relative z-10">
            {/* Engineering Toolbar & Machine Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-8 border-b border-cyan-950/80 gap-4">
              <div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div>
                    <h2
                      className="text-xl font-bold tracking-tight text-white flex items-center gap-2"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      PermissionDrift Security Telemetry
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-400 border border-cyan-800/40 font-normal">
                        v1.2.0-win32
                      </span>
                    </h2>
                    <p className="font-mono text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <Terminal className="w-3 h-3 text-cyan-600" />
                      <span>Host:</span>
                      <span className="text-slate-200 font-semibold">{host || 'Local Workstation'}</span>
                      <span className="text-slate-600">·</span>
                      <span>Last scan: {relTime(lastScanAt)}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => setDeepCheckOpen(true)}
                  className="px-3.5 py-1.5 rounded-md border border-amber-500/30 bg-amber-950/20 text-amber-400 hover:bg-amber-900/30 font-mono text-xs flex items-center gap-2 transition-all cursor-pointer hover:border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
                >
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>Port Probe (Deep Check)</span>
                </button>

                <button
                  onClick={handleScan}
                  disabled={isScanning}
                  className={`px-4 py-1.5 rounded-md font-medium text-xs flex items-center gap-2 transition-all cursor-pointer ${
                    isScanning
                      ? 'bg-cyan-950 text-cyan-600 border border-cyan-900 cursor-not-allowed'
                      : 'bg-cyan-500/10 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                  }`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? `Inspecting Handles (${scanProgress}%)` : 'Scan Posture'}</span>
                </button>

                <button
                  title="Export Baseline JSON"
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
                  className="p-2 rounded-md border border-slate-800 hover:border-slate-700 bg-slate-900/50 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <HardDriveDownload className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-6 flex items-center gap-3 p-3.5 rounded-xl border border-red-900/60 bg-red-950/20 font-mono text-xs text-red-400">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
                <button onClick={() => setError('')} className="ml-auto opacity-60 hover:opacity-100">
                  ✕
                </button>
              </div>
            )}

            {/* Top Row: Blast Radius + Mutation Diff */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-1">
                <BlastRadiusGauge score={driftScore} prevScore={prevScore} scoreHistory={scoreHistory} />
              </div>
              <div className="lg:col-span-2">
                <MondayVsFriday
                  baselineTree={baselineTree}
                  currentTree={currentTree}
                  baselineLabel={snapshots.find((s) => s.is_baseline) ? 'BASELINE POSTURE' : 'BASELINE (not set)'}
                  currentLabel={currentSnap ? `CURRENT · ${fmt(currentSnap.timestamp)}` : 'CURRENT AUDIT'}
                />
              </div>
            </div>

            {/* Middle Row: Radar + Snapshot History */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
              <div className="xl:col-span-3">
                <SurfaceRadar ports={ports} />
              </div>
              <div className="xl:col-span-1">
                <div className="rounded-xl border border-cyan-950/80 bg-[#0d1017]/90 p-4 backdrop-blur-md h-full">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-800/60">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-mono text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      History ({snapshots.length})
                    </span>
                  </div>
                  {snapshots.length === 0 ? (
                    <div className="flex flex-col items-center py-8 gap-2 text-center">
                      <Clock className="w-8 h-8 text-slate-700" />
                      <p className="font-mono text-xs text-slate-600">
                        No scans yet. Click "Scan Posture" to start.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                      {snapshots.map((snap, i) => {
                        const isSelected = snap.scan_id === selectedId;
                        const scoreColor =
                          snap.blast_radius_score >= 70
                            ? 'text-red-400'
                            : snap.blast_radius_score >= 40
                            ? 'text-amber-400'
                            : 'text-emerald-400';

                        return (
                          <div
                            key={snap.scan_id}
                            onClick={() => handleSelectSnapshot(snap)}
                            className={`group relative flex items-start gap-2.5 p-2 rounded-lg cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-cyan-950/30 border border-cyan-800/40'
                                : 'hover:bg-slate-900/40 border border-transparent'
                            }`}
                          >
                            <div className="flex flex-col items-center flex-shrink-0 pt-1">
                              <div
                                className="w-2 h-2 rounded-full"
                                style={{
                                  background: snap.is_baseline ? '#f59e0b' : isSelected ? '#22d3ee' : '#1e2d45',
                                  boxShadow: snap.is_baseline
                                    ? '0 0 6px rgba(245,158,11,0.5)'
                                    : isSelected
                                    ? '0 0 6px rgba(34,211,238,0.5)'
                                    : 'none',
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-mono text-[11px] ${isSelected ? 'text-cyan-300' : 'text-slate-300'}`}>
                                  {fmt(snap.timestamp)}
                                </span>
                                {snap.is_baseline && <Star className="w-3 h-3 text-amber-400" />}
                              </div>
                              <div className="flex items-center justify-between mt-0.5">
                                <span className={`font-mono text-[10px] font-bold ${scoreColor}`}>
                                  Score: {snap.blast_radius_score}
                                </span>
                                {!snap.is_baseline && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBaseline(snap.scan_id);
                                    }}
                                    className="font-mono text-[9px] text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-amber-300"
                                  >
                                    ★ Set baseline
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Row: Full Drift Feed */}
            <DriftFeed events={driftEvents} loading={isScanning && driftEvents.length === 0} />
          </div>
        </section>

        {/* SECTION 3 - Services Section (Light Theme) */}
        <section className="sm:px-8 px-6 bg-neutral-50 border-t border-neutral-200">
          <div className="py-24 max-w-6xl mx-auto">
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-geist-mono">
                  Services
                </span>
                <div className="h-px flex-1 bg-neutral-200"></div>
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900 mb-4">Habilidades</h2>
              <p className="text-lg text-neutral-500 font-geist-mono max-w-2xl">
                Design, identity, development, and growth — crafted as polished, cohesive experiences.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* UX/UI Design */}
              <div className="group bg-white border border-neutral-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300">
                <div className="h-48 mb-6 bg-neutral-100 rounded-xl overflow-hidden relative border border-neutral-100">
                  <div className="absolute inset-4 bg-white shadow-sm rounded-lg border border-neutral-200 p-3">
                    <div className="flex gap-1.5 mb-3">
                      <div className="w-2 h-2 rounded-full bg-red-400/80"></div>
                      <div className="w-2 h-2 rounded-full bg-amber-400/80"></div>
                      <div className="w-2 h-2 rounded-full bg-green-400/80"></div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 w-1/3 bg-neutral-200 rounded-full"></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-16 bg-neutral-50 rounded border border-neutral-100"></div>
                        <div className="h-16 bg-neutral-50 rounded border border-neutral-100"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="inline-flex gap-2 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-medium font-geist-mono mb-4 border border-blue-100">
                  <Paintbrush className="w-3 h-3" /> Design
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">UX/UI Design</h3>
                <p className="text-neutral-500 text-sm leading-relaxed font-geist-mono">
                  Creating intuitive interfaces that offer a frictionless experience. We combine creativity with usability.
                </p>
              </div>

              {/* Web Development */}
              <div className="group bg-white border border-neutral-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300">
                <div className="h-48 mb-6 bg-neutral-900 rounded-xl overflow-hidden relative border border-neutral-800 flex flex-col">
                  <div className="flex items-center px-3 py-2 border-b border-neutral-800 bg-neutral-900/50">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="p-3 font-geist-mono text-[10px] text-neutral-400 leading-relaxed">
                    <span className="text-purple-400">const</span> <span className="text-blue-400">App</span> = () =&gt; &#123;<br />
                    &nbsp;&nbsp;<span className="text-purple-400">return</span> (<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&lt;<span className="text-red-400">div</span> <span className="text-amber-400">className</span>=<span className="text-green-400">"hero"</span>&gt;<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&lt;<span className="text-red-400">h1</span>&gt;Hello&lt;/<span className="text-red-400">h1</span>&gt;<br />
                    &nbsp;&nbsp;&nbsp;&nbsp;&lt;/<span className="text-red-400">div</span>&gt;<br />
                    &nbsp;&nbsp;)<br />
                    &#125;
                  </div>
                </div>
                <div className="inline-flex gap-2 bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-xs font-medium font-geist-mono mb-4 border border-purple-100">
                  <Code2 className="w-3 h-3" /> Development
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">Web Development</h3>
                <p className="text-neutral-500 text-sm leading-relaxed font-geist-mono">
                  Beautiful, performant websites tailored to your brand. Seamless user experiences that engage visitors.
                </p>
              </div>

              {/* Branding */}
              <div className="group bg-white border border-neutral-200 rounded-2xl p-6 hover:shadow-xl transition-all duration-300">
                <div className="h-48 mb-6 bg-neutral-100 rounded-xl overflow-hidden relative border border-neutral-100 flex items-center justify-center p-4">
                  <div className="grid grid-cols-3 gap-3 w-full max-w-[200px]">
                    <div className="aspect-square rounded-full bg-neutral-900 shadow-lg"></div>
                    <div className="aspect-square rounded-full bg-neutral-400 shadow-lg"></div>
                    <div className="aspect-square rounded-full bg-neutral-200 shadow-lg"></div>
                    <div className="col-span-3 h-2 rounded-full bg-gradient-to-r from-neutral-900 via-neutral-500 to-neutral-200 mt-2"></div>
                  </div>
                </div>
                <div className="inline-flex gap-2 bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-medium font-geist-mono mb-4 border border-emerald-100">
                  <Layout className="w-3 h-3" /> Branding
                </div>
                <h3 className="text-xl font-semibold text-neutral-900 mb-3">Brand Identity</h3>
                <p className="text-neutral-500 text-sm leading-relaxed font-geist-mono">
                  Cohesive brand systems with crafted color palettes, typography, and visual elements that resonate.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4 - Selected Work Section */}
        <section id="work" className="px-6 sm:px-8 bg-white border-t border-neutral-200">
          <div className="mx-auto max-w-6xl py-24">
            <div className="mb-16">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-geist-mono">
                  Selected Work
                </span>
                <div className="h-px flex-1 bg-neutral-200"></div>
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900 mb-4">Projetos</h2>
              <p className="text-lg text-neutral-500 max-w-2xl font-geist-mono">
                A collection of my latest design and development work.
              </p>
            </div>

            <div className="space-y-12">
              {/* Project 1 */}
              <div className="group grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="order-2 lg:order-1">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs text-neutral-500 font-geist-mono font-medium">2024</span>
                    <div className="h-1 w-1 rounded-full bg-neutral-300"></div>
                    <span className="text-xs text-neutral-500 font-geist-mono font-medium">Fintech</span>
                  </div>
                  <h3 className="text-2xl font-bold text-neutral-900 mb-4">SaaS Dashboard</h3>
                  <p className="text-neutral-600 mb-6 leading-relaxed font-geist-mono">
                    A comprehensive dashboard design for a fintech startup, featuring real-time analytics, user
                    management, and financial insights.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-8">
                    <span className="px-3 py-1 text-xs bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-full font-geist-mono">
                      React
                    </span>
                    <span className="px-3 py-1 text-xs bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-full font-geist-mono">
                      TypeScript
                    </span>
                    <span className="px-3 py-1 text-xs bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-full font-geist-mono">
                      D3.js
                    </span>
                  </div>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-blue-600 transition-colors border-b border-transparent hover:border-blue-600 pb-0.5"
                  >
                    Ver projeto <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="order-1 lg:order-2">
                  <div className="rounded-xl overflow-hidden border border-neutral-200 shadow-xl bg-neutral-50 group-hover:-translate-y-2 transition-transform duration-500">
                    <img
                      src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop"
                      alt="Project"
                      className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 grayscale hover:grayscale-0 transition-all duration-700"
                    />
                  </div>
                </div>
              </div>

              {/* Project 2 */}
              <div className="group grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div className="order-2">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs text-neutral-500 font-geist-mono font-medium">2024</span>
                    <div className="h-1 w-1 rounded-full bg-neutral-300"></div>
                    <span className="text-xs text-neutral-500 font-geist-mono font-medium">E-commerce</span>
                  </div>
                  <h3 className="text-2xl font-bold text-neutral-900 mb-4">Fashion Platform</h3>
                  <p className="text-neutral-600 mb-6 leading-relaxed font-geist-mono">
                    A modern e-commerce platform for a luxury fashion brand, featuring advanced filtering and AR try-on
                    capabilities.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-8">
                    <span className="px-3 py-1 text-xs bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-full font-geist-mono">
                      Next.js
                    </span>
                    <span className="px-3 py-1 text-xs bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-full font-geist-mono">
                      Shopify
                    </span>
                    <span className="px-3 py-1 text-xs bg-neutral-100 text-neutral-600 border border-neutral-200 rounded-full font-geist-mono">
                      Framer Motion
                    </span>
                  </div>
                  <a
                    href="#"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-blue-600 transition-colors border-b border-transparent hover:border-blue-600 pb-0.5"
                  >
                    Ver projeto <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="order-1">
                  <div className="rounded-xl overflow-hidden border border-neutral-200 shadow-xl bg-neutral-50 group-hover:-translate-y-2 transition-transform duration-500">
                    <img
                      src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=600&fit=crop"
                      alt="Project"
                      className="w-full h-auto object-cover opacity-90 group-hover:opacity-100 grayscale hover:grayscale-0 transition-all duration-700"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center mt-20">
              <a
                href="#"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white border border-neutral-200 rounded-full text-neutral-900 hover:bg-neutral-50 transition-all font-geist-mono text-sm shadow-sm hover:shadow-md"
              >
                Ver todos os projetos <Plus className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* SECTION 5 - Testimonial Section */}
        <section className="bg-neutral-50 border-t border-neutral-200 px-6 sm:px-8">
          <div className="max-w-4xl mx-auto py-24 text-center">
            <div className="mb-10">
              <Quote className="w-8 h-8 mx-auto text-neutral-300 mb-6" />
              <h3 className="text-3xl md:text-4xl font-medium text-neutral-900 leading-tight mb-8">
                "Jonathan é um dos melhores profissionais com quem tive a oportunidade de trabalhar, principalmente por
                sua capacidade de superar expectativas observando detalhes que poucos se atentam. Seu olhar do todo
                agrega resultados efetivos ao negócio. Além de ser um ser humano íntegro e que veste a camisa do time em
                que atua."
              </h3>
              <div className="flex items-center justify-center gap-4">
                <div className="w-12 h-12 rounded-full bg-neutral-200 overflow-hidden">
                  <img
                    src="https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/cf795bec-e9bc-4ecf-9989-d83620709311_320w.jpg"
                    alt="Client"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="text-left">
                  <div className="font-bold text-neutral-900 text-sm">Victor Gonçalves</div>
                  <div className="text-neutral-500 text-xs font-geist-mono">Chief Digital Officer @Verity</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer id="contact" className="bg-white border-t border-neutral-200 px-6 sm:px-8">
          <div className="mx-auto max-w-6xl py-12 md:py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 justify-between items-center">
              <div>
                <div className="font-bold text-lg tracking-tight mb-2">ux.jonny</div>
                <p className="text-neutral-500 text-sm font-geist-mono">© 2026 All rights reserved.</p>
              </div>
              <div className="flex flex-col md:flex-row gap-6 md:justify-end items-start md:items-center text-sm font-medium text-neutral-600">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-geist-mono">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Disponível para oportunidades
                </div>
                <nav className="flex gap-6">
                  <a href="https://www.instagram.com/ux.jonny/" target="_blank" rel="noreferrer" className="hover:text-black transition">
                    Instagram
                  </a>
                  <a
                    href="https://www.linkedin.com/in/jonathan-fernandes-a8208410a/"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-black transition"
                  >
                    Linkedin
                  </a>
                </nav>
              </div>
            </div>
          </div>
        </footer>
      </main>

      <DeepCheckModal isOpen={deepCheckOpen} onClose={() => setDeepCheckOpen(false)} />
    </div>
  );
}

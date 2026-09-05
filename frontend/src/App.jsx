import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Scan, ShieldAlert, Clock, RefreshCw,
  CheckCircle2, AlertTriangle, Database, GitBranch,
  ChevronRight, Loader, Wifi, Settings, Info,
  Star, BarChart2, Terminal
} from 'lucide-react';
import BlastRadiusGauge from './components/BlastRadiusGauge';
import PostureTree from './components/PostureTree';
import DriftFeed from './components/DriftFeed';
import TimelineDiff from './components/TimelineDiff';
import DeepCheckModal from './components/DeepCheckModal';

// ── util ──────────────────────────────────────────────────────────────────────
function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

function relTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ onScan, onDeepCheck, scanning, lastScan, scanProgress }) {
  return (
    <header
      className="flex items-center gap-4 px-6 py-3 border-b"
      style={{
        background: 'rgba(11,15,23,0.95)',
        backdropFilter: 'blur(20px)',
        borderColor: 'var(--border)',
        position: 'sticky', top: 0, zIndex: 40,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
             style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)' }}>
          <Shield size={16} style={{ color: '#00e5ff' }} />
        </div>
        <div>
          <div className="text-sm font-semibold mono" style={{ color: '#00e5ff', letterSpacing: '-0.02em' }}>
            PermissionDrift
          </div>
          <div className="text-[10px] mono" style={{ color: 'var(--muted)' }}>
            {lastScan ? `Last scan ${relTime(lastScan)}` : 'No scans yet'}
          </div>
        </div>
      </div>

      {/* Scan progress bar */}
      {scanning && (
        <div className="flex-1 mx-4 h-1 rounded-full overflow-hidden"
             style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${scanProgress}%`,
              background: 'linear-gradient(90deg, #00e5ff, #0099aa)',
              boxShadow: '0 0 8px rgba(0,229,255,0.5)',
            }}
          />
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {/* Status chip */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs mono"
          style={{
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.2)',
            color: '#10b981',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          API live
        </div>

        {/* Deep Check */}
        <button
          onClick={onDeepCheck}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium btn-amber transition-all"
        >
          <ShieldAlert size={13} />
          <span className="hidden sm:inline">Deep Check</span>
        </button>

        {/* Scan Now */}
        <button
          onClick={onScan}
          disabled={scanning}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium btn-primary disabled:opacity-60 transition-all"
        >
          {scanning
            ? <Loader size={13} className="animate-spin" />
            : <Scan size={13} />
          }
          {scanning ? 'Scanning…' : 'Scan Now'}
        </button>
      </div>
    </header>
  );
}

// ── SnapshotTimeline (right sidebar) ─────────────────────────────────────────
function SnapshotTimeline({ snapshots, currentId, onSelect, onBaseline }) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto pr-1" style={{ maxHeight: '60vh' }}>
      {snapshots.map((snap, i) => {
        const isSelected = snap.scan_id === currentId;
        return (
          <div
            key={snap.scan_id}
            onClick={() => onSelect(snap)}
            className="group flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all"
            style={{
              background: isSelected ? 'rgba(0,229,255,0.08)' : 'transparent',
              border: `1px solid ${isSelected ? 'rgba(0,229,255,0.2)' : 'transparent'}`,
            }}
          >
            {/* Timeline dot + line */}
            <div className="flex flex-col items-center flex-shrink-0" style={{ paddingTop: 2 }}>
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: snap.is_baseline ? '#f59e0b' : isSelected ? '#00e5ff' : '#1e2d45',
                  border: `1px solid ${snap.is_baseline ? '#f59e0b' : isSelected ? '#00e5ff' : '#2a3f5f'}`,
                  boxShadow: snap.is_baseline ? '0 0 6px rgba(245,158,11,0.4)' : isSelected ? '0 0 6px rgba(0,229,255,0.4)' : 'none',
                }}
              />
              {i < snapshots.length - 1 && (
                <div className="w-px flex-1 mt-1" style={{ background: 'var(--border)', minHeight: 16 }} />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs mono" style={{ color: isSelected ? '#00e5ff' : 'var(--text)' }}>
                  {fmt(snap.timestamp)}
                </span>
                {snap.is_baseline && (
                  <Star size={10} style={{ color: '#f59e0b' }} />
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[10px] mono"
                  style={{
                    color: snap.blast_radius_score >= 75 ? '#ef4444'
                         : snap.blast_radius_score >= 50 ? '#f97316'
                         : snap.blast_radius_score >= 25 ? '#eab308'
                         : '#10b981',
                  }}
                >
                  score {snap.blast_radius_score ?? '—'}
                </span>
                {snap.partial_scan && (
                  <span className="text-[10px] mono text-slate-600">partial</span>
                )}
              </div>

              {/* Set baseline button (hover) */}
              {!snap.is_baseline && (
                <button
                  onClick={e => { e.stopPropagation(); onBaseline(snap.scan_id); }}
                  className="text-[10px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity mono"
                  style={{ color: '#f59e0b' }}
                >
                  Set as baseline
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label, count, accent = '#00e5ff' }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
           style={{ background: `${accent}14`, border: `1px solid ${accent}28` }}>
        <Icon size={12} style={{ color: accent }} />
      </div>
      <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
      {count !== undefined && (
        <span className="ml-auto text-xs mono px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
          {count}
        </span>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [snapshots, setSnapshots] = useState([]);
  const [currentSnap, setCurrentSnap] = useState(null);
  const [drift, setDrift] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [showDeepCheck, setShowDeepCheck] = useState(false);
  const [activeTab, setActiveTab] = useState('drift');
  const [error, setError] = useState('');
  const [scoreHistory, setScoreHistory] = useState([]);
  const pollRef = useRef(null);

  // Load data
  const loadSnapshots = useCallback(async () => {
    try {
      const res = await fetch('/api/snapshots');
      const data = await res.json();
      const list = data.snapshots || [];
      setSnapshots(list);
      if (list.length) {
        setScoreHistory(list.slice(-20).map(s => s.blast_radius_score ?? 0));
      }
    } catch {}
  }, []);

  const loadDrift = useCallback(async () => {
    try {
      const res = await fetch('/api/drift');
      if (res.ok) setDrift(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    loadSnapshots();
    loadDrift();
  }, [loadSnapshots, loadDrift]);

  // Auto-select latest snapshot for posture tree
  useEffect(() => {
    if (snapshots.length && !currentSnap) {
      const latest = snapshots.reduce((a, b) =>
        new Date(a.timestamp) > new Date(b.timestamp) ? a : b
      );
      fetchFullSnapshot(latest.scan_id);
    }
  }, [snapshots]);

  const fetchFullSnapshot = async (id) => {
    try {
      const res = await fetch(`/api/snapshots/${id}`);
      if (res.ok) setCurrentSnap(await res.json());
    } catch {}
  };

  // Scan
  const handleScan = async () => {
    setScanning(true);
    setScanProgress(5);
    setError('');
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start scan');
      const { job_id } = await res.json();
      setScanProgress(15);
      pollScan(job_id);
    } catch (e) {
      setError(e.message);
      setScanning(false);
    }
  };

  const pollScan = (jobId) => {
    let prog = 15;
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const job = await res.json();
        prog = Math.min(prog + 12, 90);
        setScanProgress(prog);

        if (job.status === 'done') {
          setScanProgress(100);
          setTimeout(() => {
            setScanning(false);
            setScanProgress(0);
            loadSnapshots();
            loadDrift();
            if (job.result?.scan_id) fetchFullSnapshot(job.result.scan_id);
          }, 600);
        } else if (job.status === 'error') {
          setError(job.error || 'Scan failed');
          setScanning(false);
        } else {
          pollRef.current = setTimeout(tick, 800);
        }
      } catch {
        setError('Lost contact with API');
        setScanning(false);
      }
    };
    pollRef.current = setTimeout(tick, 800);
  };

  useEffect(() => () => clearTimeout(pollRef.current), []);

  // Set baseline
  const handleBaseline = async (id) => {
    await fetch(`/api/baseline/${id}`, { method: 'POST' });
    await loadSnapshots();
    await loadDrift();
  };

  const lastScanTs = snapshots.length
    ? snapshots.reduce((a, b) => new Date(a.timestamp) > new Date(b.timestamp) ? a : b).timestamp
    : null;

  const driftScore = drift?.blast_radius_score ?? currentSnap?.blast_radius_score ?? 0;
  const driftEvents = drift?.events || [];

  const criticalCount = driftEvents.filter(e => e.severity === 'critical').length;
  const highCount     = driftEvents.filter(e => e.severity === 'high').length;

  const TABS = [
    { id: 'drift',    label: 'Drift Feed',    icon: AlertTriangle, count: driftEvents.length },
    { id: 'posture',  label: 'Posture Tree',  icon: Shield },
    { id: 'timeline', label: 'Timeline Diff', icon: GitBranch },
  ];

  return (
    <div className="min-h-screen grid-bg" style={{ background: 'var(--bg)' }}>
      <TopBar
        onScan={handleScan}
        onDeepCheck={() => setShowDeepCheck(true)}
        scanning={scanning}
        lastScan={lastScanTs}
        scanProgress={scanProgress}
      />

      {/* Error banner */}
      {error && (
        <div
          className="mx-6 mt-4 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm animate-slide-in"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
        >
          <AlertTriangle size={14} />
          {error}
          <button onClick={() => setError('')} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Main layout */}
      <div className="flex gap-0 h-[calc(100vh-57px)]">

        {/* ── Left sidebar: Blast Radius + Snapshot timeline ── */}
        <aside
          className="w-64 flex-shrink-0 border-r flex flex-col overflow-hidden"
          style={{ borderColor: 'var(--border)' }}
        >
          {/* Blast Radius Gauge */}
          <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 size={13} style={{ color: '#00e5ff' }} />
              <span className="text-xs font-semibold mono" style={{ color: 'var(--text)' }}>Blast Radius</span>
              {!drift?.baseline_id && (
                <span className="ml-auto text-[10px] mono text-slate-600">no baseline</span>
              )}
            </div>
            <BlastRadiusGauge score={driftScore} history={scoreHistory} />

            {/* Quick stats */}
            {(criticalCount > 0 || highCount > 0) && (
              <div className="grid grid-cols-2 gap-2 mt-4">
                {criticalCount > 0 && (
                  <div className="p-2 rounded-lg text-center"
                       style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <div className="text-lg font-bold mono" style={{ color: '#ef4444' }}>{criticalCount}</div>
                    <div className="text-[10px] mono text-slate-600">CRITICAL</div>
                  </div>
                )}
                {highCount > 0 && (
                  <div className="p-2 rounded-lg text-center"
                       style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <div className="text-lg font-bold mono" style={{ color: '#f97316' }}>{highCount}</div>
                    <div className="text-[10px] mono text-slate-600">HIGH</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Snapshot list */}
          <div className="flex-1 overflow-hidden flex flex-col p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={12} style={{ color: 'var(--muted)' }} />
              <span className="text-xs font-medium mono" style={{ color: 'var(--muted)' }}>
                History ({snapshots.length})
              </span>
            </div>
            {snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center py-8">
                <Database size={24} style={{ color: 'var(--muted)', opacity: 0.3 }} />
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  No scans yet.<br />Click Scan Now to start.
                </p>
              </div>
            ) : (
              <SnapshotTimeline
                snapshots={[...snapshots].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))}
                currentId={currentSnap?.scan_id}
                onSelect={snap => fetchFullSnapshot(snap.scan_id)}
                onBaseline={handleBaseline}
              />
            )}
          </div>
        </aside>

        {/* ── Center: tabs + content ── */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-6 pt-5 pb-0 border-b" style={{ borderColor: 'var(--border)' }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all relative"
                  style={{
                    color: active ? '#00e5ff' : 'var(--muted)',
                    background: active ? 'rgba(0,229,255,0.06)' : 'transparent',
                    borderBottom: active ? '2px solid #00e5ff' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  <TabIcon size={13} />
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-0.5 text-[10px] mono opacity-70">{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 p-6">
            {activeTab === 'drift' && (
              <div>
                {!drift?.baseline_id && (
                  <div
                    className="flex items-center gap-3 p-4 rounded-xl mb-6 text-sm"
                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
                  >
                    <Info size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    <span style={{ color: '#94a3b8' }}>
                      No baseline set. Scan at least once, then hover a snapshot in the left sidebar and click
                      <strong style={{ color: '#f59e0b' }}> "Set as baseline"</strong> to start drift detection.
                    </span>
                  </div>
                )}
                <DriftFeed events={driftEvents} loading={scanning && !driftEvents.length} />
              </div>
            )}

            {activeTab === 'posture' && (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <SectionHeader icon={Shield} label="Security Posture" />
                  {currentSnap && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1" style={{ color: 'var(--muted)' }}>
                      <span className="mono">{currentSnap.host}</span>
                      <span>·</span>
                      <span>{fmt(currentSnap.timestamp)}</span>
                      <span>·</span>
                      <span>{currentSnap.scan_duration_ms}ms</span>
                      {currentSnap.partial_scan && (
                        <>
                          <span>·</span>
                          <span className="text-amber-500">partial scan</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <PostureTree snapshot={currentSnap} />

                {/* Browser extensions */}
                {currentSnap?.browser_extensions?.length > 0 && (
                  <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
                    <SectionHeader icon={Terminal} label="Browser Extensions" count={currentSnap.browser_extensions.length} accent="#8b5cf6" />
                    <div className="grid sm:grid-cols-2 gap-2">
                      {currentSnap.browser_extensions.map((ext, i) => (
                        <div key={i} className="p-3 rounded-xl transition-colors hover:bg-white/[0.02]"
                             style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)' }}>
                          <div className="flex items-center gap-2 mb-1">
                            {ext.has_all_urls && (
                              <span className="w-1.5 h-1.5 rounded-full dot-amber flex-shrink-0" />
                            )}
                            <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                              {ext.name}
                            </span>
                            <span className="ml-auto text-[10px] mono" style={{ color: 'var(--muted)' }}>
                              {ext.browser}
                            </span>
                          </div>
                          {ext.has_all_urls && (
                            <div className="text-[10px] mono"
                                 style={{ color: '#f97316' }}>has all-URLs access</div>
                          )}
                          {ext.permissions?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {ext.permissions.slice(0, 4).map(p => (
                                <span key={p} className="text-[10px] mono px-1.5 py-0.5 rounded"
                                      style={{ background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.15)' }}>
                                  {p}
                                </span>
                              ))}
                              {ext.permissions.length > 4 && (
                                <span className="text-[10px] mono text-slate-600">+{ext.permissions.length - 4}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <TimelineDiff snapshots={snapshots} />
            )}
          </div>
        </main>

        {/* ── Right sidebar: snapshot meta ── */}
        {currentSnap && (
          <aside
            className="w-56 flex-shrink-0 border-l p-4 hidden xl:block overflow-y-auto"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Database size={12} style={{ color: 'var(--muted)' }} />
              <span className="text-xs font-semibold mono" style={{ color: 'var(--muted)' }}>Snapshot</span>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { label: 'Host',    value: currentSnap.host },
                { label: 'Scan ID', value: currentSnap.scan_id?.slice(0, 8) + '…' },
                { label: 'Time',    value: fmt(currentSnap.timestamp) },
                { label: 'Duration', value: `${currentSnap.scan_duration_ms}ms` },
                { label: 'Score',   value: currentSnap.blast_radius_score ?? '—' },
                { label: 'Paths',   value: currentSnap.sensitive_paths?.length ?? '—' },
                { label: 'Procs',   value: currentSnap.process_tree?.length ?? '—' },
                { label: 'Extensions', value: currentSnap.browser_extensions?.length ?? '—' },
                { label: 'CLI tools', value: currentSnap.cli_tools?.length ?? '—' },
                { label: 'Ports',   value: currentSnap.listening_ports?.length ?? '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[10px] uppercase tracking-wider mono mb-0.5" style={{ color: 'var(--muted)' }}>
                    {label}
                  </div>
                  <div className="text-xs mono truncate" style={{ color: 'var(--text)' }} title={String(value)}>
                    {value}
                  </div>
                </div>
              ))}

              {currentSnap.is_baseline && (
                <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-lg"
                     style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <Star size={11} style={{ color: '#f59e0b' }} />
                  <span className="text-xs mono" style={{ color: '#f59e0b' }}>Baseline</span>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Deep Check Modal */}
      {showDeepCheck && <DeepCheckModal onClose={() => setShowDeepCheck(false)} />}
    </div>
  );
}

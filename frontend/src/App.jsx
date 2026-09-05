import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, RefreshCw, Radio, Terminal, 
  GitCompare, Key, Layers, Clock, AlertTriangle, CheckCircle, Database
} from 'lucide-react';

import BlastRadiusGauge from './components/BlastRadiusGauge';
import PostureTree from './components/PostureTree';
import DriftFeed from './components/DriftFeed';
import TimelineDiff from './components/TimelineDiff';
import DeepCheckModal from './components/DeepCheckModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('posture'); // 'posture' | 'drift' | 'timeline' | 'history'
  const [currentSnapshot, setCurrentSnapshot] = useState(null);
  const [snapshotsHistory, setSnapshotsHistory] = useState([]);
  const [driftData, setDriftData] = useState(null);
  const [activeBaselineId, setActiveBaselineId] = useState(null);

  // Scanning & Polling States
  const [isScanning, setIsScanning] = useState(false);
  const [scanJob, setScanJob] = useState(null);
  const [scanProgressMsg, setScanProgressMsg] = useState('');

  // Deep Check Modal State
  const [isDeepCheckOpen, setIsDeepCheckOpen] = useState(false);

  // Load initial data
  useEffect(() => {
    fetchSnapshots();
    fetchLatestDrift();
  }, []);

  const fetchSnapshots = async () => {
    try {
      const res = await fetch('/api/snapshots');
      if (!res.ok) return;
      const data = await res.json();
      const list = data.snapshots || [];
      setSnapshotsHistory(list);

      const base = list.find(s => s.is_baseline);
      if (base) setActiveBaselineId(base.scan_id);

      if (list.length > 0) {
        // Load full latest snapshot
        fetchSnapshotDetail(list[0].scan_id);
      }
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    }
  };

  const fetchSnapshotDetail = async (scanId) => {
    try {
      const res = await fetch(`/api/snapshots/${scanId}`);
      if (!res.ok) return;
      const data = await res.json();
      setCurrentSnapshot(data);
    } catch (err) {
      console.error('Failed to load snapshot detail:', err);
    }
  };

  const fetchLatestDrift = async () => {
    try {
      const res = await fetch('/api/drift');
      if (!res.ok) {
        setDriftData(null);
        return;
      }
      const data = await res.json();
      setDriftData(data);
    } catch (err) {
      setDriftData(null);
    }
  };

  const triggerScan = async (asBaseline = false) => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgressMsg('Initiating background scan job...');

    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_baseline: asBaseline })
      });

      if (!res.ok) throw new Error('Failed to trigger scan');
      const data = await res.json();
      const jobId = data.job_id;
      setScanJob({ id: jobId, status: 'pending' });

      // Poll job status asynchronously
      pollJob(jobId);
    } catch (err) {
      console.error(err);
      setIsScanning(false);
      setScanProgressMsg('');
    }
  };

  const pollJob = (jobId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        if (!res.ok) return;
        const job = await res.json();
        setScanJob(job);

        if (job.status === 'running') {
          setScanProgressMsg('Deep inspecting watchlist handles & passive sockets...');
        } else if (job.status === 'done') {
          clearInterval(interval);
          setIsScanning(false);
          setScanProgressMsg('Scan complete!');
          setTimeout(() => setScanProgressMsg(''), 3000);

          // Refresh snapshots and drift
          fetchSnapshots();
          fetchLatestDrift();
        } else if (job.status === 'failed') {
          clearInterval(interval);
          setIsScanning(false);
          setScanProgressMsg(`Scan failed: ${job.error}`);
        }
      } catch (err) {
        clearInterval(interval);
        setIsScanning(false);
      }
    }, 800);
  };

  const handleSetBaseline = async (scanId) => {
    try {
      const res = await fetch(`/api/baseline/${scanId}`, { method: 'POST' });
      if (res.ok) {
        setActiveBaselineId(scanId);
        fetchSnapshots();
        fetchLatestDrift();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const blastScore = driftData?.blast_radius_score ?? currentSnapshot?.blast_radius_score ?? 0;
  const driftEvents = driftData?.events || [];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 font-sans pb-16">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/20">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">PermissionDrift</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 uppercase tracking-wider">
                  Windows Local-First
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Zero file contents read • Strict metadata only</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Deep Check Button (Distinct Amber Accent) */}
            <button
              onClick={() => setIsDeepCheckOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-xs flex items-center gap-2 transition-all shadow-sm shadow-amber-500/10"
              title="Manual active localhost port probe"
            >
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Deep Check (Active 127.0.0.1)</span>
            </button>

            {/* Scan Now Button */}
            <button
              onClick={() => triggerScan(false)}
              disabled={isScanning}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Now'}</span>
            </button>
          </div>
        </div>

        {/* Scan Progress Bar Indicator */}
        {isScanning && (
          <div className="w-full bg-slate-950 h-1 relative overflow-hidden">
            <div className="absolute top-0 bottom-0 bg-gradient-to-r from-cyan-500 to-blue-500 w-1/3 animate-[shimmer_1.5s_infinite]" />
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Status Alert / Scanning feedback */}
        {scanProgressMsg && (
          <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-300 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>{scanProgressMsg}</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Wall-clock ceiling: 10s</span>
          </div>
        )}

        {/* Top Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Blast Radius Score Gauge */}
          <BlastRadiusGauge score={blastScore} history={snapshotsHistory} />

          {/* 2. Machine Summary Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Host Environment</span>
              <h3 className="text-base font-bold text-white mt-1 flex items-center gap-2 font-mono">
                {currentSnapshot?.host || 'DESKTOP-IG7DVUM'}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Last scan: {currentSnapshot?.timestamp?.slice(0, 19).replace('T', ' ') || 'Pending'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400">Baseline Status</div>
                <div className="text-xs font-bold text-emerald-400 font-mono mt-0.5">
                  {activeBaselineId ? `Set (${activeBaselineId.slice(0, 8)})` : 'None'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="text-[11px] text-slate-400">Scan Duration</div>
                <div className="text-xs font-bold text-cyan-300 font-mono mt-0.5">
                  {currentSnapshot?.scan_duration_ms ? `${currentSnapshot.scan_duration_ms}ms` : '0ms'}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Background Schedule:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                Every 30 mins (Task Scheduler)
              </span>
            </div>
          </div>

          {/* 3. High-Level Exposure Highlights */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Attack Surface Flags</span>
              <h3 className="text-base font-bold text-white mt-1">
                Active Detection Vectors
              </h3>
            </div>

            <div className="space-y-2 mt-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  Sensitive Path Handles:
                </span>
                <span className="font-mono font-bold text-white">
                  {currentSnapshot?.process_handles?.length || 0}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  Docker Daemon Accessors:
                </span>
                <span className="font-mono font-bold text-white">
                  {currentSnapshot?.docker_socket_accessible_by?.length || 0}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Broad &lt;all_urls&gt; Extensions:
                </span>
                <span className="font-mono font-bold text-amber-400">
                  {currentSnapshot?.browser_extensions?.filter(e => e.has_all_urls).length || 0}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  Listening Localhost Ports:
                </span>
                <span className="font-mono font-bold text-white">
                  {currentSnapshot?.listening_ports?.length || 0}
                </span>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-500 font-mono text-right">
              Audited in permissiondrift.log
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-800 flex items-center gap-4">
          <button
            onClick={() => setActiveTab('posture')}
            className={`pb-3 px-1 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'posture'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Current Posture Tree</span>
          </button>

          <button
            onClick={() => setActiveTab('drift')}
            className={`pb-3 px-1 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'drift'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Drift Feed</span>
            {driftEvents.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-red-500/20 text-red-400 border border-red-500/30">
                {driftEvents.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('timeline')}
            className={`pb-3 px-1 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'timeline'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCompare className="w-4 h-4" />
            <span>Timeline Diff ("Monday vs Friday")</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-1 text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'history'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Snapshot History</span>
            <span className="text-xs text-slate-500 font-mono">({snapshotsHistory.length})</span>
          </button>
        </div>

        {/* Tab Views */}
        <div>
          {activeTab === 'posture' && (
            <PostureTree snapshot={currentSnapshot} />
          )}

          {activeTab === 'drift' && (
            <DriftFeed events={driftEvents} />
          )}

          {activeTab === 'timeline' && (
            <TimelineDiff 
              snapshots={snapshotsHistory} 
              onSetBaseline={handleSetBaseline} 
            />
          )}

          {activeTab === 'history' && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white">Snapshot Store (SQLite)</h4>
                  <p className="text-xs text-slate-400">Append-only log with 30-day auto-pruning. Baselines preserved forever.</p>
                </div>
                <button
                  onClick={() => triggerScan(true)}
                  className="px-3 py-1 text-xs rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20 font-semibold transition-colors"
                >
                  Capture New Baseline Now
                </button>
              </div>

              <div className="divide-y divide-slate-800/80">
                {snapshotsHistory.map(snap => (
                  <div key={snap.scan_id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${snap.is_baseline ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-200">{snap.scan_id}</span>
                          {snap.is_baseline && (
                            <span className="px-2 py-0.2 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold uppercase">
                              Active Baseline
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {snap.timestamp}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-cyan-300">
                          Score: {snap.blast_radius_score}
                        </div>
                      </div>
                      {!snap.is_baseline && (
                        <button
                          onClick={() => handleSetBaseline(snap.scan_id)}
                          className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        >
                          Set Baseline
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Deep Check Modal */}
      <DeepCheckModal
        isOpen={isDeepCheckOpen}
        onClose={() => setIsDeepCheckOpen(false)}
        candidatePorts={currentSnapshot?.listening_ports?.map(p => p.port) || []}
      />
    </div>
  );
}

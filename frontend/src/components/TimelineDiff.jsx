import React, { useState, useEffect } from 'react';
import { GitCompare, Calendar, ArrowRight, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import DriftFeed from './DriftFeed';

export default function TimelineDiff({ snapshots = [], onSetBaseline }) {
  const [baseId, setBaseId] = useState('');
  const [currId, setCurrId] = useState('');
  const [diffResult, setDiffResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (snapshots.length >= 2) {
      // Default to oldest (or baseline) vs newest
      const baselineSnap = snapshots.find(s => s.is_baseline) || snapshots[snapshots.length - 1];
      setBaseId(baselineSnap.scan_id);
      setCurrId(snapshots[0].scan_id);
    } else if (snapshots.length === 1) {
      setBaseId(snapshots[0].scan_id);
      setCurrId(snapshots[0].scan_id);
    }
  }, [snapshots]);

  useEffect(() => {
    if (baseId && currId) {
      fetchDiff(baseId, currId);
    }
  }, [baseId, currId]);

  const fetchDiff = async (id1, id2) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/drift/${id1}/${id2}`);
      if (!res.ok) throw new Error('Failed to fetch diff');
      const data = await res.json();
      setDiffResult(data);
    } catch (err) {
      console.error(err);
      setDiffResult(null);
    } finally {
      setLoading(false);
    }
  };

  if (snapshots.length < 2) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
        <GitCompare className="w-8 h-8 mx-auto mb-2 text-cyan-400" />
        <h4 className="text-sm font-semibold text-white">Timeline Diff Requires At Least Two Scans</h4>
        <p className="text-xs text-slate-500 mt-1">
          Perform another scan using the "Scan Now" button above to compare machine state over time.
        </p>
      </div>
    );
  }

  const baseSnap = snapshots.find(s => s.scan_id === baseId);
  const currSnap = snapshots.find(s => s.scan_id === currId);

  const baseScore = baseSnap?.blast_radius_score ?? 0;
  const currScore = diffResult?.blast_radius_score ?? currSnap?.blast_radius_score ?? 0;
  const delta = currScore - baseScore;

  return (
    <div className="space-y-4">
      {/* Pickers Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Baseline / State A */}
        <div className="flex-1 w-full space-y-1">
          <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            Baseline Snapshot (State A):
          </label>
          <select
            value={baseId}
            onChange={(e) => setBaseId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl p-2.5 font-mono focus:border-cyan-500 focus:outline-none"
          >
            {snapshots.map(s => (
              <option key={s.scan_id} value={s.scan_id}>
                {s.scan_id.slice(0, 8)} — {s.timestamp.slice(0, 16).replace('T', ' ')} (Score: {s.blast_radius_score}) {s.is_baseline ? '[BASELINE]' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="p-2 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          <ArrowRight className="w-4 h-4" />
        </div>

        {/* Current / State B */}
        <div className="flex-1 w-full space-y-1">
          <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Comparison Snapshot (State B):
          </label>
          <select
            value={currId}
            onChange={(e) => setCurrId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-xl p-2.5 font-mono focus:border-cyan-500 focus:outline-none"
          >
            {snapshots.map(s => (
              <option key={s.scan_id} value={s.scan_id}>
                {s.scan_id.slice(0, 8)} — {s.timestamp.slice(0, 16).replace('T', ' ')} (Score: {s.blast_radius_score}) {s.is_baseline ? '[BASELINE]' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Delta Score Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <GitCompare className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Blast Radius Shift</div>
            <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
              <span>State A: {baseScore}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
              <span>State B: {currScore}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                delta > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : (
                  delta < 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'
                )
              }`}>
                {delta > 0 ? `+${delta}` : delta}
              </span>
            </div>
          </div>
        </div>

        {onSetBaseline && (
          <button
            onClick={() => onSetBaseline(currId)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 border border-slate-700 font-semibold transition-colors"
          >
            Set State B as Active Baseline
          </button>
        )}
      </div>

      {/* Diff Findings Feed */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Diffing snapshots...
        </div>
      ) : (
        <DriftFeed events={diffResult?.events || []} />
      )}
    </div>
  );
}

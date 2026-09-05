import React, { useState } from 'react';
import { GitCompare, Clock, ChevronRight, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';

function fmt(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

function ScoreDelta({ from, to }) {
  const delta = to - from;
  if (delta === 0) return <span className="text-slate-500 mono text-xs">±0</span>;
  return (
    <span className="flex items-center gap-1 mono text-xs"
          style={{ color: delta > 0 ? '#ef4444' : '#10b981' }}>
      {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {delta > 0 ? '+' : ''}{delta}
    </span>
  );
}

function EventDiff({ events }) {
  if (!events?.length) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center">
        <CheckCircle2 size={16} style={{ color: '#10b981' }} />
        <span className="text-sm" style={{ color: '#10b981' }}>No differences found</span>
      </div>
    );
  }

  const gained = events.filter(e => e.change_type === 'gained_access');
  const widened = events.filter(e => e.change_type === 'permission_widened');
  const lost = events.filter(e => e.change_type === 'lost_access');

  const Section = ({ label, items, color, dotColor }) => items.length > 0 ? (
    <div className="mb-3">
      <div className="text-[10px] font-bold mono tracking-wider mb-2 uppercase" style={{ color }}>
        {label} ({items.length})
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((e, i) => (
          <div key={i} className="flex items-center gap-2 p-2 rounded-lg"
               style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-xs mono flex-1" style={{ color: '#94a3b8' }}>{e.resource}</span>
            <span className="text-xs" style={{ color: '#475569' }}>{e.accessor}</span>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div>
      <Section label="Gained access" items={gained} color="#ef4444" />
      <Section label="Widened perms" items={widened} color="#f97316" />
      <Section label="Lost access" items={lost} color="#10b981" />
    </div>
  );
}

export default function TimelineDiff({ snapshots, onCompare }) {
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCompare = async () => {
    if (!fromId || !toId || fromId === toId) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`/api/drift/${fromId}/${toId}`);
      if (!res.ok) throw new Error('Failed to compare snapshots');
      const data = await res.json();
      setResult(data);
      onCompare?.(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const snapshotsSorted = [...(snapshots || [])].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  const fromSnap = snapshotsSorted.find(s => s.scan_id === fromId);
  const toSnap = snapshotsSorted.find(s => s.scan_id === toId);

  const SelectBox = ({ value, onChange, exclude, placeholder }) => (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full text-xs mono px-3 py-2 rounded-lg outline-none transition-colors"
      style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid var(--border)',
        color: value ? 'var(--text)' : 'var(--muted)',
      }}
    >
      <option value="">{placeholder}</option>
      {snapshotsSorted
        .filter(s => s.scan_id !== exclude)
        .map(s => (
          <option key={s.scan_id} value={s.scan_id}>
            {fmt(s.timestamp)} {s.is_baseline ? '★' : ''} (score: {s.blast_radius_score ?? '?'})
          </option>
        ))
      }
    </select>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Selector */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <GitCompare size={14} style={{ color: 'var(--cyan)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>Compare Snapshots</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="text-[10px] text-slate-600 mono mb-1 uppercase">From</div>
            <SelectBox value={fromId} onChange={setFromId} exclude={toId} placeholder="Select baseline..." />
          </div>

          <ChevronRight size={14} style={{ color: 'var(--muted)', marginTop: 16 }} />

          <div className="flex-1">
            <div className="text-[10px] text-slate-600 mono mb-1 uppercase">To</div>
            <SelectBox value={toId} onChange={setToId} exclude={fromId} placeholder="Select target..." />
          </div>
        </div>

        {fromId && toId && fromSnap && toSnap && (
          <div className="flex items-center justify-between mt-3 px-1">
            <ScoreDelta from={fromSnap.blast_radius_score ?? 0} to={toSnap.blast_radius_score ?? 0} />
            <button
              onClick={handleCompare}
              disabled={loading}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg transition-all disabled:opacity-50 btn-primary"
            >
              <GitCompare size={12} />
              {loading ? 'Comparing…' : 'Compare'}
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="glass rounded-xl p-3 text-xs"
             style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="glass rounded-xl p-4 animate-slide-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>
              Diff Results
            </span>
            <span className="text-xs mono" style={{ color: 'var(--muted)' }}>
              {result.events?.length ?? 0} change{result.events?.length !== 1 ? 's' : ''}
            </span>
          </div>
          <EventDiff events={result.events} />
        </div>
      )}
    </div>
  );
}

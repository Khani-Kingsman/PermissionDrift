import React, { useState } from 'react';
import {
  Shield, ChevronDown, ChevronUp, Copy, Check, Wrench,
  AlertCircle, AlertTriangle, Info, Clock, ArrowRightLeft
} from 'lucide-react';
import type { DriftEvent, Severity } from '../types/drift';

interface DriftFeedProps {
  events: DriftEvent[];
  loading?: boolean;
}

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-red-950/80 text-red-300 border-red-700/60 shadow-[0_0_8px_rgba(239,68,68,0.2)]',
  high:     'bg-amber-950/80 text-amber-300 border-amber-700/60',
  medium:   'bg-yellow-950/80 text-yellow-300 border-yellow-800/60',
  low:      'bg-slate-800 text-slate-300 border-slate-700',
};

const SEVERITY_ICON: Record<Severity, React.FC<{ className?: string }>> = {
  critical: ({ className }) => <AlertCircle className={className} />,
  high:     ({ className }) => <AlertTriangle className={className} />,
  medium:   ({ className }) => <AlertTriangle className={className} />,
  low:      ({ className }) => <Info className={className} />,
};

const CATEGORY_LABEL: Record<string, string> = {
  credential_access:   'CREDENTIAL ACCESS',
  extension_permission:'EXTENSION',
  cli_tool:            'CLI TOOL',
  process_handle:      'PROCESS HANDLE',
  ai_agent:            'AI AGENT',
  workspace_isolation: 'WORKSPACE ISOLATION',
  ipc_exposure:        'IPC EXPOSURE',
};

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function DriftCard({ event, defaultOpen }: { event: DriftEvent; defaultOpen: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const SevIcon = SEVERITY_ICON[event.severity];

  const handleCopy = () => {
    navigator.clipboard.writeText(event.remediation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`rounded-lg border transition-all duration-200 overflow-hidden ${
        expanded
          ? 'border-cyan-500/40 bg-[#090b10] shadow-[0_0_20px_rgba(6,182,212,0.05)]'
          : 'border-slate-800/80 bg-[#090b10]/60 hover:border-slate-700/80'
      }`}
    >
      {/* Header */}
      <div
        className="p-3.5 flex items-start gap-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Sev icon */}
        <SevIcon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
          event.severity === 'critical' ? 'text-red-400' :
          event.severity === 'high'     ? 'text-amber-400' :
          event.severity === 'medium'   ? 'text-yellow-400' : 'text-slate-400'
        }`} />

        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded border font-bold ${SEVERITY_BADGE[event.severity]}`}>
              {event.severity}
            </span>
            <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
              {CATEGORY_LABEL[event.category] ?? event.category}
            </span>
            {event.is_heuristic && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border bg-purple-950/40 text-purple-400 border-purple-800/40">
                HEURISTIC
              </span>
            )}
          </div>

          {/* Actor summary line */}
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-mono text-xs font-semibold text-slate-200 truncate max-w-[200px]" title={event.accessor}>
              {event.accessor}
            </span>
            <span className="text-slate-600 font-mono text-xs">
              {event.change_type === 'gained_access' ? 'gained handle to' :
               event.change_type === 'permission_widened' ? 'widened access on' : 'lost access to'}
            </span>
            <span className="font-mono text-xs text-cyan-300 font-bold bg-cyan-950/30 px-1.5 py-0.5 rounded border border-cyan-900/50 truncate max-w-[220px]" title={event.resource}>
              {event.resource}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500">
            <Clock className="w-3 h-3" />
            {fmt(event.detected_at)}
          </div>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-slate-500" />
          }
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 space-y-3">
          {/* Impact statement */}
          <div>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mb-1.5">
              Security Impact Analysis
            </span>
            <p className="text-slate-300 bg-slate-900/60 p-3 rounded border border-slate-800 leading-relaxed text-xs font-sans">
              {event.impact_statement}
            </p>
          </div>

          {/* State diff grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-2.5 rounded bg-slate-900/50 border border-slate-800/60">
              <span className="font-mono text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Baseline State</span>
              <span className="font-mono text-xs text-slate-400">{event.previous_state}</span>
            </div>
            <div className="p-2.5 rounded bg-red-950/20 border border-red-900/40">
              <span className="font-mono text-[10px] text-slate-500 block mb-1 uppercase tracking-wider">Observed State</span>
              <span className="font-mono text-xs text-red-300 font-semibold">{event.current_state}</span>
            </div>
          </div>

          {/* Remediation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[11px] text-emerald-400 font-semibold flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5" />
                Remediation Recipe
              </span>
              <button
                onClick={handleCopy}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1 font-mono text-[11px] transition-colors"
              >
                {copied
                  ? <><Check className="w-3 h-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
                  : <><Copy className="w-3 h-3" /><span>Copy</span></>
                }
              </button>
            </div>
            <div className="bg-[#05070a] border border-emerald-950 p-3 rounded-md text-emerald-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
              {event.remediation}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type FilterTab = 'all' | Severity;

export const DriftFeed: React.FC<DriftFeedProps> = ({ events, loading }) => {
  const [filter, setFilter] = useState<FilterTab>('all');

  const sorted = [...events].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  const filtered = filter === 'all' ? sorted : sorted.filter(e => e.severity === filter);
  const counts = events.reduce((acc, e) => ({ ...acc, [e.severity]: (acc[e.severity as string] || 0) + 1 }), {} as Record<string, number>);

  if (loading) {
    return (
      <div className="rounded-xl border border-cyan-950/80 bg-[#0d1017]/90 p-5">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-slate-900/50 border border-slate-800/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-cyan-950/80 bg-[#0d1017]/90 p-5 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
        <div>
          <h3
            className="text-base font-bold text-slate-100 flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <Shield className="w-4 h-4 text-cyan-400" />
            Detected Drift Events
          </h3>
          <p className="font-mono text-xs text-slate-400 mt-0.5">
            Differential findings sorted by severity — expand for fix recipes.
          </p>
        </div>
        <span className="font-mono text-xs text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2.5 py-1 rounded-md">
          {events.length} {events.length === 1 ? 'anomaly' : 'anomalies'}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(['all', 'critical', 'high', 'medium', 'low'] as FilterTab[]).map(sev => {
          const active = filter === sev;
          const count = sev === 'all' ? events.length : (counts[sev] || 0);
          return (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`font-mono text-[11px] px-2.5 py-1 rounded-md border transition-all ${
                active
                  ? sev === 'all' ? 'bg-slate-700 border-slate-600 text-slate-200'
                  : sev === 'critical' ? 'bg-red-950/80 border-red-700/60 text-red-300'
                  : sev === 'high' ? 'bg-amber-950/80 border-amber-700/60 text-amber-300'
                  : sev === 'medium' ? 'bg-yellow-950/80 border-yellow-800/60 text-yellow-300'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              {sev.toUpperCase()} {count > 0 && <span className="opacity-60">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-950/30 border border-emerald-800/40">
            <Shield className="w-7 h-7 text-emerald-400" />
          </div>
          <p className="font-mono text-sm text-emerald-400 font-semibold">No drift detected</p>
          <p className="font-mono text-xs text-slate-500">Posture matches baseline. Set a baseline to begin tracking.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((event, i) => (
            <DriftCard key={event.event_id} event={event} defaultOpen={i === 0 && filter === 'all'} />
          ))}
          {filtered.length === 0 && (
            <p className="text-center py-8 font-mono text-xs text-slate-500">
              No {filter} severity events
            </p>
          )}
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import {
  ChevronDown, ChevronRight, AlertTriangle, AlertCircle,
  Info, Minus, Wrench, GitBranch, Shield, Zap
} from 'lucide-react';

const SEV_CONFIG = {
  critical: {
    badge: 'badge-critical',
    icon: AlertCircle,
    iconColor: '#ef4444',
    label: 'CRITICAL',
    borderLeft: 'border-l-[#ef4444]',
    bg: 'hover:bg-red-500/[0.04]',
  },
  high: {
    badge: 'badge-high',
    icon: AlertTriangle,
    iconColor: '#f97316',
    label: 'HIGH',
    borderLeft: 'border-l-[#f97316]',
    bg: 'hover:bg-orange-500/[0.04]',
  },
  medium: {
    badge: 'badge-medium',
    icon: AlertTriangle,
    iconColor: '#eab308',
    label: 'MEDIUM',
    borderLeft: 'border-l-[#eab308]',
    bg: 'hover:bg-yellow-500/[0.04]',
  },
  low: {
    badge: 'badge-low',
    icon: Info,
    iconColor: '#94a3b8',
    label: 'LOW',
    borderLeft: 'border-l-slate-500',
    bg: 'hover:bg-slate-500/[0.03]',
  },
};

const CATEGORY_LABELS = {
  credential_access: 'Credential Access',
  extension_permission: 'Extension',
  cli_tool: 'CLI Tool',
  process_handle: 'Process Handle',
  ai_agent: 'AI Agent',
  workspace_isolation: 'Workspace',
  ipc_exposure: 'IPC Exposure',
};

function DriftCard({ event, index }) {
  const [expanded, setExpanded] = useState(false);
  const sev = SEV_CONFIG[event.severity] || SEV_CONFIG.low;
  const SevIcon = sev.icon;

  return (
    <div
      className={`glass rounded-xl border-l-2 transition-all duration-200 animate-slide-in ${sev.borderLeft} ${sev.bg}`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header row */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Severity icon */}
        <SevIcon size={16} style={{ color: sev.iconColor, marginTop: 2, flexShrink: 0 }} />

        <div className="flex-1 min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mono tracking-wider ${sev.badge}`}>
              {sev.label}
            </span>
            {CATEGORY_LABELS[event.category] && (
              <span className="text-[10px] px-1.5 py-0.5 rounded text-slate-500 border border-slate-700 mono">
                {CATEGORY_LABELS[event.category]}
              </span>
            )}
            {event.is_heuristic && (
              <span className="text-[10px] px-1.5 py-0.5 rounded mono"
                    style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
                HEURISTIC
              </span>
            )}
          </div>

          {/* Impact statement */}
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
            {event.impact_statement}
          </p>

          {/* Resource + accessor */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {event.resource && (
              <span className="text-xs mono" style={{ color: 'var(--muted)' }}>
                <span style={{ color: 'var(--border-bright)' }}>resource</span> {event.resource}
              </span>
            )}
            {event.accessor && (
              <span className="text-xs mono" style={{ color: 'var(--muted)' }}>
                <span style={{ color: 'var(--border-bright)' }}>by</span> {event.accessor}
              </span>
            )}
          </div>
        </div>

        {/* Expand button */}
        <button
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all flex-shrink-0"
          style={{
            background: 'rgba(0,229,255,0.06)',
            color: '#00e5ff',
            border: '1px solid rgba(0,229,255,0.15)',
          }}
        >
          <Wrench size={11} />
          Fix
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
      </div>

      {/* Expanded remediation */}
      {expanded && (
        <div
          className="mx-4 mb-4 p-3 rounded-lg animate-slide-in"
          style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.1)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Shield size={12} style={{ color: '#00e5ff' }} />
            <span className="text-xs font-semibold" style={{ color: '#00e5ff' }}>Remediation</span>
          </div>
          <p className="text-sm" style={{ color: '#94a3b8' }}>{event.remediation}</p>

          {/* State diff */}
          {event.previous_state && event.current_state && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="p-2 rounded" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <div className="text-[10px] text-red-500 mono mb-1">BEFORE</div>
                <div className="text-xs mono text-slate-400">{event.previous_state}</div>
              </div>
              <div className="p-2 rounded" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <div className="text-[10px] text-emerald-500 mono mb-1">AFTER</div>
                <div className="text-xs mono text-slate-400">{event.current_state}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

export default function DriftFeed({ events = [], loading }) {
  const [filter, setFilter] = useState('all');

  const sorted = [...events].sort((a, b) =>
    (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)
  );

  const filtered = filter === 'all' ? sorted : sorted.filter(e => e.severity === filter);

  const counts = events.reduce((acc, e) => {
    acc[e.severity] = (acc[e.severity] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass rounded-xl p-4 h-20 animate-pulse"
               style={{ background: 'linear-gradient(90deg, #111827 25%, #141d2e 50%, #111827 75%)', backgroundSize: '200% 100%' }} />
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center"
             style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <Shield size={28} style={{ color: '#10b981' }} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: '#10b981' }}>No drift detected</p>
          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Your posture matches the baseline</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {['all', 'critical', 'high', 'medium', 'low'].map(sev => {
          const count = sev === 'all' ? events.length : (counts[sev] || 0);
          const cfg = SEV_CONFIG[sev];
          return (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg transition-all mono ${
                filter === sev ? (cfg ? cfg.badge : 'bg-white/10 text-white') : ''
              }`}
              style={filter !== sev ? { color: 'var(--muted)', border: '1px solid var(--border)' } : {}}
            >
              {sev.toUpperCase()}
              {count > 0 && <span className="opacity-75">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Event cards */}
      <div className="flex flex-col gap-3">
        {filtered.map((event, i) => (
          <DriftCard key={event.event_id || i} event={event} index={i} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: 'var(--muted)' }}>
            No {filter} severity events
          </p>
        )}
      </div>
    </div>
  );
}

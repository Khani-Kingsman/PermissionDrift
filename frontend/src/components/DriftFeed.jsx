import React, { useState } from 'react';
import { 
  AlertTriangle, ShieldAlert, ArrowRight, CheckCircle,
  Wrench, Copy, Check, ChevronDown, ChevronUp, Sparkles, HelpCircle
} from 'lucide-react';

const SEVERITY_CONFIG = {
  critical: {
    badge: 'bg-red-500/10 text-red-400 border-red-500/30',
    border: 'border-red-500/40 bg-red-950/10',
    dot: 'bg-red-500',
    icon: ShieldAlert
  },
  high: {
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    border: 'border-orange-500/40 bg-orange-950/10',
    dot: 'bg-orange-500',
    icon: AlertTriangle
  },
  medium: {
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    border: 'border-amber-500/30 bg-amber-950/10',
    dot: 'bg-amber-500',
    icon: AlertTriangle
  },
  low: {
    badge: 'bg-slate-800 text-slate-400 border-slate-700',
    border: 'border-slate-800 bg-slate-900/40',
    dot: 'bg-slate-400',
    icon: CheckCircle
  }
};

export default function DriftFeed({ events = [] }) {
  const [expandedEvents, setExpandedEvents] = useState({});
  const [copiedIndex, setCopiedIndex] = useState(null);

  const toggleExpand = (idx) => {
    setExpandedEvents(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const copyRecipe = (recipe, idx) => {
    navigator.clipboard.writeText(recipe);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!events || events.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3">
        <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-white">Zero Permission Drift Detected</h3>
        <p className="text-xs text-slate-400 max-w-md">
          Current machine access, handles, and extensions strictly match the baseline snapshot.
          Any newly gained access will immediately show up in this feed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Showing {events.length} detected drift event{events.length > 1 ? 's' : ''}</span>
        <span className="font-mono text-[11px] text-slate-500">Sorted reverse-chronologically</span>
      </div>

      {events.map((ev, idx) => {
        const sev = (ev.severity || 'low').toLowerCase();
        const conf = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.low;
        const IconComponent = conf.icon;
        const isExpanded = !!expandedEvents[idx];

        return (
          <div 
            key={ev.event_id || idx}
            className={`border rounded-xl p-4.5 transition-all duration-200 ${conf.border}`}
          >
            {/* Top Bar: Severity, Resource, Accessor */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 mt-0.5">
                  <IconComponent className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${conf.badge}`}>
                      {sev}
                    </span>
                    {ev.is_heuristic && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" />
                        HEURISTIC SIGNAL
                      </span>
                    )}
                    <span className="text-xs font-mono text-slate-400">
                      Category: {ev.category}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white mt-1.5 flex items-center gap-2">
                    <span>{ev.accessor}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-mono text-cyan-300">{ev.resource}</span>
                  </h4>
                </div>
              </div>

              <button
                onClick={() => toggleExpand(idx)}
                className="px-2.5 py-1 rounded-lg text-xs bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-700/60 flex items-center gap-1 transition-colors"
              >
                <span>{isExpanded ? 'Less' : 'Details'}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Impact Statement */}
            <div className="mt-3 text-xs text-slate-300 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 font-semibold mr-1">Impact:</span>
              {ev.impact_statement}
            </div>

            {/* Transition: Previous State -> Current State */}
            <div className="mt-2.5 flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/50 px-3 py-1.5 rounded-md border border-slate-800/40">
              <span className="text-slate-500">Prev:</span>
              <span className="text-slate-300">{ev.previous_state || 'None'}</span>
              <ArrowRight className="w-3 h-3 text-slate-600" />
              <span className="text-slate-500">Now:</span>
              <span className="text-emerald-400 font-semibold">{ev.current_state}</span>
            </div>

            {/* Expandable Remediation Panel ("Fix it") */}
            {isExpanded && ev.remediation && (
              <div className="mt-3 pt-3 border-t border-slate-800/80">
                <div className="p-3 rounded-lg bg-cyan-950/20 border border-cyan-500/20 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5" />
                      Fix It / Remediation Recipe:
                    </span>
                    <button
                      onClick={() => copyRecipe(ev.remediation, idx)}
                      className="text-[11px] text-cyan-400 hover:text-cyan-200 flex items-center gap-1"
                    >
                      {copiedIndex === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedIndex === idx ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="font-mono text-slate-200 bg-slate-950/70 p-2 rounded border border-slate-800">
                    {ev.remediation}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import React, { useState } from 'react';
import {
  Shield,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Wrench,
  AlertCircle,
  AlertTriangle,
  Info,
  Clock,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { DriftEvent, Severity } from '../types/drift';
import { apiAnalyzeEvent } from '../lib/api';

interface DriftFeedProps {
  events: DriftEvent[];
  loading?: boolean;
}

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-700 border-amber-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const SEVERITY_ICON: Record<Severity, React.FC<{ className?: string }>> = {
  critical: ({ className }) => <AlertCircle className={className} />,
  high: ({ className }) => <AlertTriangle className={className} />,
  medium: ({ className }) => <AlertTriangle className={className} />,
  low: ({ className }) => <Info className={className} />,
};

const CATEGORY_LABEL: Record<string, string> = {
  credential_access: 'CREDENTIAL ACCESS',
  extension_permission: 'EXTENSION PERMISSION',
  cli_tool: 'CLI TOOL',
  process_handle: 'PROCESS HANDLE',
  ai_agent: 'AI AGENT EXPOSURE',
  workspace_isolation: 'WORKSPACE LEAK',
  ipc_exposure: 'IPC EXPOSURE',
};

const SEV_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function DriftCard({ event, defaultOpen }: { event: DriftEvent; defaultOpen: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const SevIcon = SEVERITY_ICON[event.severity];

  const handleCopy = () => {
    navigator.clipboard.writeText(event.remediation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunAI = async () => {
    setAiLoading(true);
    try {
      const res = await apiAnalyzeEvent(event);
      setAiResult(res);
    } catch (e: any) {
      setAiResult({
        ai_powered: false,
        error: e.message,
        forensic_summary: "Error communicating with Gemini AI service.",
        threat_vector: "Verify if GEMINI_API_KEY is configured in your environment.",
        recommended_actions: ["Set GEMINI_API_KEY environment variable."]
      });
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden ${
        expanded
          ? 'border-neutral-300 bg-white shadow-sm'
          : 'border-neutral-200/90 bg-white/70 hover:border-neutral-300'
      }`}
    >
      <div
        className="p-4 flex items-start gap-3 cursor-pointer select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <SevIcon
          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
            event.severity === 'critical'
              ? 'text-red-600'
              : event.severity === 'high'
              ? 'text-amber-600'
              : event.severity === 'medium'
              ? 'text-yellow-600'
              : 'text-neutral-500'
          }`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`text-[10px] uppercase font-geist-mono px-2 py-0.5 rounded-full border font-bold ${SEVERITY_BADGE[event.severity]}`}
            >
              {event.severity}
            </span>
            <span className="text-[10px] font-geist-mono text-neutral-400 uppercase tracking-wider">
              {CATEGORY_LABEL[event.category] ?? event.category}
            </span>
            {event.is_heuristic && (
              <span className="text-[10px] font-geist-mono px-1.5 py-0.5 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                HEURISTIC
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className="font-geist-mono text-xs font-semibold text-neutral-900 truncate max-w-[240px]" title={event.accessor}>
              {event.accessor}
            </span>
            <span className="text-neutral-400 font-geist-mono text-xs">
              {event.change_type === 'gained_access'
                ? 'gained handle to'
                : event.change_type === 'permission_widened'
                ? 'widened access on'
                : 'lost access to'}
            </span>
            <span
              className="font-geist-mono text-xs text-neutral-900 font-bold bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 truncate max-w-[280px]"
              title={event.resource}
            >
              {event.resource}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <div className="flex items-center gap-1 font-geist-mono text-[10px] text-neutral-400">
            <Clock className="w-3 h-3" />
            {fmt(event.detected_at)}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-neutral-100 space-y-4 bg-neutral-50/40">
          <div>
            <span className="text-[10px] font-geist-mono text-neutral-400 uppercase tracking-widest block mb-1.5 font-semibold">
              Security Impact Statement
            </span>
            <p className="text-neutral-700 bg-white p-3.5 rounded-xl border border-neutral-200 leading-relaxed text-xs">
              {event.impact_statement}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-geist-mono text-xs">
            <div className="p-3 rounded-xl bg-white border border-neutral-200">
              <span className="text-[10px] text-neutral-400 block mb-1 uppercase tracking-wider">Baseline State</span>
              <span className="text-neutral-600">{event.previous_state}</span>
            </div>
            <div className="p-3 rounded-xl bg-red-50/50 border border-red-200">
              <span className="text-[10px] text-red-500 block mb-1 uppercase tracking-wider">Observed Handle State</span>
              <span className="text-red-800 font-semibold">{event.current_state}</span>
            </div>
          </div>

          {/* Standard Rule Remediation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-geist-mono text-[11px] text-neutral-900 font-semibold flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-neutral-700" />
                Remediation Recipe
              </span>
              <button
                onClick={handleCopy}
                className="text-neutral-500 hover:text-neutral-900 flex items-center gap-1 font-geist-mono text-[11px] transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-600 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy command</span>
                  </>
                )}
              </button>
            </div>
            <div className="bg-neutral-900 text-neutral-200 border border-neutral-800 p-3.5 rounded-xl font-geist-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-sm">
              {event.remediation}
            </div>
          </div>

          {/* AI Forensic Deep Dive (Powered by Gemini) */}
          <div className="pt-2 border-t border-neutral-200/60">
            <div className="flex items-center justify-between mb-2">
              <span className="font-geist-mono text-[11px] font-bold text-neutral-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Gemini AI Deep Threat Analysis
              </span>
              <button
                onClick={handleRunAI}
                disabled={aiLoading}
                className="px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-geist-mono text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Analyzing anomaly…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{aiResult ? 'Re-Analyze with Gemini' : 'Run AI Threat Modeling'}</span>
                  </>
                )}
              </button>
            </div>

            {aiResult && (
              <div className="mt-3 p-4 rounded-xl border border-neutral-200 bg-white space-y-3 font-geist-mono text-xs">
                {aiResult.ai_powered && aiResult.analysis_markdown ? (
                  <div className="whitespace-pre-line text-neutral-800 leading-relaxed font-sans text-xs">
                    {aiResult.analysis_markdown}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200">
                      <strong className="text-neutral-900 block mb-1">Forensic Analysis:</strong>
                      <p className="text-neutral-600 font-sans text-xs">{aiResult.forensic_summary}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-200">
                      <strong className="text-amber-900 block mb-1">Threat Vector:</strong>
                      <p className="text-amber-800 font-sans text-xs">{aiResult.threat_vector}</p>
                    </div>
                    {aiResult.recommended_actions && (
                      <div className="p-2.5 rounded-lg bg-neutral-50 border border-neutral-200">
                        <strong className="text-neutral-900 block mb-1">Recommended Actions:</strong>
                        <ul className="list-disc pl-4 space-y-1 text-neutral-600 font-sans text-xs">
                          {aiResult.recommended_actions.map((act: string, idx: number) => (
                            <li key={idx}>{act}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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
  const filtered = filter === 'all' ? sorted : sorted.filter((e) => e.severity === filter);
  const counts = events.reduce(
    (acc, e) => ({ ...acc, [e.severity]: (acc[e.severity as string] || 0) + 1 }),
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-neutral-200/80 bg-white/75 backdrop-blur-md p-6">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white/75 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 pb-3 border-b border-neutral-100 gap-2">
        <div>
          <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2 tracking-tight">
            <Shield className="w-4 h-4 text-black" />
            Detected Drift Events
          </h3>
          <p className="font-geist-mono text-xs text-neutral-500 mt-0.5">
            Real-time differential findings sorted by threat severity.
          </p>
        </div>
        <span className="font-geist-mono text-xs text-neutral-700 bg-neutral-100 border border-neutral-200 px-3 py-1 rounded-full font-medium">
          {events.length} {events.length === 1 ? 'anomaly' : 'anomalies'} detected
        </span>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {(['all', 'critical', 'high', 'medium', 'low'] as FilterTab[]).map((sev) => {
          const active = filter === sev;
          const count = sev === 'all' ? events.length : counts[sev] || 0;
          return (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`font-geist-mono text-[11px] px-3 py-1 rounded-full border transition-all cursor-pointer ${
                active
                  ? 'bg-neutral-900 border-neutral-900 text-white font-medium'
                  : 'border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              {sev.toUpperCase()} {count > 0 && <span className="opacity-70 ml-1">({count})</span>}
            </button>
          );
        })}
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-emerald-50 border border-emerald-200">
            <Shield className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="font-geist-mono text-sm text-emerald-700 font-semibold">Zero Posture Drift</p>
          <p className="font-geist-mono text-xs text-neutral-400">
            All running handles strictly match your established baseline.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((event, i) => (
            <DriftCard key={event.event_id} event={event} defaultOpen={i === 0 && filter === 'all'} />
          ))}
          {filtered.length === 0 && (
            <p className="text-center py-10 font-geist-mono text-xs text-neutral-400">
              No {filter} severity events found.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

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
  Terminal,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { DriftEvent, Severity } from '../types/drift';
import { apiAnalyzeEvent } from '../lib/api';

interface DriftFeedProps {
  events: DriftEvent[];
  loading?: boolean;
  theme?: 'black' | 'white';
}

function MarkdownReportView({ markdown, isBlack = false }: { markdown: string; isBlack?: boolean }) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Parse sections starting with #, ##, or ###
  const sections = markdown.split(/^#{1,3}\s+/m).filter(Boolean);

  if (sections.length <= 1) {
    return (
      <div className={`whitespace-pre-wrap leading-relaxed font-sans text-xs p-4 rounded-xl border ${
        isBlack
          ? 'bg-[#121620] text-neutral-200 border-neutral-800'
          : 'bg-white text-neutral-800 border-neutral-200'
      }`}>
        {markdown}
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans text-xs">
      {sections.map((sec, idx) => {
        const firstLineEnd = sec.indexOf('\n');
        const title = firstLineEnd !== -1 ? sec.slice(0, firstLineEnd).trim() : sec.trim();
        const body = firstLineEnd !== -1 ? sec.slice(firstLineEnd).trim() : '';

        const isAbout = title.toLowerCase().includes('what this') || title.toLowerCase().includes('about');
        const isLocation = title.toLowerCase().includes('location') || title.toLowerCase().includes('execution');
        const isImpact = title.toLowerCase().includes('impact');
        const isHarden = title.toLowerCase().includes('reduce') || title.toLowerCase().includes('harden');
        const isFix = title.toLowerCase().includes('command') || title.toLowerCase().includes('fix');

        // Extract code blocks if any
        const codeBlockMatch = body.match(/```(?:powershell|cmd|bash)?\s*([\s\S]*?)```/);
        const codeText = codeBlockMatch ? codeBlockMatch[1].trim() : null;
        const plainText = codeBlockMatch ? body.replace(/```[\s\S]*?```/, '').trim() : body;

        return (
          <div
            key={idx}
            className={`p-4 rounded-xl border transition-all ${
              isImpact
                ? isBlack ? 'bg-red-950/30 border-red-800/60 text-red-200' : 'bg-red-50/40 border-red-200 text-red-950'
                : isHarden
                ? isBlack ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200' : 'bg-emerald-50/40 border-emerald-200 text-emerald-950'
                : isFix
                ? 'bg-black text-neutral-100 border-neutral-800'
                : isBlack ? 'bg-[#161a24]/80 border-neutral-800 text-neutral-200' : 'bg-neutral-50/70 border-neutral-200 text-neutral-900'
            }`}
          >
            <div className="flex items-center gap-2 mb-2 font-semibold text-xs font-geist-mono">
              {isImpact && <AlertTriangle className="w-4 h-4 text-red-500" />}
              {isHarden && <ShieldCheck className="w-4 h-4 text-emerald-500" />}
              {isFix && <Terminal className="w-4 h-4 text-amber-400" />}
              {isLocation && <Zap className="w-4 h-4 text-blue-400" />}
              {isAbout && <Info className={`w-4 h-4 ${isBlack ? 'text-neutral-400' : 'text-neutral-700'}`} />}
              <span>{title}</span>
            </div>

            {plainText && (
              <p className={`whitespace-pre-line leading-relaxed ${
                isFix ? 'text-neutral-300' : isBlack ? 'text-neutral-300' : 'text-neutral-700'
              }`}>
                {plainText}
              </p>
            )}

            {codeText && (
              <div className="mt-3 relative">
                <div className="flex items-center justify-between px-3 py-1.5 bg-black/70 border border-neutral-700/60 rounded-t-lg text-[11px] font-geist-mono text-neutral-400">
                  <span>PowerShell Remediation Code</span>
                  <button
                    onClick={() => handleCopy(codeText, `code-${idx}`)}
                    className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer text-[10px]"
                  >
                    {copiedCode === `code-${idx}` ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400 font-semibold">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-black text-emerald-300 p-3 rounded-b-lg font-geist-mono text-xs overflow-x-auto whitespace-pre-wrap border-x border-b border-neutral-700/60">
                  {codeText}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const getSeverityBadge = (sev: Severity, isBlack: boolean) => {
  if (isBlack) {
    switch (sev) {
      case 'critical': return 'bg-red-950/50 text-red-300 border-red-800/60';
      case 'high': return 'bg-amber-950/50 text-amber-300 border-amber-800/60';
      case 'medium': return 'bg-yellow-950/50 text-yellow-300 border-yellow-800/60';
      case 'low': return 'bg-neutral-800/80 text-neutral-300 border-neutral-700';
    }
  }
  switch (sev) {
    case 'critical': return 'bg-red-50 text-red-700 border-red-200';
    case 'high': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'medium': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'low': return 'bg-neutral-100 text-neutral-600 border-neutral-200';
  }
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

function DriftCard({
  event,
  defaultOpen = false,
  isBlack = false,
}: {
  event: DriftEvent;
  defaultOpen?: boolean;
  isBlack?: boolean;
}) {
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
          ? isBlack
            ? 'border-neutral-700 bg-[#161a24] shadow-md'
            : 'border-neutral-300 bg-white shadow-sm'
          : isBlack
          ? 'border-neutral-800/90 bg-[#121620]/80 hover:border-neutral-700'
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
              ? 'text-red-500'
              : event.severity === 'high'
              ? 'text-amber-500'
              : event.severity === 'medium'
              ? 'text-yellow-500'
              : isBlack ? 'text-neutral-400' : 'text-neutral-500'
          }`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`text-[10px] uppercase font-geist-mono px-2 py-0.5 rounded-full border font-bold ${getSeverityBadge(event.severity, isBlack)}`}
            >
              {event.severity}
            </span>
            <span className={`text-[10px] font-geist-mono uppercase tracking-wider ${isBlack ? 'text-neutral-400' : 'text-neutral-400'}`}>
              {CATEGORY_LABEL[event.category] ?? event.category}
            </span>
            {event.is_heuristic && (
              <span className={`text-[10px] font-geist-mono px-1.5 py-0.5 rounded-full border ${
                isBlack
                  ? 'bg-purple-950/40 text-purple-300 border-purple-800/60'
                  : 'bg-purple-50 text-purple-700 border-purple-200'
              }`}>
                HEURISTIC
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-1.5">
            <span className={`font-geist-mono text-xs font-semibold truncate max-w-[240px] ${
              isBlack ? 'text-white' : 'text-neutral-900'
            }`} title={event.accessor}>
              {event.accessor}
            </span>
            <span className={`font-geist-mono text-xs ${isBlack ? 'text-neutral-400' : 'text-neutral-400'}`}>
              {event.change_type === 'gained_access'
                ? 'gained handle to'
                : event.change_type === 'permission_widened'
                ? 'widened access on'
                : 'lost access to'}
            </span>
            <span
              className={`font-geist-mono text-xs font-bold px-2 py-0.5 rounded border truncate max-w-[280px] ${
                isBlack
                  ? 'bg-[#1a202c] text-neutral-100 border-neutral-700'
                  : 'bg-neutral-100 text-neutral-900 border-neutral-200'
              }`}
              title={event.resource}
            >
              {event.resource}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <div className={`flex items-center gap-1 font-geist-mono text-[10px] ${isBlack ? 'text-neutral-400' : 'text-neutral-400'}`}>
            <Clock className="w-3 h-3" />
            {fmt(event.detected_at)}
          </div>
          {expanded ? (
            <ChevronUp className={`w-4 h-4 ${isBlack ? 'text-neutral-400' : 'text-neutral-400'}`} />
          ) : (
            <ChevronDown className={`w-4 h-4 ${isBlack ? 'text-neutral-400' : 'text-neutral-400'}`} />
          )}
        </div>
      </div>

      {expanded && (
        <div className={`px-5 pb-5 pt-2 border-t space-y-4 ${
          isBlack ? 'border-neutral-800 bg-[#0e1219]/60' : 'border-neutral-100 bg-neutral-50/40'
        }`}>
          <div>
            <span className={`text-[10px] font-geist-mono uppercase tracking-widest block mb-1.5 font-semibold ${
              isBlack ? 'text-neutral-400' : 'text-neutral-400'
            }`}>
              Security Impact Statement
            </span>
            <p className={`p-3.5 rounded-xl border leading-relaxed text-xs ${
              isBlack ? 'bg-[#151922] text-neutral-200 border-neutral-800' : 'bg-white text-neutral-700 border-neutral-200'
            }`}>
              {event.impact_statement}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-geist-mono text-xs">
            <div className={`p-3 rounded-xl border ${
              isBlack ? 'bg-[#151922] text-neutral-300 border-neutral-800' : 'bg-white text-neutral-600 border-neutral-200'
            }`}>
              <span className={`text-[10px] block mb-1 uppercase tracking-wider ${isBlack ? 'text-neutral-400' : 'text-neutral-400'}`}>
                Baseline State
              </span>
              <span>{event.previous_state}</span>
            </div>
            <div className={`p-3 rounded-xl border ${
              isBlack ? 'bg-red-950/30 border-red-800/60 text-red-300' : 'bg-red-50/50 border-red-200 text-red-800'
            }`}>
              <span className="text-[10px] text-red-500 block mb-1 uppercase tracking-wider">Observed Handle State</span>
              <span className="font-semibold">{event.current_state}</span>
            </div>
          </div>

          {/* Standard Rule Remediation */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`font-geist-mono text-[11px] font-semibold flex items-center gap-1.5 ${
                isBlack ? 'text-neutral-200' : 'text-neutral-900'
              }`}>
                <Wrench className={`w-3.5 h-3.5 ${isBlack ? 'text-neutral-400' : 'text-neutral-700'}`} />
                Remediation Recipe
              </span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1 font-geist-mono text-[11px] transition-colors cursor-pointer ${
                  isBlack ? 'text-neutral-400 hover:text-white' : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy command</span>
                  </>
                )}
              </button>
            </div>
            <div className={`border p-3.5 rounded-xl font-geist-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-sm ${
              isBlack ? 'bg-black text-neutral-200 border-neutral-800' : 'bg-neutral-900 text-neutral-200 border-neutral-800'
            }`}>
              {event.remediation}
            </div>
          </div>

          {/* AI Forensic Deep Dive (Powered by Gemini) */}
          <div className={`pt-2 border-t ${isBlack ? 'border-neutral-800' : 'border-neutral-200/60'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`font-geist-mono text-[11px] font-bold flex items-center gap-1.5 ${
                isBlack ? 'text-white' : 'text-neutral-900'
              }`}>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Gemini AI Deep Threat Analysis
              </span>
              <button
                onClick={handleRunAI}
                disabled={aiLoading}
                className={`px-3 py-1 rounded-lg font-geist-mono text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50 ${
                  isBlack
                    ? 'bg-neutral-100 text-black hover:bg-white font-medium'
                    : 'bg-neutral-900 text-white hover:bg-neutral-800'
                }`}
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Analyzing anomaly…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>{aiResult ? 'Re-Analyze with Gemini' : 'Run AI Threat Modeling'}</span>
                  </>
                )}
              </button>
            </div>

            {aiResult && (
              <div className="mt-3">
                {aiResult.analysis_markdown ? (
                  <MarkdownReportView markdown={aiResult.analysis_markdown} isBlack={isBlack} />
                ) : (
                  <div className={`p-4 rounded-xl border space-y-3 font-geist-mono text-xs ${
                    isBlack ? 'bg-[#151922] border-neutral-800' : 'bg-white border-neutral-200'
                  }`}>
                    <div className={`p-3 rounded-lg border ${
                      isBlack ? 'bg-[#11141b] border-neutral-800 text-neutral-200' : 'bg-neutral-50 border-neutral-200 text-neutral-900'
                    }`}>
                      <strong className="block mb-1">Forensic Analysis:</strong>
                      <p className="font-sans text-xs opacity-90">{aiResult.forensic_summary}</p>
                    </div>
                    {aiResult.threat_vector && (
                      <div className={`p-3 rounded-lg border ${
                        isBlack ? 'bg-red-950/30 border-red-800/60 text-red-200' : 'bg-red-50/50 border-red-200 text-red-800'
                      }`}>
                        <strong className="block mb-1">Threat Vector:</strong>
                        <p className="font-sans text-xs opacity-90">{aiResult.threat_vector}</p>
                      </div>
                    )}
                    {aiResult.recommended_actions && (
                      <div className={`p-3 rounded-lg border ${
                        isBlack ? 'bg-[#11141b] border-neutral-800 text-neutral-200' : 'bg-neutral-50 border-neutral-200 text-neutral-900'
                      }`}>
                        <strong className="block mb-1">Recommended Actions:</strong>
                        <ul className="list-disc pl-4 space-y-1 font-sans text-xs opacity-90">
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

export const DriftFeed: React.FC<DriftFeedProps> = ({ events, loading, theme = 'white' }) => {
  const isBlack = theme === 'black';
  const [filter, setFilter] = useState<FilterTab>('all');

  const sorted = [...events].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  const filtered = filter === 'all' ? sorted : sorted.filter((e) => e.severity === filter);
  const counts = events.reduce(
    (acc, e) => ({ ...acc, [e.severity]: (acc[e.severity as string] || 0) + 1 }),
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className={`rounded-2xl border backdrop-blur-md p-6 ${
        isBlack
          ? 'border-neutral-800/80 bg-[#0f1219]/85 text-white shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
          : 'border-neutral-200/80 bg-white/75 text-neutral-900 shadow-sm'
      }`}>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className={`h-16 rounded-xl animate-pulse ${isBlack ? 'bg-neutral-800/60' : 'bg-neutral-100'}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border backdrop-blur-md p-6 transition-all ${
      isBlack
        ? 'border-neutral-800/80 bg-[#0f1219]/85 text-white shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
        : 'border-neutral-200/80 bg-white/75 text-neutral-900 shadow-sm hover:shadow-md'
    }`}>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between mb-5 pb-3 border-b gap-2 ${
        isBlack ? 'border-neutral-800/80' : 'border-neutral-100'
      }`}>
        <div>
          <h3 className={`text-base font-bold flex items-center gap-2 tracking-tight ${
            isBlack ? 'text-white' : 'text-neutral-900'
          }`}>
            <Shield className={`w-4 h-4 ${isBlack ? 'text-white' : 'text-black'}`} />
            Detected Drift Events
          </h3>
          <p className={`font-geist-mono text-xs mt-0.5 ${isBlack ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Real-time differential findings sorted by threat severity.
          </p>
        </div>
        <span className={`font-geist-mono text-xs px-3 py-1 rounded-full font-medium border ${
          isBlack
            ? 'text-neutral-300 bg-neutral-900 border-neutral-700'
            : 'text-neutral-700 bg-neutral-100 border-neutral-200'
        }`}>
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
                  ? isBlack
                    ? 'bg-white text-black border-white font-semibold'
                    : 'bg-neutral-900 border-neutral-900 text-white font-medium'
                  : isBlack
                  ? 'border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800/60'
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
          <div className={`w-14 h-14 rounded-full flex items-center justify-center border ${
            isBlack ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-emerald-50 border-emerald-200'
          }`}>
            <Shield className="w-6 h-6 text-emerald-500" />
          </div>
          <p className={`font-geist-mono text-sm font-semibold ${isBlack ? 'text-emerald-400' : 'text-emerald-700'}`}>
            Zero Posture Drift
          </p>
          <p className={`font-geist-mono text-xs ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`}>
            All running handles strictly match your established baseline.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((event, i) => (
            <DriftCard
              key={event.event_id}
              event={event}
              defaultOpen={i === 0 && filter === 'all'}
              isBlack={isBlack}
            />
          ))}
          {filtered.length === 0 && (
            <p className={`text-center py-10 font-geist-mono text-xs ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`}>
              No {filter} severity events found.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

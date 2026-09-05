import React, { useState } from 'react';
import { X, AlertTriangle, Play, Loader2, CheckCircle2, ShieldAlert, Info } from 'lucide-react';
import { apiDeepCheck } from '../lib/api';

interface DeepCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_PORTS = [
  { port: 2375,  label: 'Docker API (no auth)',  risk: 'critical' },
  { port: 2376,  label: 'Docker TLS',             risk: 'medium' },
  { port: 11434, label: 'Ollama (local AI)',       risk: 'high' },
  { port: 6443,  label: 'Kubernetes API',          risk: 'critical' },
  { port: 5432,  label: 'PostgreSQL',              risk: 'high' },
  { port: 6379,  label: 'Redis',                   risk: 'high' },
  { port: 27017, label: 'MongoDB',                 risk: 'high' },
  { port: 9090,  label: 'Prometheus',              risk: 'medium' },
  { port: 3000,  label: 'Dev server',              risk: 'low' },
  { port: 8080,  label: 'HTTP alt',                risk: 'low' },
] as const;

const RISK_STYLE: Record<string, string> = {
  critical: 'bg-red-950/30 border-red-800/50 text-red-300',
  high:     'bg-amber-950/30 border-amber-800/50 text-amber-300',
  medium:   'bg-yellow-950/30 border-yellow-800/50 text-yellow-300',
  low:      'bg-slate-900/50 border-slate-800 text-slate-400',
};

interface PortResult { open: boolean; banner?: string; error?: string; }

export const DeepCheckModal: React.FC<DeepCheckModalProps> = ({ isOpen, onClose }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set([2375, 11434]));
  const [customPort, setCustomPort] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<number, PortResult> | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const toggle = (port: number) =>
    setSelected(prev => { const n = new Set(prev); n.has(port) ? n.delete(port) : n.add(port); return n; });

  const addCustom = () => {
    const p = parseInt(customPort, 10);
    if (p >= 1 && p <= 65535) { setSelected(prev => new Set([...prev, p])); setCustomPort(''); }
  };

  const runProbe = async () => {
    if (!selected.size) return;
    setRunning(true);
    setResults(null);
    setError('');
    try {
      const data = await apiDeepCheck([...selected]);
      setResults(data.results ?? {});
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const openCount = results ? Object.values(results).filter((r): r is PortResult => !!(r as PortResult)?.open).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-amber-800/60 bg-[#090b10] shadow-[0_0_50px_rgba(245,158,11,0.15)] relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-slate-800/60">
          <div className="p-2 rounded-lg bg-amber-950/60 border border-amber-500/50 text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-lg font-bold text-slate-100"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Manual Port Deep Probe
            </h3>
            <span className="font-mono text-xs text-amber-400">
              Active unauthenticated access verification · 127.0.0.1 only
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Warning */}
          <div className="p-3 rounded-lg border border-amber-900/50 bg-amber-950/20 font-mono text-xs text-slate-400 flex gap-2 leading-relaxed">
            <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              PermissionDrift is passive by default. This probe issues a real TCP connect
              on <code className="text-cyan-400">127.0.0.1</code> with 1s timeout to confirm
              if selected ports accept unauthenticated connections. No data is sent or stored.
            </span>
          </div>

          {/* Port grid */}
          <div>
            <div className="font-mono text-[11px] text-slate-500 uppercase tracking-wider mb-2">Select ports to probe</div>
            <div className="grid grid-cols-2 gap-1.5">
              {COMMON_PORTS.map(({ port, label, risk }) => {
                const isSelected = selected.has(port);
                return (
                  <button
                    key={port}
                    onClick={() => toggle(port)}
                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                      isSelected ? RISK_STYLE[risk] : 'bg-slate-900/30 border-slate-800/50 text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    <span className="font-mono text-xs font-bold flex-shrink-0">:{port}</span>
                    <span className="text-[11px] truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom port */}
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                min={1} max={65535}
                placeholder="Custom port (1–65535)"
                value={customPort}
                onChange={e => setCustomPort(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
                className="flex-1 font-mono text-xs px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-200 placeholder-slate-600 outline-none focus:border-cyan-800"
              />
              <button
                onClick={addCustom}
                className="px-3 py-2 rounded-lg font-mono text-xs border border-amber-500/30 bg-amber-950/20 text-amber-400 hover:bg-amber-900/30 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Results */}
          {error && (
            <div className="p-3 rounded-lg border border-red-900/50 bg-red-950/20 font-mono text-xs text-red-400">
              {error}
            </div>
          )}

          {results && (
            <div>
              <div className="font-mono text-[11px] text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Probe Results</span>
                {openCount > 0 && (
                  <span className="text-amber-400 font-semibold">{openCount} port{openCount !== 1 ? 's' : ''} open</span>
                )}
              </div>
              <div className="space-y-1.5">
                {[...selected].sort((a, b) => a - b).map(port => {
                  const r = results[port] as PortResult | undefined;
                  if (!r) return (
                    <div key={port} className="flex items-center gap-2 p-2 rounded bg-slate-900/40 border border-slate-800">
                      <Loader2 className="w-3.5 h-3.5 text-slate-600 animate-spin" />
                      <span className="font-mono text-xs text-slate-500">:{port} — no result</span>
                    </div>
                  );
                  const portInfo = COMMON_PORTS.find(p => p.port === port);
                  return (
                    <div
                      key={port}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                        r.open
                          ? 'bg-amber-950/20 border-amber-800/50'
                          : 'bg-emerald-950/10 border-emerald-900/30'
                      }`}
                    >
                      {r.open
                        ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      }
                      <span className={`font-mono text-xs font-bold flex-shrink-0 ${r.open ? 'text-amber-300' : 'text-emerald-300'}`}>
                        :{port}
                      </span>
                      <span className="font-mono text-xs flex-1" style={{ color: r.open ? '#fcd34d' : '#6ee7b7' }}>
                        {r.open ? '● OPEN' : '○ CLOSED'}
                        {portInfo && ` — ${portInfo.label}`}
                      </span>
                      {r.banner && (
                        <span className="font-mono text-[10px] text-slate-500 truncate">{r.banner}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800/60 flex items-center justify-between">
          <span className="font-mono text-xs text-slate-500">{selected.size} port{selected.size !== 1 ? 's' : ''} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded font-mono text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={runProbe}
              disabled={running || !selected.size}
              className="px-5 py-1.5 rounded bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 hover:bg-amber-400 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {running
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Probing…</>
                : <><ShieldAlert className="w-3.5 h-3.5" />Execute Probe</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

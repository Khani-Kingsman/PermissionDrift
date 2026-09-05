import React, { useState } from 'react';
import { X, AlertTriangle, Play, Loader2, CheckCircle2, ShieldAlert, Info } from 'lucide-react';
import { apiDeepCheck } from '../lib/api';

interface DeepCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_PORTS = [
  { port: 2375, label: 'Docker API (unauth)', risk: 'critical' },
  { port: 2376, label: 'Docker TLS', risk: 'medium' },
  { port: 11434, label: 'Ollama (local AI)', risk: 'high' },
  { port: 6443, label: 'Kubernetes API', risk: 'critical' },
  { port: 5432, label: 'PostgreSQL', risk: 'high' },
  { port: 6379, label: 'Redis', risk: 'high' },
  { port: 27017, label: 'MongoDB', risk: 'high' },
  { port: 9090, label: 'Prometheus', risk: 'medium' },
  { port: 3000, label: 'Dev server', risk: 'low' },
  { port: 8080, label: 'HTTP alt', risk: 'low' },
] as const;

const RISK_STYLE: Record<string, string> = {
  critical: 'bg-red-50 border-red-200 text-red-800',
  high: 'bg-amber-50 border-amber-200 text-amber-800',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  low: 'bg-neutral-50 border-neutral-200 text-neutral-600',
};

interface PortResult {
  open: boolean;
  banner?: string;
  error?: string;
}

export const DeepCheckModal: React.FC<DeepCheckModalProps> = ({ isOpen, onClose }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set([2375, 11434]));
  const [customPort, setCustomPort] = useState('');
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<number, PortResult> | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const toggle = (port: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(port) ? n.delete(port) : n.add(port);
      return n;
    });

  const addCustom = () => {
    const p = parseInt(customPort, 10);
    if (p >= 1 && p <= 65535) {
      setSelected((prev) => new Set([...prev, p]));
      setCustomPort('');
    }
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

  const openCount = results
    ? Object.values(results).filter((r): r is PortResult => !!(r as PortResult)?.open).length
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-200 bg-white shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 p-6 border-b border-neutral-100">
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-neutral-900 tracking-tight">
              Manual Port Deep Probe
            </h3>
            <span className="font-geist-mono text-xs text-amber-600 font-medium">
              Active Unauthenticated Access Verification · 127.0.0.1 Only
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 transition-colors flex-shrink-0 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scroll area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 font-geist-mono text-xs text-amber-900 flex gap-2.5 leading-relaxed">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>
              PermissionDrift is strictly passive by default. This check issues a 1s TCP connection to loopback to verify if target services expose unauthenticated control interfaces. No credentials or data are captured.
            </span>
          </div>

          <div>
            <div className="font-geist-mono text-[11px] text-neutral-400 uppercase tracking-wider mb-2 font-medium">
              Select ports to probe
            </div>
            <div className="grid grid-cols-2 gap-2">
              {COMMON_PORTS.map(({ port, label, risk }) => {
                const isSelected = selected.has(port);
                return (
                  <button
                    key={port}
                    onClick={() => toggle(port)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? RISK_STYLE[risk] + ' font-medium shadow-sm'
                        : 'bg-neutral-50/70 border-neutral-200 text-neutral-500 hover:border-neutral-300'
                    }`}
                  >
                    <span className="font-geist-mono text-xs font-bold flex-shrink-0">:{port}</span>
                    <span className="text-[11px] truncate">{label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom port */}
            <div className="flex gap-2 mt-3">
              <input
                type="number"
                min={1}
                max={65535}
                placeholder="Custom port (1–65535)"
                value={customPort}
                onChange={(e) => setCustomPort(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustom()}
                className="flex-1 font-geist-mono text-xs px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-900 placeholder-neutral-400 outline-none focus:border-black transition-colors"
              />
              <button
                onClick={addCustom}
                className="px-4 py-2.5 rounded-xl font-geist-mono text-xs border border-neutral-300 hover:bg-neutral-100 transition-colors font-medium text-neutral-800"
              >
                Add
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 font-geist-mono text-xs text-red-700">
              {error}
            </div>
          )}

          {results && (
            <div>
              <div className="font-geist-mono text-[11px] text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between font-medium">
                <span>Probe Results</span>
                {openCount > 0 && (
                  <span className="text-amber-700 font-semibold">{openCount} port{openCount !== 1 ? 's' : ''} open</span>
                )}
              </div>
              <div className="space-y-2">
                {[...selected]
                  .sort((a, b) => a - b)
                  .map((port) => {
                    const r = results[port] as PortResult | undefined;
                    if (!r) {
                      return (
                        <div
                          key={port}
                          className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50 border border-neutral-200"
                        >
                          <Loader2 className="w-3.5 h-3.5 text-neutral-400 animate-spin" />
                          <span className="font-geist-mono text-xs text-neutral-500">:{port} — scanning</span>
                        </div>
                      );
                    }
                    const portInfo = COMMON_PORTS.find((p) => p.port === port);
                    return (
                      <div
                        key={port}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${
                          r.open
                            ? 'bg-amber-50 border-amber-200 text-amber-900'
                            : 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                        }`}
                      >
                        {r.open ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        )}
                        <span className="font-geist-mono text-xs font-bold flex-shrink-0">:{port}</span>
                        <span className="font-geist-mono text-xs flex-1">
                          {r.open ? '● OPEN (Unauthenticated)' : '○ CLOSED / Filtered'}
                          {portInfo && ` — ${portInfo.label}`}
                        </span>
                        {r.banner && (
                          <span className="font-geist-mono text-[10px] text-neutral-400 truncate">{r.banner}</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <span className="font-geist-mono text-xs text-neutral-500">
            {selected.size} port{selected.size !== 1 ? 's' : ''} target
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-geist-mono text-xs text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={runProbe}
              disabled={running || !selected.size}
              className="px-5 py-2 rounded-lg bg-neutral-900 text-white font-medium text-xs flex items-center gap-2 hover:bg-neutral-800 transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {running ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Probing…
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Execute Probe
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

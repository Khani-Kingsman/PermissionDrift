import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, AlertTriangle, Play, RefreshCw, Server } from 'lucide-react';

export default function DeepCheckModal({ isOpen, onClose, candidatePorts = [] }) {
  const [selectedPorts, setSelectedPorts] = useState([2375, 11434, 9200, 8080]);
  const [customPort, setCustomPort] = useState('');
  const [loading, setLoading] = useState(false);
  const [findings, setFindings] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const togglePort = (port) => {
    setSelectedPorts(prev => 
      prev.includes(port) ? prev.filter(p => p !== port) : [...prev, port]
    );
  };

  const addCustomPort = (e) => {
    e.preventDefault();
    const p = parseInt(customPort, 10);
    if (p > 0 && p <= 65535 && !selectedPorts.includes(p)) {
      setSelectedPorts(prev => [...prev, p]);
      setCustomPort('');
    }
  };

  const executeDeepCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/deep-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ports: selectedPorts })
      });
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setFindings(data.findings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Amber accent glow */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Manual Localhost Deep Check</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  OPT-IN ACTIVE CHECK
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Probes flagged ports to verify unauthenticated HTTP access.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Guarantee Box */}
        <div className="my-4 p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            Safety & Privacy Guarantee:
          </div>
          <p className="text-slate-400 text-[11px]">
            This probe strictly binds to <strong className="font-mono text-slate-200">127.0.0.1</strong>. It never initiates outbound internet connections.
            It performs a single non-invasive HTTP GET with a 1-second timeout. It is never invoked automatically or on background schedule.
          </p>
        </div>

        {/* Port Selection */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300">Select Localhost Ports to Probe:</label>
          <div className="flex flex-wrap gap-2">
            {[2375, 11434, 9200, 6379, 8080, 5000].map(p => {
              const isChecked = selectedPorts.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePort(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all ${
                    isChecked 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                      : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  Port {p}
                </button>
              );
            })}
          </div>

          <form onSubmit={addCustomPort} className="flex gap-2 mt-2">
            <input
              type="number"
              placeholder="Add custom port (e.g. 8000)"
              value={customPort}
              onChange={(e) => setCustomPort(e.target.value)}
              className="px-3 py-1 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-3 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700"
            >
              Add
            </button>
          </form>
        </div>

        {/* Action Button */}
        <div className="my-4">
          <button
            onClick={executeDeepCheck}
            disabled={loading || selectedPorts.length === 0}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Probing Localhost Ports...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Manual Deep Check on {selectedPorts.length} Port{selectedPorts.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>

        {/* Results Area */}
        {error && (
          <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-xs text-red-300">
            Error probing ports: {error}
          </div>
        )}

        {findings && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            <div className="text-xs font-semibold text-slate-300">Probe Findings:</div>
            {findings.map((f, idx) => (
              <div 
                key={idx}
                className={`p-3 rounded-xl border text-xs ${
                  f.is_unauthenticated 
                    ? 'bg-red-950/30 border-red-500/40 text-red-300' 
                    : 'bg-slate-950/50 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white flex items-center gap-2">
                    <Server className="w-3.5 h-3.5" />
                    127.0.0.1:{f.port} ({f.service})
                  </span>
                  {f.is_unauthenticated ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-300 border border-red-500/40 font-bold">
                      UNAUTHENTICATED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                      PROTECTED / CLOSED
                    </span>
                  )}
                </div>
                <p className="text-[11px] mt-1 text-slate-400">{f.message}</p>
                {f.raw_snippet && (
                  <div className="mt-1.5 p-1.5 bg-slate-950 font-mono text-[10px] text-slate-400 rounded border border-slate-800 truncate">
                    Snippet: {f.raw_snippet}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

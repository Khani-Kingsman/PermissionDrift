import React, { useState } from 'react';
import { X, Wifi, Loader, CheckCircle2, AlertTriangle, ShieldAlert, Info } from 'lucide-react';

const COMMON_PORTS = [
  { port: 2375, label: 'Docker (unauth)', risk: 'critical' },
  { port: 2376, label: 'Docker TLS', risk: 'medium' },
  { port: 11434, label: 'Ollama (local AI)', risk: 'high' },
  { port: 3000,  label: 'Dev server', risk: 'low' },
  { port: 8080,  label: 'HTTP alt', risk: 'low' },
  { port: 6443,  label: 'Kubernetes API', risk: 'critical' },
  { port: 9090,  label: 'Prometheus', risk: 'medium' },
  { port: 5432,  label: 'PostgreSQL', risk: 'high' },
  { port: 6379,  label: 'Redis', risk: 'high' },
  { port: 27017, label: 'MongoDB', risk: 'high' },
];

const RISK_COLORS = {
  critical: { bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   text: '#ef4444' },
  high:     { bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)',  text: '#f97316' },
  medium:   { bg: 'rgba(234,179,8,0.1)',   border: 'rgba(234,179,8,0.3)',   text: '#eab308' },
  low:      { bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)', text: '#94a3b8' },
};

function PortResult({ port, result }) {
  const portInfo = COMMON_PORTS.find(p => p.port === port);
  const risk = portInfo?.risk || 'low';
  const colors = RISK_COLORS[risk];

  if (!result) {
    return (
      <div className="flex items-center gap-3 p-2.5 rounded-lg" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <Loader size={14} className="animate-spin" style={{ color: 'var(--muted)' }} />
        <span className="mono text-xs" style={{ color: 'var(--muted)' }}>:{port}</span>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>Probing…</span>
      </div>
    );
  }

  const isOpen = result.open;

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-lg transition-colors"
      style={{
        background: isOpen ? colors.bg : 'rgba(16,185,129,0.05)',
        border: `1px solid ${isOpen ? colors.border : 'rgba(16,185,129,0.15)'}`,
      }}
    >
      {isOpen
        ? <AlertTriangle size={14} style={{ color: colors.text, flexShrink: 0 }} />
        : <CheckCircle2 size={14} style={{ color: '#10b981', flexShrink: 0 }} />
      }

      <span className="mono text-xs font-medium" style={{ color: isOpen ? colors.text : '#10b981', flexShrink: 0, width: 48 }}>
        :{port}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {portInfo?.label && (
            <span className="text-xs" style={{ color: isOpen ? colors.text : 'var(--muted)' }}>
              {portInfo.label}
            </span>
          )}
          <span className="text-xs" style={{ color: isOpen ? colors.text : '#10b981' }}>
            {isOpen ? '● OPEN' : '○ CLOSED'}
          </span>
        </div>
        {isOpen && result.banner && (
          <div className="text-[10px] mono mt-0.5 truncate" style={{ color: '#475569' }}>
            {result.banner}
          </div>
        )}
      </div>

      {isOpen && risk !== 'low' && (
        <span className="text-[10px] mono px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}>
          {risk.toUpperCase()}
        </span>
      )}
    </div>
  );
}

export default function DeepCheckModal({ onClose }) {
  const [selectedPorts, setSelectedPorts] = useState(new Set([2375, 11434]));
  const [customPort, setCustomPort] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const togglePort = (port) => {
    setSelectedPorts(prev => {
      const next = new Set(prev);
      next.has(port) ? next.delete(port) : next.add(port);
      return next;
    });
  };

  const addCustom = () => {
    const p = parseInt(customPort);
    if (p >= 1 && p <= 65535) {
      setSelectedPorts(prev => new Set([...prev, p]));
      setCustomPort('');
    }
  };

  const handleRun = async () => {
    if (!selectedPorts.size) return;
    setLoading(true);
    setError('');
    setResults(null);

    try {
      const res = await fetch('/api/deep-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ports: [...selectedPorts] }),
      });
      if (!res.ok) throw new Error('Deep check request failed');
      const data = await res.json();
      setResults(data.results || {});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openCount = results ? Object.values(results).filter(r => r?.open).length : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
    >
      <div
        className="glass rounded-2xl w-full max-w-lg shadow-2xl flex flex-col animate-slide-in"
        style={{ maxHeight: '90vh', border: '1px solid rgba(245,158,11,0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
               style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <ShieldAlert size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Deep Check</h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Active localhost port probe — 127.0.0.1 only</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'var(--muted)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Info */}
          <div className="flex gap-2 p-3 rounded-lg text-xs"
               style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <Info size={13} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
            <span style={{ color: '#94a3b8' }}>
              Probes each selected port via TCP connect on 127.0.0.1 with a 1s timeout.
              No data is read or sent. Results are not stored.
            </span>
          </div>

          {/* Port selection */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: 'var(--text)' }}>Select Ports</div>
            <div className="grid grid-cols-2 gap-1.5">
              {COMMON_PORTS.map(({ port, label, risk }) => {
                const colors = RISK_COLORS[risk];
                const selected = selectedPorts.has(port);
                return (
                  <button
                    key={port}
                    onClick={() => togglePort(port)}
                    className="flex items-center gap-2 p-2 rounded-lg text-left transition-all"
                    style={{
                      background: selected ? colors.bg : 'rgba(0,0,0,0.2)',
                      border: `1px solid ${selected ? colors.border : 'var(--border)'}`,
                    }}
                  >
                    <span className="mono text-xs flex-shrink-0" style={{ color: selected ? colors.text : 'var(--muted)' }}>
                      :{port}
                    </span>
                    <span className="text-[11px] truncate" style={{ color: selected ? colors.text : 'var(--muted)' }}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Custom port */}
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                placeholder="Custom port (1–65535)"
                value={customPort}
                onChange={e => setCustomPort(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustom()}
                className="flex-1 text-xs mono px-3 py-2 rounded-lg outline-none"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
              <button
                onClick={addCustom}
                className="text-xs px-3 py-2 rounded-lg btn-amber"
              >
                Add
              </button>
            </div>
          </div>

          {/* Results */}
          {results && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium" style={{ color: 'var(--text)' }}>Results</div>
                {openCount > 0 && (
                  <span className="text-xs mono badge-high px-2 py-0.5 rounded-full">
                    {openCount} open
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {[...selectedPorts].sort((a, b) => a - b).map(port => (
                  <PortResult key={port} port={port} result={results[port]} />
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs p-3 rounded-lg"
                 style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex justify-between items-center" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--muted)' }}>
            {selectedPorts.size} port{selectedPorts.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-xs px-4 py-2 rounded-lg transition-colors"
                    style={{ color: 'var(--muted)', border: '1px solid var(--border)' }}>
              Cancel
            </button>
            <button
              onClick={handleRun}
              disabled={loading || !selectedPorts.size}
              className="flex items-center gap-2 text-xs px-4 py-2 rounded-lg btn-amber disabled:opacity-50"
            >
              {loading ? <Loader size={12} className="animate-spin" /> : <Wifi size={12} />}
              {loading ? 'Probing…' : 'Run Deep Check'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

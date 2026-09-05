import React from 'react';
import { ShieldAlert, Terminal, RefreshCw, Radio, HardDriveDownload, Star } from 'lucide-react';

interface NavbarProps {
  host: string;
  isScanning: boolean;
  scanProgress: number;
  lastScanAt: string | null;
  onScan: () => void;
  onOpenDeepCheck: () => void;
}

function relTime(ts: string | null): string {
  if (!ts) return 'never';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export const Navbar: React.FC<NavbarProps> = ({
  host, isScanning, scanProgress, lastScanAt, onScan, onOpenDeepCheck,
}) => {
  return (
    <header className="border-b border-cyan-950/60 bg-[#090b10]/95 backdrop-blur-md sticky top-0 z-40">
      {/* Progress bar */}
      {isScanning && (
        <div className="h-[2px] w-full bg-slate-900 overflow-hidden">
          <div
            className="h-full bg-cyan-400 transition-all duration-500"
            style={{
              width: `${scanProgress}%`,
              boxShadow: '0 0 8px rgba(34,211,238,0.7)',
            }}
          />
        </div>
      )}

      <div className="px-6 py-3.5 max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo + host */}
        <div className="flex items-center space-x-4">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1
                className="text-lg font-bold text-slate-100 tracking-tight"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                PermissionDrift
              </h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950/70 text-cyan-400 border border-cyan-800/40">
                v1.0 · win32
              </span>
            </div>
            <p className="font-mono text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <Terminal className="w-3 h-3 text-cyan-600" />
              <span>Host:</span>
              <span className="text-slate-300 font-semibold">{host || 'Unknown'}</span>
              <span className="text-slate-700">·</span>
              <span>Last scan: {relTime(lastScanAt)}</span>
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenDeepCheck}
            className="px-3.5 py-1.5 rounded-md border border-amber-500/30 bg-amber-950/20 text-amber-400 hover:bg-amber-900/30 font-mono text-xs flex items-center gap-2 transition-all cursor-pointer hover:border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.1)]"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Port Probe</span>
          </button>

          <button
            onClick={onScan}
            disabled={isScanning}
            className={`px-4 py-1.5 rounded-md font-medium text-xs flex items-center gap-2 transition-all cursor-pointer ${
              isScanning
                ? 'bg-cyan-950 text-cyan-600 border border-cyan-900 cursor-not-allowed'
                : 'bg-cyan-500/10 border border-cyan-400/40 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-300 shadow-[0_0_20px_rgba(6,182,212,0.2)]'
            }`}
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Inspecting handles…' : 'Scan Posture'}</span>
          </button>

          <button
            title="Export latest snapshot as JSON"
            onClick={() => {
              const data = localStorage.getItem('pd_last_snapshot');
              if (data) {
                const blob = new Blob([data], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'permissiondrift_snapshot.json';
                a.click();
              }
            }}
            className="p-2 rounded-md border border-slate-800 hover:border-slate-700 bg-slate-900/50 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <HardDriveDownload className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

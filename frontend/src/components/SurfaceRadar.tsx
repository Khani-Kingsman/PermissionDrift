import React from 'react';
import { Radio, AlertOctagon, Terminal, Wifi, Lock } from 'lucide-react';
import type { ListeningPort } from '../types/drift';

interface SurfaceRadarProps {
  ports: ListeningPort[];
}

const KNOWN_SERVICES: Record<number, string> = {
  2375: 'Docker (unauth)',
  2376: 'Docker TLS',
  11434: 'Ollama / local AI',
  6443: 'Kubernetes API',
  5432: 'PostgreSQL',
  6379: 'Redis',
  27017: 'MongoDB',
  3000: 'Dev server',
  8080: 'HTTP alt',
  9090: 'Prometheus',
  5000: 'PermissionDrift API',
};

export const SurfaceRadar: React.FC<SurfaceRadarProps> = ({ ports }) => {
  if (!ports || ports.length === 0) {
    return (
      <div className="rounded-xl border border-cyan-950/80 bg-[#0d1017]/90 p-5 backdrop-blur-md">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-4 h-4 text-cyan-400" />
          <h3
            className="text-base font-bold text-slate-100"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Passive IPC &amp; Socket Radar
          </h3>
        </div>
        <p className="font-mono text-xs text-slate-600 text-center py-8">
          No listening ports detected. Run a scan to populate.
        </p>
      </div>
    );
  }

  const riskyPorts = ports.filter(p => p.is_risky);
  const safePorts = ports.filter(p => !p.is_risky);

  return (
    <div className="rounded-xl border border-cyan-950/80 bg-[#0d1017]/90 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/80">
        <div>
          <h3
            className="text-base font-bold text-slate-100 flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <Radio className="w-4 h-4 text-cyan-400" />
            Passive IPC &amp; Socket Radar
          </h3>
          <p className="font-mono text-xs text-slate-400 mt-0.5">
            Loopback ports in LISTEN state — sniffed passively, zero network overhead.
          </p>
        </div>
        {riskyPorts.length > 0 && (
          <div className="flex items-center gap-1.5 font-mono text-xs px-2.5 py-1 rounded-md border bg-amber-950/30 border-amber-800/40 text-amber-400">
            <AlertOctagon className="w-3.5 h-3.5" />
            {riskyPorts.length} risky {riskyPorts.length === 1 ? 'port' : 'ports'}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 font-mono">
        {/* Risky ports first */}
        {[...riskyPorts, ...safePorts].map(item => {
          const service = KNOWN_SERVICES[item.port] || item.description || '';
          return (
            <div
              key={`${item.port}-${item.pid}`}
              className={`p-3 rounded-lg border transition-all ${
                item.is_risky
                  ? 'bg-amber-950/20 border-amber-800/50 shadow-[0_0_10px_rgba(245,158,11,0.06)]'
                  : 'bg-slate-900/40 border-slate-800/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {item.is_risky
                    ? <Wifi className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                    : <Lock className="w-3.5 h-3.5 text-slate-600" />
                  }
                  <span className={`text-xs font-bold ${item.is_risky ? 'text-amber-300' : 'text-slate-200'}`}>
                    {item.ip}:{item.port}
                  </span>
                </div>
                {item.is_risky && (
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                <Terminal className="w-3 h-3 text-cyan-600 flex-shrink-0" />
                <span className="truncate" title={item.process_name}>{item.process_name}</span>
              </div>

              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-slate-600">PID {item.pid}</span>
                {service && (
                  <span className={`text-[10px] font-medium ${item.is_risky ? 'text-amber-400' : 'text-slate-500'}`}>
                    {service}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

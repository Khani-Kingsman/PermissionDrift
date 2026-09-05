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
      <div className="rounded-2xl border border-neutral-200/80 bg-white/75 backdrop-blur-md p-6">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-4 h-4 text-neutral-700" />
          <h3 className="text-base font-bold text-neutral-900 tracking-tight">
            Passive IPC &amp; Socket Radar
          </h3>
        </div>
        <p className="font-geist-mono text-xs text-neutral-400 text-center py-8">
          No listening ports recorded. Run a scan to inspect loopback sockets.
        </p>
      </div>
    );
  }

  const riskyPorts = ports.filter((p) => p.is_risky);
  const safePorts = ports.filter((p) => !p.is_risky);

  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white/75 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 pb-3 border-b border-neutral-100 gap-2">
        <div>
          <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2 tracking-tight">
            <Radio className="w-4 h-4 text-black" />
            Passive IPC &amp; Socket Radar
          </h3>
          <p className="font-geist-mono text-xs text-neutral-500 mt-0.5">
            Listening ports enumerated on local loopback with zero network overhead.
          </p>
        </div>
        {riskyPorts.length > 0 && (
          <div className="flex items-center gap-1.5 font-geist-mono text-xs px-3 py-1 rounded-full border bg-amber-50 border-amber-200 text-amber-800 font-semibold">
            <AlertOctagon className="w-3.5 h-3.5 text-amber-600" />
            {riskyPorts.length} Exposed Loopback Daemons
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 font-geist-mono">
        {[...riskyPorts, ...safePorts].map((item) => {
          const service = KNOWN_SERVICES[item.port] || item.description || '';
          return (
            <div
              key={`${item.port}-${item.pid}`}
              className={`p-3.5 rounded-xl border transition-all ${
                item.is_risky
                  ? 'bg-amber-50/40 border-amber-200 shadow-sm'
                  : 'bg-neutral-50/60 border-neutral-200/80'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {item.is_risky ? (
                    <Wifi className="w-3.5 h-3.5 text-amber-600" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                  <span
                    className={`text-xs font-bold ${
                      item.is_risky ? 'text-amber-900' : 'text-neutral-800'
                    }`}
                  >
                    {item.ip}:{item.port}
                  </span>
                </div>
                {item.is_risky && (
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                )}
              </div>

              <div className="flex items-center gap-1 text-[11px] text-neutral-600">
                <Terminal className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                <span className="truncate" title={item.process_name}>
                  {item.process_name}
                </span>
              </div>

              <div className="flex items-center justify-between mt-2 pt-1 border-t border-neutral-200/50">
                <span className="text-[10px] text-neutral-400">PID: {item.pid}</span>
                {service && (
                  <span
                    className={`text-[10px] font-semibold ${
                      item.is_risky ? 'text-amber-700' : 'text-neutral-500'
                    }`}
                  >
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

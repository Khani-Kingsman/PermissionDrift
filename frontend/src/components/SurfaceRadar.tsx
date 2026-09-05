import React from 'react';
import { Radio, AlertOctagon, Terminal, Wifi, Lock } from 'lucide-react';
import type { ListeningPort } from '../types/drift';

interface SurfaceRadarProps {
  ports: ListeningPort[];
  theme?: 'black' | 'white';
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

export const SurfaceRadar: React.FC<SurfaceRadarProps> = ({ ports, theme = 'white' }) => {
  const isBlack = theme === 'black';

  if (!ports || ports.length === 0) {
    return (
      <div className={`rounded-2xl border backdrop-blur-md p-6 ${
        isBlack
          ? 'border-neutral-800/80 bg-[#0f1219]/85 text-white shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
          : 'border-neutral-200/80 bg-white/75 text-neutral-900 shadow-sm'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <Radio className={`w-4 h-4 ${isBlack ? 'text-neutral-400' : 'text-neutral-700'}`} />
          <h3 className={`text-base font-bold tracking-tight ${isBlack ? 'text-white' : 'text-neutral-900'}`}>
            Passive IPC &amp; Socket Radar
          </h3>
        </div>
        <p className={`font-geist-mono text-xs text-center py-8 ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`}>
          No listening ports recorded. Run a scan to inspect loopback sockets.
        </p>
      </div>
    );
  }

  const riskyPorts = ports.filter((p) => p.is_risky);
  const safePorts = ports.filter((p) => !p.is_risky);

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
            <Radio className={`w-4 h-4 ${isBlack ? 'text-white' : 'text-black'}`} />
            Passive IPC &amp; Socket Radar
          </h3>
          <p className={`font-geist-mono text-xs mt-0.5 ${isBlack ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Listening ports enumerated on local loopback with zero network overhead.
          </p>
        </div>
        {riskyPorts.length > 0 && (
          <div className={`flex items-center gap-1.5 font-geist-mono text-xs px-3 py-1 rounded-full border font-semibold ${
            isBlack
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <AlertOctagon className="w-3.5 h-3.5 text-amber-500" />
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
                  ? isBlack
                    ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                    : 'bg-amber-50/40 border-amber-200 shadow-sm'
                  : isBlack
                  ? 'bg-[#141822]/70 border-neutral-800/80 text-neutral-300 hover:border-neutral-700'
                  : 'bg-neutral-50/60 border-neutral-200/80 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  {item.is_risky ? (
                    <Wifi className="w-3.5 h-3.5 text-amber-500" />
                  ) : (
                    <Lock className={`w-3.5 h-3.5 ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`} />
                  )}
                  <span
                    className={`text-xs font-bold ${
                      item.is_risky
                        ? isBlack ? 'text-amber-300' : 'text-amber-900'
                        : isBlack ? 'text-white' : 'text-neutral-800'
                    }`}
                  >
                    {item.ip}:{item.port}
                  </span>
                </div>
                {item.is_risky && (
                  <AlertOctagon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                )}
              </div>

              <div className={`flex items-center gap-1 text-[11px] ${isBlack ? 'text-neutral-400' : 'text-neutral-600'}`}>
                <Terminal className="w-3 h-3 text-neutral-500 flex-shrink-0" />
                <span className="truncate" title={item.process_name}>
                  {item.process_name}
                </span>
              </div>

              <div className={`flex items-center justify-between mt-2 pt-1 border-t ${
                isBlack ? 'border-neutral-800/80' : 'border-neutral-200/50'
              }`}>
                <span className={`text-[10px] ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`}>PID: {item.pid}</span>
                {service && (
                  <span
                    className={`text-[10px] font-semibold ${
                      item.is_risky
                        ? isBlack ? 'text-amber-400' : 'text-amber-700'
                        : isBlack ? 'text-neutral-400' : 'text-neutral-500'
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

import React from 'react';
import { ShieldAlert, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';

export default function BlastRadiusGauge({ score = 0, history = [] }) {
  // Score tier color & label
  let tierColor = 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10 shadow-emerald-500/20';
  let tierLabel = 'Minimal Risk';
  let gaugeColor = '#10B981';

  if (score > 75) {
    tierColor = 'text-red-400 border-red-500/30 bg-red-500/10 shadow-red-500/20';
    tierLabel = 'Severe Exposure';
    gaugeColor = '#EF4444';
  } else if (score > 40) {
    tierColor = 'text-orange-400 border-orange-500/30 bg-orange-500/10 shadow-orange-500/20';
    tierLabel = 'Elevated Risk';
    gaugeColor = '#F97316';
  } else if (score > 15) {
    tierColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10 shadow-amber-500/20';
    tierLabel = 'Moderate Exposure';
    gaugeColor = '#F59E0B';
  }

  // Calculate circumference for circular gauge (radius 54)
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md relative overflow-hidden flex flex-col justify-between">
      {/* Background glow */}
      <div 
        className="absolute -top-16 -left-16 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
        style={{ backgroundColor: gaugeColor }}
      />

      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Posture Metric</span>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            Blast Radius Score
          </h3>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${tierColor}`}>
          {tierLabel}
        </div>
      </div>

      <div className="flex items-center justify-around my-2">
        {/* SVG Circular Progress Gauge */}
        <div className="relative flex items-center justify-center">
          <svg className="w-36 h-36 transform -rotate-90">
            {/* Track */}
            <circle
              cx="72"
              cy="72"
              r={radius}
              stroke="currentColor"
              strokeWidth="10"
              className="text-slate-800"
              fill="transparent"
            />
            {/* Value */}
            <circle
              cx="72"
              cy="72"
              r={radius}
              stroke={gaugeColor}
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              fill="transparent"
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold tracking-tight text-white font-mono">{score}</span>
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-widest">/ 100</span>
          </div>
        </div>

        {/* Trend Info */}
        <div className="flex flex-col gap-2 pl-4">
          <div className="text-xs text-slate-400">
            Historical Trend (Last {history.length} scans):
          </div>
          {/* Sparkline bars */}
          <div className="flex items-end gap-1.5 h-12 bg-slate-950/50 p-2 rounded-lg border border-slate-800">
            {history.length === 0 ? (
              <span className="text-[11px] text-slate-500">No previous scans</span>
            ) : (
              history.slice(-8).map((snap, idx) => {
                const s = snap.blast_radius_score || 0;
                const heightPct = Math.max(12, (s / 100) * 100);
                const barColor = s > 60 ? 'bg-red-400' : (s > 25 ? 'bg-amber-400' : 'bg-emerald-400');
                return (
                  <div key={idx} className="flex flex-col items-center group relative">
                    <div 
                      className={`w-3 rounded-t transition-all duration-300 ${barColor}`} 
                      style={{ height: `${heightPct}%` }}
                    />
                    <div className="absolute -top-6 hidden group-hover:block bg-slate-800 text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 text-white z-10 whitespace-nowrap">
                      {s}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            Weighted exposure index across all credentials.
          </p>
        </div>
      </div>
    </div>
  );
}

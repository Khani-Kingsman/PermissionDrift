import React, { useEffect, useRef } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface GaugeProps {
  score: number;
  prevScore: number;
  scoreHistory: number[];
  theme?: 'black' | 'white';
}

const getScheme = (val: number, isBlack: boolean) => {
  if (val >= 70)
    return {
      stroke: '#ef4444',
      text: isBlack ? 'text-red-400' : 'text-red-600',
      badge: isBlack ? 'bg-red-950/40 border-red-800/60 text-red-300' : 'bg-red-50 border-red-200 text-red-700',
      label: 'CRITICAL EXPOSURE',
    };
  if (val >= 40)
    return {
      stroke: '#f59e0b',
      text: isBlack ? 'text-amber-400' : 'text-amber-600',
      badge: isBlack ? 'bg-amber-950/40 border-amber-800/60 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-700',
      label: 'ELEVATED RISK',
    };
  return {
    stroke: '#10b981',
    text: isBlack ? 'text-emerald-400' : 'text-emerald-600',
    badge: isBlack ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700',
    label: 'NOMINAL POSTURE',
  };
};

export const BlastRadiusGauge: React.FC<GaugeProps> = ({ score, prevScore, scoreHistory, theme = 'white' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isBlack = theme === 'black';
  const clampedScore = Math.min(100, Math.max(0, score));
  const scheme = getScheme(clampedScore, isBlack);
  const delta = score - prevScore;

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clampedScore / 100) * circumference;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || scoreHistory.length < 2) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width,
      H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const vals = scoreHistory.slice(-20);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const range = max - min || 1;

    const pts = vals.map((v, i) => ({
      x: (i / (vals.length - 1)) * W,
      y: H - ((v - min) / range) * (H - 6) - 3,
    }));

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, scheme.stroke + '33');
    grad.addColorStop(1, scheme.stroke + '00');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, H);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = scheme.stroke;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, [scoreHistory, scheme.stroke]);

  return (
    <div className={`relative rounded-2xl border backdrop-blur-md p-6 transition-all ${
      isBlack
        ? 'border-neutral-800/80 bg-[#0f1219]/85 text-white shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
        : 'border-neutral-200/80 bg-white/75 text-neutral-900 shadow-sm hover:shadow-md'
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-3">
          <span className={`font-geist-mono text-[11px] uppercase tracking-widest flex items-center gap-1.5 font-medium ${
            isBlack ? 'text-neutral-400' : 'text-neutral-400'
          }`}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Active Blast Radius
          </span>
          <h2 className={`text-2xl font-bold mt-1 tracking-tight ${isBlack ? 'text-white' : 'text-neutral-900'}`}>
            Machine Posture
          </h2>
          <p className={`font-geist-mono text-xs mt-1 leading-relaxed ${isBlack ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Privilege escalation exposure score calculated from live handles & credentials.
          </p>

          <div
            className={`inline-flex items-center gap-1.5 mt-4 px-2.5 py-1 rounded-full border text-[11px] font-geist-mono font-semibold ${scheme.badge}`}
          >
            {clampedScore >= 70 ? '●' : clampedScore >= 40 ? '▲' : '◆'} {scheme.label}
          </div>
        </div>

        {/* SVG Circular Ring */}
        <div className="relative flex-shrink-0 flex items-center justify-center">
          <svg className="w-32 h-32 -rotate-90 transform">
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke={isBlack ? '#27272a' : '#e5e7eb'}
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="64"
              cy="64"
              r={radius}
              stroke={scheme.stroke}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute flex flex-col items-center text-center">
            <span className={`font-geist-mono text-3xl font-bold tracking-tight ${scheme.text}`}>
              {clampedScore}
            </span>
            <span className={`font-geist-mono text-[9px] uppercase tracking-wider ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`}>
              / 100
            </span>
          </div>
        </div>
      </div>

      {/* Trajectory */}
      <div className={`mt-5 pt-4 border-t flex items-center justify-between ${isBlack ? 'border-neutral-800/80' : 'border-neutral-100'}`}>
        <div className={`flex items-center gap-2 font-geist-mono text-xs ${isBlack ? 'text-neutral-300' : 'text-neutral-600'}`}>
          <span>Drift trajectory:</span>
          <span className={`font-semibold ${isBlack ? 'text-white' : 'text-neutral-900'}`}>{prevScore}</span>
          <span className="text-neutral-400">→</span>
          <span className={`font-bold ${scheme.text}`}>{score}</span>
        </div>
        <div className={`flex items-center gap-1 text-[11px] font-geist-mono px-2 py-0.5 rounded-full border ${scheme.badge}`}>
          {delta > 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : delta < 0 ? (
            <TrendingDown className="w-3 h-3" />
          ) : (
            <Minus className="w-3 h-3" />
          )}
          <span>
            {delta > 0 ? '+' : ''}
            {delta} pts
          </span>
        </div>
      </div>

      {/* Sparkline Canvas */}
      {scoreHistory.length >= 2 && (
        <div className="mt-3">
          <div className={`font-geist-mono text-[10px] mb-1 ${isBlack ? 'text-neutral-500' : 'text-neutral-400'}`}>
            historical scans →
          </div>
          <canvas ref={canvasRef} width={260} height={32} className="w-full" />
        </div>
      )}
    </div>
  );
};

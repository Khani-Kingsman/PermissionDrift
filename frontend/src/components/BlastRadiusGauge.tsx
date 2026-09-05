import React, { useEffect, useRef } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface GaugeProps {
  score: number;
  prevScore: number;
  scoreHistory: number[];
}

const getScheme = (val: number) => {
  if (val >= 70)
    return {
      stroke: '#dc2626',
      text: 'text-red-600',
      badge: 'bg-red-50 border-red-200 text-red-700',
      label: 'CRITICAL EXPOSURE',
    };
  if (val >= 40)
    return {
      stroke: '#d97706',
      text: 'text-amber-600',
      badge: 'bg-amber-50 border-amber-200 text-amber-700',
      label: 'ELEVATED RISK',
    };
  return {
    stroke: '#16a34a',
    text: 'text-emerald-600',
    badge: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    label: 'NOMINAL POSTURE',
  };
};

export const BlastRadiusGauge: React.FC<GaugeProps> = ({ score, prevScore, scoreHistory }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clampedScore = Math.min(100, Math.max(0, score));
  const scheme = getScheme(clampedScore);
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
    <div className="relative rounded-2xl border border-neutral-200/80 bg-white/75 backdrop-blur-md p-6 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-3">
          <span className="font-geist-mono text-[11px] uppercase tracking-widest text-neutral-400 flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Active Blast Radius
          </span>
          <h2 className="text-2xl font-bold text-neutral-900 mt-1 tracking-tight">Machine Posture</h2>
          <p className="font-geist-mono text-xs text-neutral-500 mt-1 leading-relaxed">
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
            <circle cx="64" cy="64" r={radius} stroke="#e5e7eb" strokeWidth="8" fill="transparent" />
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
            <span className="font-geist-mono text-[9px] uppercase tracking-wider text-neutral-400">/ 100</span>
          </div>
        </div>
      </div>

      {/* Trajectory */}
      <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-2 font-geist-mono text-xs text-neutral-600">
          <span>Drift trajectory:</span>
          <span className="text-neutral-900 font-semibold">{prevScore}</span>
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
          <div className="font-geist-mono text-[10px] text-neutral-400 mb-1">historical scans →</div>
          <canvas ref={canvasRef} width={260} height={32} className="w-full" />
        </div>
      )}
    </div>
  );
};

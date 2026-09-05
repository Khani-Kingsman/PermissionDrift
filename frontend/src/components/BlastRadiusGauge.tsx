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
      stroke: '#ef4444',
      text: 'text-red-400',
      glow: 'rgba(239,68,68,0.35)',
      badge: 'bg-red-950/60 border-red-800/60 text-red-300',
      label: 'CRITICAL EXPOSURE',
    };
  if (val >= 40)
    return {
      stroke: '#f59e0b',
      text: 'text-amber-400',
      glow: 'rgba(245,158,11,0.35)',
      badge: 'bg-amber-950/60 border-amber-800/60 text-amber-300',
      label: 'ELEVATED RISK',
    };
  return {
    stroke: '#10b981',
    text: 'text-emerald-400',
    glow: 'rgba(16,185,129,0.35)',
    badge: 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300',
    label: 'NOMINAL',
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

  // Sparkline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || scoreHistory.length < 2) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width, H = canvas.height;
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
    grad.addColorStop(0, scheme.stroke + '55');
    grad.addColorStop(1, scheme.stroke + '00');
    ctx.beginPath();
    ctx.moveTo(pts[0].x, H);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
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
    <div className="relative overflow-hidden rounded-xl border border-cyan-950/80 bg-[#0d1017]/90 p-5 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
      {/* Ambient glow blob */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-[70px] pointer-events-none transition-colors duration-1000"
        style={{ background: scheme.glow }}
      />

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0 pr-3">
          <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Active Blast Radius
          </span>
          <h2
            className="text-2xl font-bold text-slate-100 mt-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Machine Posture
          </h2>
          <p className="font-mono text-xs text-slate-400 mt-1">
            Privilege exposure score based on active handles & tokens.
          </p>

          {/* Risk label */}
          <div className={`inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-md border text-xs font-mono font-semibold ${scheme.badge}`}>
            {clampedScore >= 70 ? '⬡' : clampedScore >= 40 ? '◈' : '◇'} {scheme.label}
          </div>
        </div>

        {/* SVG Gauge */}
        <div className="relative flex-shrink-0 flex items-center justify-center">
          <svg className="w-32 h-32 -rotate-90 transform">
            <circle cx="64" cy="64" r={radius} stroke="#1e293b" strokeWidth="8" fill="transparent" />
            <circle
              cx="64" cy="64" r={radius}
              stroke={scheme.stroke}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-1000 ease-out"
              style={{ filter: `drop-shadow(0 0 6px ${scheme.stroke})` }}
            />
          </svg>
          <div className="absolute flex flex-col items-center text-center">
            <span className={`font-mono text-3xl font-bold tracking-tighter ${scheme.text}`}>
              {clampedScore}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">/ 100</span>
          </div>
        </div>
      </div>

      {/* Delta footer */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-slate-400">Trajectory:</span>
          <span className="text-slate-200 font-semibold">{prevScore}</span>
          <span className="text-slate-600">→</span>
          <span className={`font-bold ${scheme.text}`}>{score}</span>
        </div>
        <div className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border ${scheme.badge}`}>
          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          <span>{delta > 0 ? '+' : ''}{delta} pts</span>
        </div>
      </div>

      {/* Sparkline */}
      {scoreHistory.length >= 2 && (
        <div className="mt-3">
          <div className="font-mono text-[10px] text-slate-600 mb-1">score history →</div>
          <canvas ref={canvasRef} width={260} height={36} className="w-full opacity-80" />
        </div>
      )}
    </div>
  );
};

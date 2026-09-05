import React, { useEffect, useRef } from 'react';

const SEVERITY_COLOR = {
  0:  { stroke: '#10b981', glow: 'rgba(16,185,129,0.4)', label: 'Minimal' },
  25: { stroke: '#eab308', glow: 'rgba(234,179,8,0.4)',  label: 'Low' },
  50: { stroke: '#f97316', glow: 'rgba(249,115,22,0.4)', label: 'Medium' },
  75: { stroke: '#ef4444', glow: 'rgba(239,68,68,0.4)',  label: 'High' },
};

function getTier(score) {
  if (score >= 75) return SEVERITY_COLOR[75];
  if (score >= 50) return SEVERITY_COLOR[50];
  if (score >= 25) return SEVERITY_COLOR[25];
  return SEVERITY_COLOR[0];
}

export default function BlastRadiusGauge({ score = 0, history = [] }) {
  const canvasRef = useRef(null);
  const clampedScore = Math.min(100, Math.max(0, score));
  const tier = getTier(clampedScore);

  // Draw sparkline
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const vals = history.slice(-20);
    const max = Math.max(...vals, 1);
    const min = Math.min(...vals, 0);
    const range = max - min || 1;

    const pts = vals.map((v, i) => ({
      x: (i / (vals.length - 1)) * W,
      y: H - ((v - min) / range) * (H - 6) - 3,
    }));

    // Gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, tier.stroke + '55');
    grad.addColorStop(1, tier.stroke + '00');

    ctx.beginPath();
    ctx.moveTo(pts[0].x, H);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, H);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = tier.stroke;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, [history, tier.stroke]);

  // SVG arc values
  const R = 76;
  const cx = 100, cy = 100;
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const totalArc = endAngle - startAngle;
  const arcLen = totalArc * (clampedScore / 100);

  const polarToXY = (angle, r) => ({
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  });

  const bgStart = polarToXY(startAngle, R);
  const bgEnd = polarToXY(endAngle, R);
  const fgEnd = polarToXY(startAngle + arcLen, R);
  const bgLargeArc = totalArc > Math.PI ? 1 : 0;
  const fgLargeArc = arcLen > Math.PI ? 1 : 0;

  const bgPath = `M ${bgStart.x} ${bgStart.y} A ${R} ${R} 0 ${bgLargeArc} 1 ${bgEnd.x} ${bgEnd.y}`;
  const fgPath = clampedScore > 0
    ? `M ${bgStart.x} ${bgStart.y} A ${R} ${R} 0 ${fgLargeArc} 1 ${fgEnd.x} ${fgEnd.y}`
    : '';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Arc gauge */}
      <div className="relative">
        <svg width={200} height={160} viewBox="0 0 200 160">
          <defs>
            <filter id="glow-filter">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Track */}
          <path
            d={bgPath}
            fill="none"
            stroke="#1e2d45"
            strokeWidth={10}
            strokeLinecap="round"
          />

          {/* Score arc */}
          {clampedScore > 0 && (
            <path
              d={fgPath}
              fill="none"
              stroke={tier.stroke}
              strokeWidth={10}
              strokeLinecap="round"
              filter="url(#glow-filter)"
              style={{ transition: 'stroke 0.6s ease' }}
            />
          )}

          {/* Center score */}
          <text
            x={cx} y={cy - 4}
            textAnchor="middle"
            fill={tier.stroke}
            fontSize={36}
            fontWeight={700}
            fontFamily="ui-monospace, monospace"
            style={{ transition: 'fill 0.6s ease' }}
          >
            {clampedScore}
          </text>
          <text
            x={cx} y={cy + 18}
            textAnchor="middle"
            fill="#64748b"
            fontSize={11}
            fontFamily="system-ui, sans-serif"
            letterSpacing={2}
          >
            BLAST RADIUS
          </text>

          {/* Min/Max labels */}
          <text x={26} y={148} fill="#334155" fontSize={10} fontFamily="monospace">0</text>
          <text x={164} y={148} fill="#334155" fontSize={10} fontFamily="monospace">100</text>
        </svg>

        {/* Severity label */}
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 text-xs font-medium px-2 py-0.5 rounded-full"
          style={{
            background: tier.glow,
            color: tier.stroke,
            border: `1px solid ${tier.stroke}44`,
            fontFamily: 'monospace',
            letterSpacing: '0.1em',
          }}
        >
          {tier.label}
        </div>
      </div>

      {/* Sparkline */}
      {history.length >= 2 && (
        <div className="w-full px-2">
          <div className="text-[10px] text-slate-600 mb-1 text-right mono">trend →</div>
          <canvas
            ref={canvasRef}
            width={160}
            height={32}
            className="w-full"
            style={{ opacity: 0.85 }}
          />
        </div>
      )}
    </div>
  );
}

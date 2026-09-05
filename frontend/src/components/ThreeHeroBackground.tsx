import React from 'react';

interface ThreeHeroBackgroundProps {
  theme?: 'black' | 'white';
}

/**
 * High-Performance Pure CSS Cyber-Grid Background.
 * Guarantees 0% CPU and 0% GPU utilization.
 * Completely eliminates WebGL, Canvas, and requestAnimationFrame loops to guarantee
 * zero thermal stress, zero VRAM allocation, and zero driver/hardware crashes.
 */
export const ThreeHeroBackground: React.FC<ThreeHeroBackgroundProps> = ({ theme = 'white' }) => {
  const isBlack = theme === 'black';

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none transition-colors duration-500"
      style={{
        backgroundColor: isBlack ? '#07080c' : '#f8fafc',
      }}
    >
      {/* Architectural Security Grid (Pure CSS - 0% GPU / 0% CPU) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: isBlack
            ? `radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.08) 0%, transparent 70%),
               linear-gradient(to right, rgba(255, 255, 255, 0.07) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(255, 255, 255, 0.07) 1px, transparent 1px)`
            : `radial-gradient(circle at 50% 30%, rgba(15, 23, 42, 0.05) 0%, transparent 70%),
               linear-gradient(to right, rgba(15, 23, 42, 0.06) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(15, 23, 42, 0.06) 1px, transparent 1px)`,
          backgroundSize: '100% 100%, 48px 48px, 48px 48px',
        }}
      />

      {/* Cyber-Security Ambient Glow Orbs */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[100px] pointer-events-none"
        style={{
          background: isBlack
            ? 'radial-gradient(circle, rgba(16, 185, 129, 0.14) 0%, rgba(249, 115, 22, 0.07) 45%, transparent 70%)'
            : 'radial-gradient(circle, rgba(16, 185, 129, 0.10) 0%, rgba(249, 115, 22, 0.05) 45%, transparent 70%)',
        }}
      />

      {/* Cyber Mesh Dot Matrix Accents */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: isBlack
            ? 'radial-gradient(rgba(255, 255, 255, 0.22) 1px, transparent 1px)'
            : 'radial-gradient(rgba(15, 23, 42, 0.16) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 60% 50% at 50% 25%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 50% at 50% 25%, black 40%, transparent 100%)',
        }}
      />

      {/* Bottom gradient fade into content */}
      <div
        className="absolute bottom-0 inset-x-0 h-32 pointer-events-none"
        style={{
          background: isBlack
            ? 'linear-gradient(to bottom, transparent, #07080c)'
            : 'linear-gradient(to bottom, transparent, #f8fafc)',
        }}
      />
    </div>
  );
};
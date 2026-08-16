import React from 'react';

export const AnimatedBackground: React.FC = () => {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 select-none">
      {/* Orb 1: Emerald & Cyan Glow */}
      <div 
        className="absolute w-[500px] h-[500px] sm:w-[680px] sm:h-[680px] rounded-full blur-[100px] sm:blur-[140px] opacity-75 dark:opacity-60 mix-blend-screen dark:mix-blend-lighten animate-float-orb-1"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.35) 0%, rgba(6,182,212,0.2) 60%, transparent 80%)',
          top: '-10%',
          left: '-10%'
        }}
      />

      {/* Orb 2: Indigo & Violet Glow */}
      <div 
        className="absolute w-[460px] h-[460px] sm:w-[620px] sm:h-[620px] rounded-full blur-[100px] sm:blur-[140px] opacity-70 dark:opacity-55 mix-blend-screen dark:mix-blend-lighten animate-float-orb-2"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, rgba(168,85,247,0.18) 55%, transparent 80%)',
          top: '25%',
          right: '-8%'
        }}
      />

      {/* Orb 3: Warm Amber & Rose Glow */}
      <div 
        className="absolute w-[440px] h-[440px] sm:w-[600px] sm:h-[600px] rounded-full blur-[100px] sm:blur-[140px] opacity-65 dark:opacity-50 mix-blend-screen dark:mix-blend-lighten animate-float-orb-3"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.28) 0%, rgba(244,63,94,0.16) 60%, transparent 80%)',
          bottom: '-12%',
          left: '20%'
        }}
      />

      {/* Orb 4: Sky Blue & Teal Accent */}
      <div 
        className="absolute w-[400px] h-[400px] sm:w-[540px] sm:h-[540px] rounded-full blur-[90px] sm:blur-[130px] opacity-60 dark:opacity-45 mix-blend-screen dark:mix-blend-lighten animate-float-orb-4"
        style={{
          background: 'radial-gradient(circle, rgba(14,165,233,0.25) 0%, rgba(20,184,166,0.15) 55%, transparent 80%)',
          top: '55%',
          left: '-5%'
        }}
      />

      {/* Orb 5: Purple & Magenta Pulse */}
      <div 
        className="absolute w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] rounded-full blur-[80px] sm:blur-[120px] opacity-55 dark:opacity-40 mix-blend-screen dark:mix-blend-lighten animate-float-orb-5"
        style={{
          background: 'radial-gradient(circle, rgba(217,70,239,0.22) 0%, rgba(139,92,246,0.12) 60%, transparent 80%)',
          bottom: '15%',
          right: '18%'
        }}
      />
    </div>
  );
};

import React from 'react';

export const AnimatedBackground: React.FC = () => {
  return (
    <div className="pointer-events-none fixed -inset-32 sm:-inset-48 overflow-hidden z-0 select-none">
      {/* Orb 1: Emerald & Cyan Glow */}
      <div 
        className="absolute w-[540px] h-[540px] sm:w-[760px] sm:h-[760px] rounded-full blur-[120px] sm:blur-[160px] opacity-70 dark:opacity-50 mix-blend-screen dark:mix-blend-lighten animate-float-orb-1"
        style={{
          background: 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, rgba(6,182,212,0.15) 45%, transparent 70%)',
          top: '0%',
          left: '0%'
        }}
      />

      {/* Orb 2: Indigo & Violet Glow */}
      <div 
        className="absolute w-[500px] h-[500px] sm:w-[700px] sm:h-[700px] rounded-full blur-[120px] sm:blur-[160px] opacity-65 dark:opacity-45 mix-blend-screen dark:mix-blend-lighten animate-float-orb-2"
        style={{
          background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.12) 45%, transparent 70%)',
          top: '28%',
          right: '0%'
        }}
      />

      {/* Orb 3: Warm Amber & Sunset Glow */}
      <div 
        className="absolute w-[480px] h-[480px] sm:w-[680px] sm:h-[680px] rounded-full blur-[120px] sm:blur-[160px] opacity-60 dark:opacity-40 mix-blend-screen dark:mix-blend-lighten animate-float-orb-3"
        style={{
          background: 'radial-gradient(circle, rgba(245,158,11,0.22) 0%, rgba(244,63,94,0.1) 45%, transparent 70%)',
          bottom: '0%',
          left: '25%'
        }}
      />

      {/* Orb 4: Sky Blue & Teal Accent */}
      <div 
        className="absolute w-[440px] h-[440px] sm:w-[620px] sm:h-[620px] rounded-full blur-[110px] sm:blur-[150px] opacity-55 dark:opacity-35 mix-blend-screen dark:mix-blend-lighten animate-float-orb-4"
        style={{
          background: 'radial-gradient(circle, rgba(14,165,233,0.2) 0%, rgba(20,184,166,0.1) 45%, transparent 70%)',
          top: '55%',
          left: '0%'
        }}
      />

      {/* Orb 5: Magenta & Purple Accent */}
      <div 
        className="absolute w-[400px] h-[400px] sm:w-[560px] sm:h-[560px] rounded-full blur-[100px] sm:blur-[140px] opacity-50 dark:opacity-30 mix-blend-screen dark:mix-blend-lighten animate-float-orb-5"
        style={{
          background: 'radial-gradient(circle, rgba(217,70,239,0.18) 0%, rgba(139,92,246,0.08) 45%, transparent 70%)',
          bottom: '15%',
          right: '15%'
        }}
      />
    </div>
  );
};

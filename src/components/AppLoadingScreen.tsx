import React, { useState, useEffect } from 'react';
import { BrandLogo } from './BrandLogo.tsx';
import { AnimatedBackground } from './AnimatedBackground.tsx';

const LOADING_STATUS_MESSAGES = [
  'Initializing focus workspace...',
  'Connecting to peer study network...',
  'Calibrating AI screen verification...',
  'Syncing cohort leaderboards...'
];

export const AppLoadingScreen: React.FC = () => {
  const [statusIndex, setStatusIndex] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setStatusIndex(prev => (prev + 1) % LOADING_STATUS_MESSAGES.length);
        setFade(true);
      }, 250);
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 h-screen w-screen flex flex-col items-center justify-center bg-[#09090b] text-zinc-100 overflow-hidden select-none font-sans">
      {/* Animated Floating Luminous Mesh Background */}
      <AnimatedBackground />

      {/* Center Cinematic Container */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-sm">
        
        {/* Glowing Orb Halo & Floating Avocado Emblem */}
        <div className="relative mb-7 flex items-center justify-center">
          
          {/* Radial Ambient Neon Aura */}
          <div className="absolute w-44 h-44 rounded-full bg-gradient-to-tr from-emerald-500/20 via-cyan-500/20 to-purple-500/20 blur-2xl animate-pulse-glow-ring pointer-events-none" />

          {/* Rotating Orbital Dashed Ring */}
          <div className="absolute w-36 h-36 rounded-full border border-dashed border-white/15 animate-loading-halo pointer-events-none" />

          {/* Concentric Frosted Glass Ring */}
          <div className="absolute w-28 h-28 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md pointer-events-none shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]" />

          {/* Floating Avocado Mark */}
          <div className="relative z-10 animate-loading-levitate p-4">
            <BrandLogo size="lg" className="drop-shadow-[0_4px_24px_rgba(255,255,255,0.25)]" />
          </div>
        </div>

        {/* Brand Title & Tag */}
        <div className="space-y-1.5 mb-6">
          <div className="flex items-center justify-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
              StudySync
            </h1>
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10">
              Focus Hub
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-medium tracking-wide">
            Peer Accountability & AI-Proctored Deep Work
          </p>
        </div>

        {/* Luxury Linear Shimmer Progress Beam */}
        <div className="w-48 sm:w-56 h-1 rounded-full bg-zinc-800/80 border border-white/5 overflow-hidden relative mb-4 shadow-inner">
          <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-400 to-cyan-400 rounded-full animate-shimmer-beam filter drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
        </div>

        {/* Dynamic Status Ticker */}
        <div className="h-5 flex items-center justify-center">
          <p 
            className={`text-[11px] font-mono font-medium text-zinc-400 transition-all duration-300 transform ${
              fade ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
            }`}
          >
            {LOADING_STATUS_MESSAGES[statusIndex]}
          </p>
        </div>

      </div>

      {/* Bottom Minimalist Watermark */}
      <div className="absolute bottom-8 z-10 flex items-center space-x-2 text-[10px] font-mono text-zinc-600 tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-ping"></span>
        <span>SYNCHRONIZING ENVIRONMENT</span>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { BrandLogo } from './BrandLogo.tsx';
import { AnimatedBackground } from './AnimatedBackground.tsx';

interface AppLoadingScreenProps {
  onFinished?: () => void;
  minDurationMs?: number;
}

const STAGES = [
  { progress: 28, text: 'Initializing focus workspace...' },
  { progress: 62, text: 'Connecting to peer study network...' },
  { progress: 88, text: 'Calibrating AI screen verification...' },
  { progress: 100, text: 'Focus workspace ready' }
];

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({
  onFinished,
  minDurationMs = 2000
}) => {
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / minDurationMs) * 100));
      setProgress(pct);

      if (pct < 30) {
        setStageIndex(0);
      } else if (pct < 65) {
        setStageIndex(1);
      } else if (pct < 92) {
        setStageIndex(2);
      } else {
        setStageIndex(3);
      }

      if (pct >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsExiting(true);
          setTimeout(() => {
            if (onFinished) onFinished();
          }, 450);
        }, 200);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [minDurationMs, onFinished]);

  return (
    <div 
      className={`fixed inset-0 z-[999] h-screen w-screen flex flex-col items-center justify-center bg-[#09090b] text-zinc-100 overflow-hidden select-none font-sans transition-all duration-500 ease-out ${
        isExiting ? 'opacity-0 scale-105 pointer-events-none filter blur-sm' : 'opacity-100 scale-100'
      }`}
    >
      {/* Animated Floating Luminous Mesh Background */}
      <AnimatedBackground />

      {/* Center Cinematic Container */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-sm">
        
        {/* Glowing Orb Halo & Floating Avocado Emblem */}
        <div className="relative mb-8 flex items-center justify-center">
          
          {/* Radial Ambient Neon Aura */}
          <div className="absolute w-48 h-48 rounded-full bg-gradient-to-tr from-emerald-500/25 via-cyan-500/20 to-purple-500/20 blur-2xl animate-pulse-glow-ring pointer-events-none" />

          {/* Rotating Orbital Dashed Ring */}
          <div className="absolute w-36 h-36 rounded-full border border-dashed border-white/15 animate-loading-halo pointer-events-none" />

          {/* Concentric Frosted Glass Ring */}
          <div className="absolute w-28 h-28 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md pointer-events-none shadow-[inset_0_0_24px_rgba(255,255,255,0.06)]" />

          {/* Floating Avocado Mark */}
          <div className="relative z-10 animate-loading-levitate p-4">
            <BrandLogo size="lg" className="drop-shadow-[0_4px_28px_rgba(255,255,255,0.3)]" />
          </div>
        </div>

        {/* Brand Title & Tag */}
        <div className="space-y-1.5 mb-7">
          <div className="flex items-center justify-center space-x-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
              StudySync
            </h1>
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 text-zinc-200 border border-white/10">
              Focus Hub
            </span>
          </div>
          <p className="text-xs text-zinc-400 font-medium tracking-wide">
            Peer Accountability & AI-Proctored Deep Work
          </p>
        </div>

        {/* Real Dynamic Shimmer Progress Bar */}
        <div className="w-52 sm:w-64 space-y-2 mb-4">
          <div className="h-1.5 w-full rounded-full bg-zinc-900 border border-white/10 overflow-hidden relative shadow-inner">
            <div 
              className="h-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 rounded-full transition-all duration-100 ease-out shadow-[0_0_12px_rgba(52,211,153,0.8)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 px-0.5">
            <span className="text-zinc-400 truncate max-w-[180px]">
              {STAGES[stageIndex].text}
            </span>
            <span className="font-semibold text-zinc-300">
              {progress}%
            </span>
          </div>
        </div>

      </div>

      {/* Bottom Minimalist Watermark */}
      <div className="absolute bottom-8 z-10 flex items-center space-x-2 text-[10px] font-mono text-zinc-500 tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-ping"></span>
        <span>SYNCHRONIZING ENVIRONMENT</span>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BrandLogo } from './BrandLogo.tsx';
import { GraduationCap, Coffee, CheckCircle2, AlertTriangle, ArrowLeft, Clock, Lock } from 'lucide-react';
import { format } from 'date-fns';

interface DailyRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoutine: 'college' | 'no_college' | null;
  onSelectRoutine: (routine: 'college' | 'no_college') => void;
}

export const DailyRoutineModal: React.FC<DailyRoutineModalProps> = ({
  isOpen,
  onClose,
  currentRoutine,
  onSelectRoutine
}) => {
  const [selectedChoice, setSelectedChoice] = useState<'college' | 'no_college' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedChoice(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const todayFormatted = format(new Date(), 'EEEE, MMMM d');

  const handleConfirm = () => {
    if (!selectedChoice) return;
    onSelectRoutine(selectedChoice);
    setSelectedChoice(null);
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 dark:bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 select-none overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && currentRoutine) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.9)] text-zinc-100 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {!selectedChoice ? (
          /* ─── STEP 1: Select Routine ─── */
          <>
            {/* Top Header */}
            <div className="relative z-10 flex flex-col items-center text-center space-y-2 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner mb-0.5">
                <BrandLogo size="xs" className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Daily Focus Check-in
                  </h2>
                  <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    2 AM Reset
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {todayFormatted} · Select today's target
                </p>
              </div>
            </div>

            {/* Options Grid */}
            <div className="relative z-10 space-y-3 mb-5">
              {/* Option 1: College Day (4h Target) */}
              <button
                type="button"
                onClick={() => setSelectedChoice('college')}
                className="w-full p-4 rounded-2xl border transition-all cursor-pointer text-left flex items-center justify-between gap-3 active:scale-[0.98] bg-white/[0.04] hover:bg-white/[0.08] text-white border-white/10 hover:border-emerald-500/40 group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight text-white">
                      Attended College / Classes
                    </p>
                    <p className="text-xs mt-0.5 text-zinc-400">
                      Busy with classes · study anytime
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end">
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    4h Target
                  </span>
                </div>
              </button>

              {/* Option 2: No College / Weekend / Off Day (7h Target) */}
              <button
                type="button"
                onClick={() => setSelectedChoice('no_college')}
                className="w-full p-4 rounded-2xl border transition-all cursor-pointer text-left flex items-center justify-between gap-3 active:scale-[0.98] bg-white/[0.04] hover:bg-white/[0.08] text-white border-white/10 hover:border-cyan-500/40 group"
              >
                <div className="flex items-center space-x-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-white/10 text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black transition">
                    <Coffee className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight text-white">
                      No College / Off Day / Holiday
                    </p>
                    <p className="text-xs mt-0.5 text-zinc-400">
                      Full day available · deep focus
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end">
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    7h Target
                  </span>
                </div>
              </button>
            </div>

            {/* Footer Note */}
            <div className="relative z-10 flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-white/[0.08]">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Flexible study hours anytime today
              </span>
              <span className="flex items-center gap-1 text-zinc-400 font-mono text-[10px]">
                <Lock className="w-3 h-3 text-amber-400" />
                Locks once confirmed
              </span>
            </div>
          </>
        ) : (
          /* ─── STEP 2: Confirmation Screen ─── */
          <>
            {/* Top Confirmation Header */}
            <div className="relative z-10 flex flex-col items-center text-center space-y-2 mb-5">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-inner mb-0.5 text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Confirm Daily Commitment
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Please confirm your choice for today ({todayFormatted})
                </p>
              </div>
            </div>

            {/* Selected Commitment Card */}
            <div className="relative z-10 mb-4 p-4 rounded-2xl bg-white/[0.05] border border-white/15 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedChoice === 'college' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
                  }`}>
                    {selectedChoice === 'college' ? (
                      <GraduationCap className="w-5 h-5" />
                    ) : (
                      <Coffee className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">
                      {selectedChoice === 'college' ? 'Attended College / Classes' : 'No College / Off Day'}
                    </p>
                    <p className="text-xs text-zinc-400">
                      {selectedChoice === 'college' ? '4 Hours Flexible Target' : '7 Hours Deep Work Target'}
                    </p>
                  </div>
                </div>

                <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg ${
                  selectedChoice === 'college' 
                    ? 'bg-emerald-500 text-black' 
                    : 'bg-cyan-500 text-black'
                }`}>
                  {selectedChoice === 'college' ? '4h Goal' : '7h Goal'}
                </span>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Once confirmed, this goal is locked in for the entire day and cannot be changed until the next 2:00 AM reset.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedChoice(null)}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-white/10 active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Change</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-black text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Confirm & Lock</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

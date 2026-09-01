import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BrandLogo } from './BrandLogo.tsx';
import { 
  Target, 
  Clock, 
  Lock, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft, 
  Minus, 
  Plus
} from 'lucide-react';
import { format } from 'date-fns';

interface DailyRoutineModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTargetHours?: number | null;
  currentRoutine?: 'college' | 'no_college' | string | null;
  onSelectTargetHours: (hours: number) => void;
  onSelectRoutine?: (routine: 'college' | 'no_college') => void;
}

export function calculateTimeWindowTo2AM(): {
  now: Date;
  nowFormatted: string;
  next2AMFormatted: string;
  remainingMinutes: number;
  remainingHoursExact: number;
  minHours: number;
  maxHours: number;
} {
  const now = new Date();
  const next2AM = new Date(now);

  if (now.getHours() >= 2) {
    // Next 2 AM is tomorrow morning
    next2AM.setDate(next2AM.getDate() + 1);
  }
  next2AM.setHours(2, 0, 0, 0);

  const diffMs = Math.max(0, next2AM.getTime() - now.getTime());
  const remainingMinutes = Math.floor(diffMs / (60 * 1000));
  const remainingHoursExact = diffMs / (3600 * 1000);

  // Minimum required is 2 hours.
  // Maximum is calculated from login time to next 2 AM.
  // E.g. at 4 PM -> 10 hours until 2 AM -> max is 10 hours.
  // If user logs in with < 2 hours remaining, clamp max to minHours (2h).
  const minHours = 2;
  const maxHours = Math.max(minHours, Math.min(24, Math.floor(remainingHoursExact)));

  const nowFormatted = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  const next2AMFormatted = '2:00 AM';

  return {
    now,
    nowFormatted,
    next2AMFormatted,
    remainingMinutes,
    remainingHoursExact,
    minHours,
    maxHours
  };
}

export const DailyRoutineModal: React.FC<DailyRoutineModalProps> = ({
  isOpen,
  onClose,
  currentTargetHours,
  currentRoutine,
  onSelectTargetHours,
  onSelectRoutine
}) => {
  const timeWindow = useMemo(() => calculateTimeWindowTo2AM(), [isOpen]);
  const { minHours, maxHours, nowFormatted, remainingMinutes } = timeWindow;

  // Initialize selected hours within [minHours, maxHours]
  const [selectedHours, setSelectedHours] = useState<number>(() => {
    if (currentTargetHours && currentTargetHours >= minHours && currentTargetHours <= maxHours) {
      return currentTargetHours;
    }
    return Math.min(maxHours, Math.max(minHours, 4));
  });

  const [step, setStep] = useState<'select' | 'confirm'>('select');

  useEffect(() => {
    if (isOpen) {
      const initial = currentTargetHours && currentTargetHours >= minHours && currentTargetHours <= maxHours
        ? currentTargetHours
        : Math.min(maxHours, Math.max(minHours, 4));
      setSelectedHours(initial);
      setStep('select');
    }
  }, [isOpen, minHours, maxHours, currentTargetHours]);

  if (!isOpen) return null;

  const adjustedDate = new Date(Date.now() - 2 * 3600000);
  const todayFormatted = format(adjustedDate, 'EEEE, MMMM d');

  const handleStepHour = (delta: number) => {
    setSelectedHours(prev => Math.min(maxHours, Math.max(minHours, prev + delta)));
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSelectedHours(Math.min(maxHours, Math.max(minHours, val)));
  };

  const handleConfirm = () => {
    onSelectTargetHours(selectedHours);
    onClose();
  };

  // Smart preset options based on dynamic maxHours
  const presetOptions = [2, 4, 6, 8, maxHours]
    .filter((h, idx, self) => h >= minHours && h <= maxHours && self.indexOf(h) === idx)
    .sort((a, b) => a - b);

  // Focus intensity metadata
  const getIntensityInfo = (hours: number) => {
    if (hours <= 2) {
      return {
        label: 'Light Focus',
        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        desc: 'Quick study session · 24 intervals'
      };
    }
    if (hours <= 4) {
      return {
        label: 'Steady Pace',
        color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
        desc: 'Consistent focus · 48 intervals'
      };
    }
    if (hours <= 7) {
      return {
        label: 'Deep Focus Sprint',
        color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        desc: `Serious academic grind · ${hours * 12} intervals`
      };
    }
    return {
      label: 'Elite High-Performance',
      color: 'text-violet-400 bg-violet-500/10 border-violet-500/30',
      desc: `Maximum immersion · ${hours * 12} intervals`
    };
  };

  const intensity = getIntensityInfo(selectedHours);
  const remainingHoursDisplay = Math.floor(remainingMinutes / 60);
  const remainingMinsDisplay = remainingMinutes % 60;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 dark:bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200 select-none overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && currentTargetHours) onClose();
      }}
    >
      <div 
        className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-[0_25px_70px_rgba(0,0,0,0.9)] text-zinc-100 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {step === 'select' ? (
          /* ─── STEP 1: Interactive Target Selection ─── */
          <>
            {/* Top Header */}
            <div className="relative z-10 flex flex-col items-center text-center space-y-2 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner mb-0.5">
                <BrandLogo size="xs" className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    Daily Study Target
                  </h2>
                  <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    2 AM Reset
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {todayFormatted} · Set your goal for today
                </p>
              </div>
            </div>

            {/* Time Window Context Banner */}
            <div className="relative z-10 p-3 rounded-2xl bg-white/[0.04] border border-white/10 mb-5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-cyan-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-zinc-300">
                    Login at <span className="text-white font-mono">{nowFormatted}</span> ➔ Reset at <span className="text-white font-mono">2:00 AM</span>
                  </p>
                  <p className="text-[10px] text-zinc-400 font-mono">
                    {remainingHoursDisplay}h {remainingMinsDisplay}m remaining in this cycle
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Max: {maxHours}h
                </span>
              </div>
            </div>

            {/* Target Hours Interactive Counter */}
            <div className="relative z-10 p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Committed Hours
                </span>
                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${intensity.color}`}>
                  {intensity.label}
                </span>
              </div>

              {/* Big Stepper */}
              <div className="flex items-center justify-between gap-4 py-2">
                <button
                  type="button"
                  onClick={() => handleStepHour(-1)}
                  disabled={selectedHours <= minHours}
                  className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition active:scale-90 cursor-pointer border border-white/10 shadow-sm"
                  aria-label="Decrease target hours"
                >
                  <Minus className="w-5 h-5" />
                </button>

                <div className="text-center flex flex-col items-center">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight">
                      {selectedHours}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-zinc-400 font-mono">
                      hrs
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-medium mt-0.5">
                    {selectedHours * 12} verified 5-minute blocks
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleStepHour(1)}
                  disabled={selectedHours >= maxHours}
                  className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:pointer-events-none text-white flex items-center justify-center transition active:scale-90 cursor-pointer border border-white/10 shadow-sm"
                  aria-label="Increase target hours"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Slider */}
              <div className="space-y-1.5 pt-1">
                <input
                  type="range"
                  min={minHours}
                  max={maxHours}
                  step={1}
                  value={selectedHours}
                  onChange={handleSliderChange}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono font-bold">
                  <span>Min: {minHours}h</span>
                  <span>Target: {selectedHours}h</span>
                  <span>Max: {maxHours}h</span>
                </div>
              </div>

              {/* Preset Chips */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 border-t border-white/[0.06]">
                {presetOptions.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedHours(h)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition cursor-pointer active:scale-95 border ${
                      selectedHours === h
                        ? 'bg-white text-black border-white shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-zinc-300 border-white/10'
                    }`}
                  >
                    {h === maxHours ? `Max (${h}h)` : `${h}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 pt-1">
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="w-full py-3.5 px-5 rounded-2xl bg-white hover:bg-zinc-200 text-black font-extrabold text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
              >
                <span>Proceed with {selectedHours}h Goal</span>
                <Target className="w-4 h-4 text-emerald-600" />
              </button>
            </div>

            {/* Footer Notice */}
            <div className="relative z-10 flex items-center justify-between text-[11px] text-zinc-500 pt-3 mt-3 border-t border-white/[0.08]">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                Flexible study anytime before 2:00 AM
              </span>
              <span className="flex items-center gap-1 text-zinc-400 font-mono text-[10px]">
                <Lock className="w-3 h-3 text-amber-400" />
                Locks once set
              </span>
            </div>
          </>
        ) : (
          /* ─── STEP 2: Confirmation & Lock ─── */
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
                  Locking in your focus target for {todayFormatted}
                </p>
              </div>
            </div>

            {/* Selected Commitment Summary Card */}
            <div className="relative z-10 mb-4 p-4 rounded-2xl bg-white/[0.05] border border-white/15 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">
                      {selectedHours} Hours Focus Target
                    </p>
                    <p className="text-xs text-zinc-400">
                      {selectedHours * 12} verified intervals before 2:00 AM
                    </p>
                  </div>
                </div>

                <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-emerald-500 text-black">
                  {selectedHours}h Goal
                </span>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-start gap-2">
                <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Once locked, this target is set for the day and cannot be modified until the 2:00 AM cycle reset.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="relative z-10 grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 border border-white/10 active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Adjust</span>
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

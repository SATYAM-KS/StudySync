import React from 'react';
import { useStudy } from '../context/StudyContext.tsx';
import { Clock, CheckCircle2, Coffee, ShieldCheck, Monitor, Sparkles } from 'lucide-react';

export const CheckInModal: React.FC = () => {
  const { 
    showCheckInPrompt, 
    checkInCountdown, 
    respondToCheckIn, 
    activeCampaignName, 
    subjectNote,
    latestSnapshotUrl,
    isScreenSharingEnabled
  } = useStudy();

  if (!showCheckInPrompt) return null;

  const percentage = (checkInCountdown / 60) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl text-zinc-900 dark:text-zinc-100 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-bold shadow-sm">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight text-zinc-950 dark:text-white">
                  5-Min Focus Checkpoint
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                  +5 Mins
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {activeCampaignName} · {subjectNote}
              </p>
            </div>
          </div>
        </div>

        {/* Screen Snapshot Preview if Screen Focus Mode is Enabled */}
        {latestSnapshotUrl && isScreenSharingEnabled ? (
          <div className="mb-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                Screen Focus Check Verified
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">5-min block frame</span>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 aspect-video bg-black shadow-inner">
              <img 
                src={latestSnapshotUrl} 
                alt="5-min focus snapshot" 
                className="w-full h-full object-cover"
              />
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-bold backdrop-blur flex items-center gap-1 border border-white/20">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Verified Active Study</span>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Countdown Box */
          <div className="my-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center relative">
            <p className="text-sm font-bold text-zinc-900 dark:text-white mb-2">
              Are you still actively studying?
            </p>
            
            <div className="flex items-center justify-center space-x-3">
              <div className="font-mono text-3xl font-black text-zinc-950 dark:text-white">
                00:{checkInCountdown.toString().padStart(2, '0')}
              </div>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">auto-verifying focus</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-black dark:bg-white transition-all duration-1000"
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Explanation */}
        <div className="flex items-start space-x-2 text-[11px] text-zinc-500 dark:text-zinc-400 mb-5 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <ShieldCheck className="w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0 mt-0.5" />
          <p>
            Confirming adds <strong>+5 minutes</strong> to your total daily study hours and leaderboard score.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={() => respondToCheckIn(true)}
            className="flex-1 py-3 px-4 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs sm:text-sm shadow-md flex items-center justify-center space-x-2 transition transform active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Confirm & Add +5 Mins</span>
          </button>

          <button
            onClick={() => respondToCheckIn(false)}
            className="py-3 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs sm:text-sm border border-zinc-300 dark:border-zinc-700 flex items-center justify-center space-x-2 transition cursor-pointer"
          >
            <Coffee className="w-4 h-4" />
            <span>Take Break</span>
          </button>
        </div>

      </div>
    </div>
  );
};

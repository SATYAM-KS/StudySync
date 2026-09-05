import React, { useState, useEffect, useRef } from 'react';
import { Campaign, LiveStudySession } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useStudy } from '../context/StudyContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { BrandLogo } from './BrandLogo.tsx';
import { checkScheduleStatus, formatTimeTo12h } from '../utils/schedule.ts';
import { 
  Play, 
  Square, 
  Clock, 
  Monitor, 
  Flame, 
  BookOpen, 
  AlertCircle, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Camera,
  ArrowUpRight,
  Zap,
  Target
} from 'lucide-react';

interface FocusLoungeProps {
  campaign: Campaign;
}

export const FocusLounge: React.FC<FocusLoungeProps> = ({ campaign }) => {
  const { user } = useAuth();
  const {
    isStudying,
    activeCampaignId,
    subjectNote: currentSubject,
    sessionElapsedSeconds,
    blockRemainingSeconds,
    hiddenWarning,
    screenStream,
    isScreenSharingEnabled,
    verifiedSnapshots,
    isAnalyzing,
    lastAIAnalysis,
    screenShareError,
    stats,
    collegeRoutine,
    todayTargetHours,
    dailyTargetHours,
    setShowRoutineModal,
    startStudying,
    stopStudying,
    reattachScreenShare,
    triggerAIAnalysisNow
  } = useStudy();

  const { activeStudySessions } = useSocket();
  const [subjectInput, setSubjectInput] = useState('');
  const [topicError, setTopicError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const isCurrentCampaignStudying = isStudying && activeCampaignId === campaign.id;

  // Screen preview stream attachment
  useEffect(() => {
    if (videoRef.current && screenStream) {
      videoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Format seconds -> MM:SS
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  // Filter study sessions for this campaign
  const campaignActiveSessions = activeStudySessions.filter(s => s.campaignId === campaign.id);

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100 select-none pb-8">
      
      {/* ═══ Main Focus Control Grid ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Interactive Study Timer & Controls */}
        <div className="lg:col-span-2 posh-card rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm relative overflow-hidden">
          
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-950 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-xs shrink-0">
                <BrandLogo size="xs" className="w-5 h-5 text-white dark:text-black" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-zinc-950 dark:text-white tracking-tight">Focus Studio</h3>
                <p className="text-xs text-zinc-400">Deep work focus workspace</p>
              </div>
            </div>

            {isCurrentCampaignStudying && (
              <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold backdrop-blur-md shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Focus Active</span>
              </span>
            )}
          </div>

          {/* Screen Share Re-attach Banner */}
          {isCurrentCampaignStudying && !screenStream && (
            <div className="p-3.5 rounded-2xl bg-zinc-900/95 text-white dark:bg-zinc-800/95 backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md border border-zinc-700 animate-in fade-in duration-200">
              <div className="flex items-center space-x-2.5">
                <Monitor className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold">
                  Session Resumed ({formatTime(sessionElapsedSeconds)} elapsed) — Re-attach screen share.
                </span>
              </div>
              <button
                type="button"
                onClick={reattachScreenShare}
                className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-100 font-bold text-xs transition shrink-0 cursor-pointer shadow-sm active:scale-95"
              >
                Share Screen
              </button>
            </div>
          )}

          {/* Screen Share Error Alert */}
          {screenShareError && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2.5 backdrop-blur-md">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <span className="font-bold">Entire Screen Required:</span> {screenShareError}
              </div>
            </div>
          )}

          {/* AI Analysis Live Feedback Banner */}
          {isCurrentCampaignStudying && lastAIAnalysis && (
            <div className={`p-3.5 rounded-2xl border text-xs flex items-start space-x-3 transition-all backdrop-blur-md ${
              lastAIAnalysis.status === 'analyzing'
                ? 'bg-zinc-100/70 dark:bg-zinc-800/40 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200'
                : lastAIAnalysis.status === 'verified'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
            }`}>
              {lastAIAnalysis.status === 'analyzing' && (
                <Loader2 className="w-4 h-4 text-zinc-500 animate-spin shrink-0 mt-0.5" />
              )}
              {lastAIAnalysis.status === 'verified' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              )}
              {lastAIAnalysis.status === 'off_task' && (
                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {lastAIAnalysis.status === 'analyzing'
                      ? 'Inspecting screen snapshot...'
                      : lastAIAnalysis.status === 'verified'
                      ? `Verified: ${lastAIAnalysis.summary}`
                      : `Off-Task Detected: ${lastAIAnalysis.summary}`}
                  </span>
                  <span className="text-[10px] opacity-75 font-mono">{lastAIAnalysis.timestamp}</span>
                </div>
                <p className="text-[11px] opacity-90 mt-1 leading-relaxed break-words">{lastAIAnalysis.reason}</p>
              </div>
            </div>
          )}

          {/* Central Timer Display */}
          <div className="flex flex-col items-center justify-center py-4 relative">
            
            {/* Ambient Timer Glow Orb */}
            {isCurrentCampaignStudying && (
              <div className="absolute w-56 h-56 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
            )}

            <div className="relative w-60 h-60 rounded-full posh-card flex flex-col items-center justify-center shadow-xl">
              
              {/* Outer Glow Ring when studying */}
              {isCurrentCampaignStudying && (
                <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-500 animate-spin" style={{ animationDuration: '3.5s' }} />
              )}

              <p className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-widest mb-1">
                {isCurrentCampaignStudying ? 'Elapsed Study' : 'Ready to Focus'}
              </p>
              
              <div className="font-mono text-4xl sm:text-5xl font-black text-zinc-950 dark:text-white tracking-tight">
                {isCurrentCampaignStudying ? formatTime(sessionElapsedSeconds) : '00:00'}
              </div>

              {isCurrentCampaignStudying ? (
                <div className="mt-2.5 text-center px-4">
                  <div className="flex items-center justify-center space-x-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                    <span>Random AI Guard Active</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 truncate max-w-[150px] mt-0.5 font-medium">
                    {currentSubject}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5 font-medium">
                  Random AI Screen Verification
                </p>
              )}
            </div>

            {/* Time Studied in Minutes out of Total Minutes */}
            {(() => {
              const targetHours = todayTargetHours || 4;
              const todayTargetMins = Math.round(targetHours * 60);
              const todayCompletedMins = stats?.todayMinutes || 0;
              const progressPct = Math.min(100, Math.round((todayCompletedMins / (todayTargetMins || 1)) * 100));

              return (
                <div className="mt-6 flex flex-col items-center space-y-2 w-full max-w-sm">
                  <div className="flex items-center justify-between w-full text-xs">
                    <span className="text-zinc-400 dark:text-zinc-500 text-[11px] font-semibold uppercase tracking-wider">Today's Progress</span>
                    <span className="font-extrabold text-zinc-950 dark:text-white font-mono text-xs">
                      {todayCompletedMins}m / {todayTargetMins}m ({progressPct}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="h-full bg-zinc-950 dark:bg-white rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${Math.max(todayCompletedMins > 0 ? 4 : 0, progressPct)}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                    {progressPct >= 100 ? '🎉 Daily target completed!' : `${Math.max(0, todayTargetMins - todayCompletedMins)} mins left to reach target`}
                  </p>
                </div>
              );
            })()}

          </div>

          {/* Topic Input Box */}
          {!isCurrentCampaignStudying ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                What are you focusing on this sitting?
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={subjectInput}
                  onChange={(e) => {
                    setSubjectInput(e.target.value);
                    if (topicError) setTopicError(false);
                  }}
                  placeholder="e.g. LeetCode Dynamic Programming, System Design, Physics..."
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-950 dark:text-white placeholder-zinc-400 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition shadow-xs"
                />
                <BookOpen className="w-4 h-4 text-zinc-400 absolute right-3.5 top-3.5" />
              </div>
              {topicError && (
                <p className="text-xs text-rose-500 font-medium">
                  Please enter your study topic before starting.
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl posh-card flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-medium">Current Topic</span>
              <span className="font-bold text-zinc-950 dark:text-white truncate max-w-[260px] font-mono">{currentSubject}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            {!isCurrentCampaignStudying ? (
              <button
                type="button"
                onClick={() => {
                  if (!subjectInput.trim()) {
                    setTopicError(true);
                    return;
                  }
                  setTopicError(false);
                  startStudying(campaign.id, campaign.name, subjectInput.trim());
                }}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-black font-extrabold text-xs shadow-md flex items-center justify-center space-x-2 transition transform active:scale-98 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Focus Session</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopStudying}
                className="flex-1 py-3.5 px-6 rounded-2xl glass-pill hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 text-zinc-900 dark:text-white font-bold text-xs flex items-center justify-center space-x-2 transition cursor-pointer active:scale-98 border border-zinc-300 dark:border-zinc-700"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>End Focus Session</span>
              </button>
            )}
          </div>

        </div>

        {/* Right Col: Screen AI Monitor & Live Peer Presence */}
        <div className="space-y-6">
          
          {/* Screen Monitor */}
          <div className="posh-card rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Monitor className="w-4 h-4 text-zinc-900 dark:text-white" />
                <h4 className="font-bold text-sm text-zinc-950 dark:text-white">Screen Verification</h4>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full glass-pill text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Random AI Guard</span>
              </span>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Unscheduled randomized AI screen inspections ensure continuous, genuine focus throughout your session.
            </p>

            {isScreenSharingEnabled ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-zinc-200/80 dark:border-white/[0.08] bg-black aspect-video shadow-md">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-md bg-black/80 text-white text-[10px] font-semibold flex items-center space-x-1.5 backdrop-blur-md border border-white/10">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Live</span>
                  </div>

                  <div className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-md bg-black/80 text-emerald-400 text-[10px] font-medium flex items-center space-x-1 backdrop-blur-md border border-white/10">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>AI Guarding</span>
                  </div>
                </div>

                {/* Verified Snapshot Timeline */}
                {verifiedSnapshots && verifiedSnapshots.length > 0 && (
                  <div className="pt-2 space-y-2 border-t border-zinc-200/60 dark:border-white/[0.06]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-950 dark:text-white">
                        Inspections
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        +{verifiedSnapshots.filter(s => s.isProductive).reduce((acc, s) => acc + (s.durationMinutes || 2), 0)}m earned
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {verifiedSnapshots.map((snap) => (
                        <div 
                          key={snap.id} 
                          className={`p-2 rounded-xl border flex items-center gap-2.5 text-xs transition backdrop-blur-md ${
                            snap.isProductive 
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200' 
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                          }`}
                        >
                          <div className="w-12 h-9 rounded-lg overflow-hidden bg-black shrink-0 relative border border-zinc-200/60 dark:border-white/10">
                            <img src={snap.imageUrl} alt="Screen frame" className="w-full h-full object-cover" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold truncate text-zinc-900 dark:text-white text-[11px]">
                                {snap.activitySummary}
                              </span>
                              <span className="text-[10px] font-mono font-bold">
                                {snap.isProductive ? `+${snap.durationMinutes || 2}m` : '0m'}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed break-words" title={snap.reason}>
                              {snap.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-2xl posh-card text-center space-y-1.5">
                <ShieldCheck className="w-7 h-7 text-zinc-400 mx-auto mb-1" />
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Ready for Inspection
                </p>
                <p className="text-[11px] text-zinc-400">
                  Start session to activate AI screen verification.
                </p>
              </div>
            )}
          </div>

          {/* Currently Studying Peers in this Campaign */}
          <div className="posh-card rounded-3xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <h4 className="font-bold text-sm text-zinc-950 dark:text-white">Active Peers</h4>
              </div>
              <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white glass-pill px-2.5 py-0.5 rounded-full">
                {campaignActiveSessions.length} live
              </span>
            </div>

            {campaignActiveSessions.length === 0 ? (
              <div className="text-center py-6 posh-card rounded-2xl p-4">
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">No members currently in a focus block.</p>
                <p className="text-[11px] text-zinc-400 mt-1">Start a session to lead the cohort!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {campaignActiveSessions.map((session) => (
                  <div 
                    key={session.userId} 
                    className="flex items-center space-x-3 p-2.5 rounded-2xl bg-white/70 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-white/[0.08] shadow-xs"
                  >
                    <div className="relative">
                      <UserAvatar
                        name={session.userName}
                        avatarUrl={session.userAvatarUrl}
                        size="xs"
                        rounded="lg"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-zinc-900"></span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">{session.userName}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{session.subjectNote}</p>
                    </div>

                    <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Live
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

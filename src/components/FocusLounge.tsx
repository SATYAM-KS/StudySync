import React, { useState, useEffect, useRef } from 'react';
import { Campaign, LiveStudySession } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useStudy } from '../context/StudyContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
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
  Camera
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

  // Check if inside daily schedule windows
  const now = new Date();
  const current12h = formatTimeTo12h(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
  const scheduleStatus = checkScheduleStatus(campaign.schedule, campaign.dailyStartTime, campaign.dailyEndTime);
  const isInsideWindow = scheduleStatus.isInside;

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100">
      
      {/* Daily Window Alert Banner */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors ${
        isInsideWindow 
          ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
      }`}>
        <div className="flex items-center space-x-3">
          <div className={`w-2.5 h-2.5 rounded-full ${isInsideWindow ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-950 dark:text-white">
                {isInsideWindow ? 'Cohort Focus Window (Active Now)' : 'Flexible Study (Active Anytime)'}
              </p>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium">
                {isInsideWindow ? 'Preferred group time' : 'Study anytime today'}
              </span>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Today's Goal: <strong className="text-zinc-950 dark:text-white font-bold">{scheduleStatus.todayHours}h</strong> (Any session logged today counts towards your goal · Preferred windows: <span className="font-semibold text-zinc-900 dark:text-zinc-200">{scheduleStatus.todaySlotsText}</span>)
            </p>
          </div>
        </div>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-mono font-semibold text-zinc-700 dark:text-zinc-300">
          Time: {current12h}
        </span>
      </div>

      {/* Main Focus Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Interactive Study Timer & Controls */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-zinc-900 dark:text-white" />
              <h3 className="font-bold text-lg text-zinc-950 dark:text-white">AI Focus Studio</h3>
            </div>

            {isCurrentCampaignStudying && (
              <span className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>AI Screen Verification Active</span>
              </span>
            )}
          </div>

          {/* Screen Share Re-attach Banner (if restored after page refresh) */}
          {isCurrentCampaignStudying && !screenStream && (
            <div className="p-3.5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md border border-zinc-700">
              <div className="flex items-center space-x-2.5">
                <Monitor className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold">
                  Session Resumed ({formatTime(sessionElapsedSeconds)} elapsed) — Re-attach screen share for AI verification.
                </span>
              </div>
              <button
                type="button"
                onClick={reattachScreenShare}
                className="px-3.5 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-100 font-extrabold text-xs transition shrink-0 cursor-pointer shadow-sm"
              >
                Share Screen
              </button>
            </div>
          )}

          {/* Screen Share Error Alert */}
          {screenShareError && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
              <div>
                <span className="font-bold">Entire Screen Required:</span> {screenShareError}
              </div>
            </div>
          )}

          {/* AI Analysis Live Feedback Banner */}
          {isCurrentCampaignStudying && lastAIAnalysis && (
            <div className={`p-3.5 rounded-2xl border text-xs flex items-start space-x-3 transition-all ${
              lastAIAnalysis.status === 'analyzing'
                ? 'bg-zinc-100 dark:bg-zinc-800/60 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200'
                : lastAIAnalysis.status === 'verified'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
            }`}>
              {lastAIAnalysis.status === 'analyzing' && (
                <Loader2 className="w-4 h-4 text-zinc-600 dark:text-zinc-400 animate-spin shrink-0 mt-0.5" />
              )}
              {lastAIAnalysis.status === 'verified' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              )}
              {lastAIAnalysis.status === 'off_task' && (
                <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {lastAIAnalysis.status === 'analyzing'
                      ? 'AI Proctor Inspecting Screen...'
                      : lastAIAnalysis.status === 'verified'
                      ? `AI Verified Work (+5m Registered): ${lastAIAnalysis.summary}`
                      : `Off-Task / Timepass Detected (0m Logged): ${lastAIAnalysis.summary}`}
                  </span>
                  <span className="text-[10px] opacity-75 font-mono">{lastAIAnalysis.timestamp}</span>
                </div>
                <p className="text-[11px] opacity-90 mt-0.5">{lastAIAnalysis.reason}</p>
              </div>
            </div>
          )}

          {/* Central Timer Display */}
          <div className="flex flex-col items-center justify-center py-6">
            <div className="relative w-56 h-56 rounded-full border-4 border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 shadow-inner">
              
              {/* Outer Ring when studying */}
              {isCurrentCampaignStudying && (
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-500 dark:border-t-emerald-400 animate-spin" style={{ animationDuration: '4s' }}></div>
              )}

              <p className="text-xs uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider mb-1">
                {isCurrentCampaignStudying ? 'Session Elapsed' : 'Ready to Focus'}
              </p>
              
              <div className="font-mono text-4xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
                {isCurrentCampaignStudying ? formatTime(sessionElapsedSeconds) : '00:00'}
              </div>

              {isCurrentCampaignStudying ? (
                <div className="mt-2 text-center px-4">
                  <p className="text-[11px] text-zinc-800 dark:text-zinc-200 font-medium">
                    AI check in {formatTime(blockRemainingSeconds)}
                  </p>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-[140px]">
                    {currentSubject}
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 flex items-center gap-1">
                  <Camera className="w-3 h-3" />
                  <span>5-min AI verified blocks</span>
                </p>
              )}
            </div>

            {/* Time Studied in Minutes out of Total Minutes */}
            {(() => {
              const todayTargetHours = scheduleStatus.todayHours > 0 ? scheduleStatus.todayHours : (campaign.targetDailyHours || 4);
              const todayTargetMins = Math.round(todayTargetHours * 60);
              const todayCompletedMins = stats?.todayMinutes || 0;
              const progressPct = Math.min(100, Math.round((todayCompletedMins / (todayTargetMins || 1)) * 100));
              const remainingMins = Math.max(0, todayTargetMins - todayCompletedMins);

              return (
                <div className="mt-5 flex flex-col items-center space-y-2 w-full max-w-xs">
                  <div className="flex items-center justify-between w-full text-xs">
                    <span className="text-zinc-500 dark:text-zinc-400 font-medium">Daily Goal Progress</span>
                    <span className="font-bold text-zinc-950 dark:text-white font-mono">
                      {todayCompletedMins}m <span className="text-zinc-400 font-normal">/</span> {todayTargetMins}m
                      <span className="ml-1 text-[11px] font-semibold text-zinc-500">({progressPct}%)</span>
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden p-0.5">
                    <div 
                      className="h-full bg-black dark:bg-white rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(todayCompletedMins > 0 ? 5 : 0, progressPct)}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    {todayCompletedMins >= todayTargetMins
                      ? 'Daily focus goal completed'
                      : `${remainingMins}m remaining today`}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Subject Goal Input (User must write their specific study topic) */}
          {!isCurrentCampaignStudying ? (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-800 dark:text-zinc-200">
                What topic are you studying in this session? <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={subjectInput}
                onChange={(e) => {
                  setSubjectInput(e.target.value);
                  if (topicError && e.target.value.trim()) {
                    setTopicError(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (!subjectInput.trim()) {
                      setTopicError(true);
                    } else {
                      setTopicError(false);
                      startStudying(campaign.id, campaign.name, subjectInput.trim());
                    }
                  }
                }}
                placeholder="Type the exact study topic (e.g. Solving LeetCode DP problems, Physics Chapter 4 notes...)"
                className={`w-full bg-zinc-50 dark:bg-zinc-950 border ${
                  topicError ? 'border-rose-500 focus:border-rose-500' : 'border-zinc-300 dark:border-zinc-700 focus:border-zinc-900 dark:focus:border-white'
                } rounded-xl px-4 py-3 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none transition shadow-sm`}
              />
              {topicError && (
                <p className="text-xs text-rose-500 font-medium">
                  Please enter the topic or subject you are studying before starting the focus session.
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between text-xs">
              <span className="text-zinc-500 dark:text-zinc-400">Current Topic:</span>
              <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-[280px]">{currentSubject}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {!isCurrentCampaignStudying ? (
              <button
                onClick={() => {
                  if (!subjectInput.trim()) {
                    setTopicError(true);
                    return;
                  }
                  setTopicError(false);
                  startStudying(campaign.id, campaign.name, subjectInput.trim());
                }}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-extrabold text-sm shadow-md flex items-center justify-center space-x-2 transition transform active:scale-98 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start AI-Verified Focus (Share Screen)</span>
              </button>
            ) : (
              <button
                onClick={stopStudying}
                className="flex-1 py-3.5 px-6 rounded-2xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold text-sm border border-zinc-300 dark:border-zinc-700 flex items-center justify-center space-x-2 transition cursor-pointer shadow-sm"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>End Study Session</span>
              </button>
            )}
          </div>

        </div>

        {/* Right Col: Screen AI Monitor & Live Peer Presence */}
        <div className="space-y-6">
          
          {/* Screen AI Monitor */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Monitor className="w-4 h-4 text-zinc-900 dark:text-white" />
                <h4 className="font-bold text-sm text-zinc-950 dark:text-white">Screen AI Proctor</h4>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                <span>AI Automated</span>
              </span>
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Every 5 minutes, our Gemini AI inspects a snapshot of your screen. If productive study/work is detected, +5 minutes are automatically added to your total.
            </p>

            {isScreenSharingEnabled ? (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-black aspect-video shadow-md">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-black/80 text-white text-[10px] font-bold flex items-center space-x-1.5 backdrop-blur border border-white/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Live Proctor Active</span>
                  </div>

                  <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/80 text-white text-[10px] font-mono font-bold backdrop-blur border border-white/20">
                    Next AI Check: {formatTime(blockRemainingSeconds)}
                  </div>
                </div>

                {/* Verified 5-min Snapshot Timeline with AI Categorization */}
                {verifiedSnapshots && verifiedSnapshots.length > 0 && (
                  <div className="pt-2 space-y-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-zinc-950 dark:text-white">
                        AI Verification Timeline
                      </span>
                      <span className="text-[10px] text-zinc-500 font-semibold">
                        +{verifiedSnapshots.filter(s => s.isProductive).length * 5}m earned
                      </span>
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {verifiedSnapshots.map((snap) => (
                        <div 
                          key={snap.id} 
                          className={`p-2 rounded-xl border flex items-center gap-2.5 text-xs transition ${
                            snap.isProductive 
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50' 
                              : 'bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50'
                          }`}
                        >
                          <div className="w-14 h-10 rounded-lg overflow-hidden bg-black shrink-0 relative border border-zinc-200 dark:border-zinc-800">
                            <img src={snap.imageUrl} alt="Screen frame" className="w-full h-full object-cover" />
                            <div className="absolute bottom-0 right-0 px-1 text-[8px] font-bold bg-black/80 text-white font-mono">
                              {snap.timestamp}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-bold truncate text-zinc-900 dark:text-white text-[11px]">
                                {snap.activitySummary}
                              </span>
                              <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded ${
                                snap.isProductive 
                                  ? 'bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200' 
                                  : 'bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200'
                              }`}>
                                {snap.isProductive ? '+5m' : '0m'}
                              </span>
                            </div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
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
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                  Automated Honest Verification
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Start your focus session to begin live AI screen accountability.
                </p>
              </div>
            )}
          </div>

          {/* Currently Studying Peers in this Campaign */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-zinc-900 dark:text-white" />
                <h4 className="font-bold text-sm text-zinc-950 dark:text-white">Live Studying Now</h4>
              </div>
              <span className="text-xs font-bold text-zinc-900 dark:text-white">
                {campaignActiveSessions.length} active
              </span>
            </div>

            {campaignActiveSessions.length === 0 ? (
              <div className="text-center py-6 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
                <Clock className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400">No members currently in a study block.</p>
                <p className="text-[11px] text-zinc-500 mt-1">Be the first to start studying!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {campaignActiveSessions.map((session) => (
                  <div 
                    key={session.userId} 
                    className="flex items-center space-x-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  >
                    <div className="relative">
                      <UserAvatar
                        name={session.userName}
                        avatarUrl={session.userAvatarUrl}
                        size="sm"
                        rounded="lg"
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-black dark:bg-white border-2 border-white dark:border-zinc-900"></span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-zinc-950 dark:text-white truncate">{session.userName}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{session.subjectNote}</p>
                    </div>

                    <span className="text-[10px] font-mono font-bold text-zinc-900 dark:text-white bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-700">
                      Studying
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

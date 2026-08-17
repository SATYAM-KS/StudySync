import React, { useState, useEffect, useMemo } from 'react';
import { StudyBlock } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { useStudy } from '../context/StudyContext.tsx';
import { 
  History, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  Flame, 
  Target, 
  Sparkles, 
  Eye, 
  X,
  Layers,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Award,
  Zap,
  ArrowUpRight
} from 'lucide-react';

interface StudyHistoryProps {
  campaignId: string;
  campaignName: string;
  targetDailyHours: number;
  campaignCreatedAt?: string;
}

type Timeframe = 'today' | 'week' | 'month';

interface HistoryResponse {
  blocks: StudyBlock[];
  todayMinutes: number;
  thisWeekMinutes: number;
  thisMonthMinutes: number;
  totalMinutes: number;
}

export interface FocusSittingSession {
  id: string;
  startTime: string;
  endTime: string;
  startTimeFormatted: string;
  endTimeFormatted: string;
  dateLabel: string;
  timeWindowLabel: string;
  totalMinutes: number;
  totalHours: number;
  formattedDuration: string;
  subjectNote: string;
  campaignName?: string;
  blocks: StudyBlock[];
  passedCount: number;
  flaggedCount: number;
  allPassed: boolean;
}

export const StudyHistory: React.FC<StudyHistoryProps> = ({
  campaignId,
  campaignName,
  targetDailyHours,
  campaignCreatedAt
}) => {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const { collegeRoutine, todayTargetHours, setShowRoutineModal } = useStudy();
  const cacheKey = `study_history_cache_${campaignId}_${user?.id || 'anon'}`;

  const [timeframe, setTimeframe] = useState<Timeframe>('today');
  const [historyData, setHistoryData] = useState<HistoryResponse>(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        const actual = parsed?.data && Array.isArray(parsed.data.blocks) ? parsed.data : (Array.isArray(parsed?.blocks) ? parsed : null);
        if (actual) return actual;
      }
    } catch {}
    return {
      blocks: [],
      todayMinutes: 0,
      thisWeekMinutes: 0,
      thisMonthMinutes: 0,
      totalMinutes: 0
    };
  });

  const [isLoading, setIsLoading] = useState(() => {
    try {
      return !localStorage.getItem(cacheKey);
    } catch {
      return true;
    }
  });

  const [selectedSnapshotUrl, setSelectedSnapshotUrl] = useState<string | null>(null);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(new Set());
  const [activeHoverDayIdx, setActiveHoverDayIdx] = useState<number | null>(null);

  const toggleSessionExpand = (sessionId: string) => {
    setExpandedSessionIds(prev => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const expandAllSessions = () => {
    const allIds = new Set(groupedSessions.map(s => s.id));
    setExpandedSessionIds(allIds);
  };

  const collapseAllSessions = () => {
    setExpandedSessionIds(new Set());
  };

  const getTodayDateKey = () => {
    const adjusted = new Date(Date.now() - 2 * 3600 * 1000);
    return `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, '0')}-${String(adjusted.getDate()).padStart(2, '0')}`;
  };

  const fetchHistory = async () => {
    if (!token) return;
    try {
      const tzOffset = new Date().getTimezoneOffset();
      const res = await fetch(`/api/study/history?campaignId=${campaignId}&tzOffset=${tzOffset}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'x-timezone-offset': String(tzOffset)
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.blocks)) {
          setHistoryData(data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ data, dateKey: getTodayDateKey() }));
          } catch {}
        }
      }
    } catch (e) {
      console.error('Failed to load study history:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Optimistic 0ms instant block ingestion
  const ingestNewBlock = (newBlock: StudyBlock) => {
    if (!newBlock) return;
    if (newBlock.campaignId && newBlock.campaignId !== campaignId) return;
    if (newBlock.userId && user && newBlock.userId !== user.id) return;

    setHistoryData(prev => {
      const safePrevBlocks = Array.isArray(prev?.blocks) ? prev.blocks : [];
      if (safePrevBlocks.some(b => b.id === newBlock.id)) {
        return prev;
      }

      const updatedBlocks = [newBlock, ...safePrevBlocks];
      const isPassed = newBlock.status === 'active';
      const duration = isPassed ? (newBlock.durationMinutes || 5) : 0;

      const updatedData: HistoryResponse = {
        blocks: updatedBlocks,
        todayMinutes: (prev?.todayMinutes || 0) + duration,
        thisWeekMinutes: (prev?.thisWeekMinutes || 0) + duration,
        thisMonthMinutes: (prev?.thisMonthMinutes || 0) + duration,
        totalMinutes: (prev?.totalMinutes || 0) + duration
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: updatedData, dateKey: getTodayDateKey() }));
      } catch {}

      return updatedData;
    });

    setTimeout(() => {
      fetchHistory();
    }, 400);
  };

  useEffect(() => {
    fetchHistory();

    const handleDayReset = () => {
      fetchHistory();
    };
    window.addEventListener('study:day_reset', handleDayReset);

    const interval = setInterval(fetchHistory, 60000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('study:day_reset', handleDayReset);
    };
  }, [campaignId, token]);

  // Real-time local events
  useEffect(() => {
    const handleLocalEvent = (e: any) => {
      const block = e?.detail?.block;
      if (block) {
        ingestNewBlock(block);
      } else {
        fetchHistory();
      }
    };

    window.addEventListener('study:block_logged', handleLocalEvent);
    return () => {
      window.removeEventListener('study:block_logged', handleLocalEvent);
    };
  }, [campaignId, user]);

  // Real-time socket events
  useEffect(() => {
    if (!socket) return;
    const handleBlockLogged = (data: any) => {
      if (data?.block) {
        ingestNewBlock(data.block);
      } else {
        fetchHistory();
      }
    };

    socket.on('study:block_logged', handleBlockLogged);
    return () => {
      socket.off('study:block_logged', handleBlockLogged);
    };
  }, [socket, campaignId, user]);

  const getDaysInCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  };

  const getTimeframeTargetHours = (tf: Timeframe) => {
    const baseDaily = todayTargetHours || targetDailyHours || 4;
    if (tf === 'today') return baseDaily;
    if (tf === 'week') return 34; // 5 days @ 4h + 2 days @ 7h
    return baseDaily * getDaysInCurrentMonth();
  };

  // Helper to format 12-hour time
  const formatTime12h = (timestampStr: string) => {
    try {
      const date = new Date(timestampStr);
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return 'Just now';
    }
  };

  // Helper to format date label relative to 2:00 AM Study Day Boundary
  const formatDateLabel = (timestampStr: string) => {
    try {
      const blockTime = new Date(timestampStr).getTime();
      const adjustedBlock = new Date(blockTime - 2 * 3600000);
      const adjustedNow = new Date(Date.now() - 2 * 3600000);

      const blockDateKey = `${adjustedBlock.getFullYear()}-${adjustedBlock.getMonth()}-${adjustedBlock.getDate()}`;
      const nowDateKey = `${adjustedNow.getFullYear()}-${adjustedNow.getMonth()}-${adjustedNow.getDate()}`;

      if (blockDateKey === nowDateKey) return 'Today';

      const yesterday = new Date(adjustedNow.getTime() - 86400000);
      const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
      if (blockDateKey === yesterdayKey) return 'Yesterday';

      return adjustedBlock.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return 'Today';
    }
  };

  // Helper for 2 AM aligned date key (YYYY-MM-DD)
  const get2AMDateKey = (timestamp: string | number | Date = new Date()) => {
    const d = new Date(timestamp);
    const adjusted = new Date(d.getTime() - 2 * 3600000);
    return `${adjusted.getFullYear()}-${String(adjusted.getMonth() + 1).padStart(2, '0')}-${String(adjusted.getDate()).padStart(2, '0')}`;
  };

  // Filter blocks by selected timeframe (aligned to 2:00 AM boundary)
  const filteredBlocks = useMemo(() => {
    const todayKey = get2AMDateKey();
    const currentMonthPrefix = todayKey.substring(0, 7);

    // Week keys (past 7 days including today)
    const weekKeys = new Set<string>();
    const nowAdjusted = new Date(Date.now() - 2 * 3600000);
    for (let d = 0; d < 7; d++) {
      const pastD = new Date(nowAdjusted.getTime() - d * 86400000);
      const k = `${pastD.getFullYear()}-${String(pastD.getMonth() + 1).padStart(2, '0')}-${String(pastD.getDate()).padStart(2, '0')}`;
      weekKeys.add(k);
    }

    const safeBlocks = Array.isArray(historyData?.blocks) ? historyData.blocks : [];

    return safeBlocks.filter(block => {
      if (!block || !block.timestamp) return false;
      const blockKey = get2AMDateKey(block.timestamp);
      if (timeframe === 'today') {
        return blockKey === todayKey;
      }
      if (timeframe === 'week') {
        return weekKeys.has(blockKey);
      }
      return blockKey.startsWith(currentMonthPrefix);
    });
  }, [historyData?.blocks, timeframe]);

  // Group individual 5-min inspection blocks into Continuous Study Sittings / Focus Sessions
  const groupedSessions: FocusSittingSession[] = useMemo(() => {
    if (filteredBlocks.length === 0) return [];

    const sorted = [...filteredBlocks].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const sessions: FocusSittingSession[] = [];
    let currentGroup: StudyBlock[] = [];

    const finalizeGroup = (group: StudyBlock[]) => {
      if (group.length === 0) return;

      const earliestBlock = group[0];
      const latestBlock = group[group.length - 1];

      const startMs = new Date(earliestBlock.timestamp).getTime();
      const latestBlockMs = new Date(latestBlock.timestamp).getTime();
      const endMs = latestBlockMs + (latestBlock.durationMinutes || 5) * 60 * 1000;

      const startTimeStr = earliestBlock.timestamp;
      const endTimeStr = new Date(endMs).toISOString();

      const startTimeFormatted = formatTime12h(startTimeStr);
      const endTimeFormatted = formatTime12h(endTimeStr);
      const timeWindowLabel = `${startTimeFormatted} – ${endTimeFormatted}`;
      const dateLabel = formatDateLabel(startTimeStr);

      const activeBlocks = group.filter(b => b.status === 'active');
      const totalMinutes = activeBlocks.reduce((sum, b) => sum + (b.durationMinutes || 5), 0);
      const totalHours = Number((totalMinutes / 60).toFixed(1));

      let formattedDuration = '';
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      if (h > 0 && m > 0) {
        formattedDuration = `${h} hr ${m} mins`;
      } else if (h > 0) {
        formattedDuration = `${h} ${h === 1 ? 'hr' : 'hrs'}`;
      } else {
        formattedDuration = `${m} mins`;
      }

      const passedCount = group.filter(b => b.status === 'active').length;
      const flaggedCount = group.filter(b => b.status !== 'active').length;
      const allPassed = flaggedCount === 0;

      sessions.push({
        id: `session_${earliestBlock.id}_${startMs}`,
        startTime: startTimeStr,
        endTime: endTimeStr,
        startTimeFormatted,
        endTimeFormatted,
        dateLabel,
        timeWindowLabel,
        totalMinutes,
        totalHours,
        formattedDuration,
        subjectNote: group.find(b => b.status === 'active' && b.subjectNote && b.subjectNote !== 'Non-Study Activity Detected')?.subjectNote || earliestBlock.subjectNote || 'General Study',
        campaignName: earliestBlock.campaignName || campaignName,
        blocks: [...group].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
        passedCount,
        flaggedCount,
        allPassed
      });
    };

    sorted.forEach((block) => {
      if (currentGroup.length === 0) {
        currentGroup.push(block);
        return;
      }

      const prevBlock = currentGroup[currentGroup.length - 1];
      const prevTime = new Date(prevBlock.timestamp).getTime();
      const currTime = new Date(block.timestamp).getTime();
      const gapMinutes = (currTime - prevTime) / (60 * 1000);

      // Group all 5-minute checkpoints (passed and flagged) within a contiguous 15-minute window
      if (gapMinutes <= 15) {
        currentGroup.push(block);
      } else {
        finalizeGroup(currentGroup);
        currentGroup = [block];
      }
    });

    if (currentGroup.length > 0) {
      finalizeGroup(currentGroup);
    }

    return sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [filteredBlocks, campaignName]);

  // Compute Activity Breakdown: starting from campaign creation date (up to last 7 days, 2 AM boundary aligned)
  const sevenDayBreakdown = useMemo(() => {
    const now = new Date();
    const adjustedNow = new Date(now.getTime() - 2 * 3600000);
    const todayMidnight = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), adjustedNow.getDate()).getTime();

    let daysCount = 7;
    if (campaignCreatedAt) {
      const createdDate = new Date(campaignCreatedAt);
      const adjustedCreated = new Date(createdDate.getTime() - 2 * 3600000);
      const createdMidnight = new Date(adjustedCreated.getFullYear(), adjustedCreated.getMonth(), adjustedCreated.getDate()).getTime();
      const diffDays = Math.floor((todayMidnight - createdMidnight) / 86400000) + 1;
      if (diffDays >= 1 && diffDays < 7) {
        daysCount = diffDays;
      }
    }

    const days: Array<{
      dayKey: string;
      dayShort: string;
      fullDateStr: string;
      minutes: number;
      hours: number;
      isToday: boolean;
      passCount: number;
      failCount: number;
      targetHours: number;
      routineLabel: string;
    }> = [];

    for (let d = daysCount - 1; d >= 0; d--) {
      const targetDate = new Date(adjustedNow.getTime() - d * 86400000);
      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;

      const dayNames = ['S', 'M', 'T', 'W', 'TH', 'F', 'SA'];
      const dayShort = dayNames[targetDate.getDay()];

      // Per-day target and routine resolution:
      // If user registered 'college' for this day -> 4h. If 'no_college' -> 7h.
      let dayTargetHours = 7;
      let routineLabel = 'No College (7h)';

      const savedRoutine = localStorage.getItem(`study_college_routine_${dateKey}`);
      if (savedRoutine === 'college') {
        dayTargetHours = 4;
        routineLabel = 'College Day (4h)';
      } else if (savedRoutine === 'no_college') {
        dayTargetHours = 7;
        routineLabel = 'No College (7h)';
      } else if (d === 0) {
        // Today
        dayTargetHours = collegeRoutine === 'college' ? 4 : 7;
        routineLabel = collegeRoutine === 'college' ? 'College Day (4h)' : 'No College (7h)';
      } else {
        // Past unrecorded day
        const dayOfWeek = targetDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          dayTargetHours = 7;
          routineLabel = 'Weekend (7h)';
        } else {
          dayTargetHours = 4;
          routineLabel = 'College Day (4h)';
        }
      }

      let minutes = 0;
      let passCount = 0;
      let failCount = 0;

      historyData.blocks.forEach(b => {
        const bTime = new Date(b.timestamp).getTime();
        const adjustedBTime = new Date(bTime - 2 * 3600000);
        const bDateKey = `${adjustedBTime.getFullYear()}-${String(adjustedBTime.getMonth() + 1).padStart(2, '0')}-${String(adjustedBTime.getDate()).padStart(2, '0')}`;
        
        if (bDateKey === dateKey) {
          if (b.status === 'active') {
            minutes += b.durationMinutes || 5;
            passCount++;
          } else {
            failCount++;
          }
        }
      });

      days.push({
        dayKey: dateKey,
        dayShort,
        fullDateStr: targetDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        minutes,
        hours: Number((minutes / 60).toFixed(1)),
        isToday: d === 0,
        passCount,
        failCount,
        targetHours: dayTargetHours,
        routineLabel
      });
    }

    return { days, daysCount };
  }, [historyData.blocks, campaignCreatedAt, collegeRoutine, todayTargetHours]);

  // Overall pass rate calculation
  const overallStats = useMemo(() => {
    const total = filteredBlocks.length;
    const passed = filteredBlocks.filter(b => b.status === 'active').length;
    const rate = total > 0 ? Math.round((passed / total) * 100) : 100;
    return { total, passed, rate };
  }, [filteredBlocks]);

  const getMinutesForTimeframe = (tf: Timeframe) => {
    return filteredBlocks
      .filter(b => b.status === 'active')
      .reduce((sum, b) => sum + (b.durationMinutes || 5), 0);
  };

  const currentMinutes = getMinutesForTimeframe(timeframe);
  const currentHours = currentMinutes / 60;
  const targetHours = getTimeframeTargetHours(timeframe);
  const progressPct = targetHours > 0 ? Math.min(100, Math.round((currentHours / targetHours) * 100)) : 0;
  const totalBlocks = filteredBlocks.length;

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100 pb-10 select-none">
      
      {/* ═══ 1. Posh Hero Spotlight Banner (Inspired by Reference Dashboards) ═══ */}
      <div className="posh-hero-glow rounded-3xl p-6 sm:p-7 shadow-xl relative overflow-hidden text-zinc-950 dark:text-white">
        
        {/* Subtle Ambient Radial Halos */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-500/10 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          {/* Left: User Title & Progress Pacing */}
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[11px] font-mono font-black uppercase tracking-wider px-3 py-1 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xs">
                {campaignName}
              </span>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-950 dark:text-white">
                Track Focus & Progress
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Explore a detailed breakdown of your focused study sittings and verified intervals.
              </p>
            </div>

            {/* Quick Status Pills */}
            <div className="flex items-center gap-3 pt-1 flex-wrap">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs shadow-xs">
                <Target className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-bold text-zinc-900 dark:text-white">{todayTargetHours}h Goal</span>
                <span className="text-[10px] text-zinc-400">({collegeRoutine === 'college' ? 'College' : 'No College'})</span>
              </div>

              <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-pill text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <Flame className="w-3.5 h-3.5 text-amber-500" />
                <span>Daily Streak Active</span>
              </div>
            </div>
          </div>

          {/* Right: Quick Performance Capsule */}
          <div className="lg:w-72 shrink-0 bg-zinc-950/5 dark:bg-white/[0.04] border border-zinc-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 flex flex-col justify-between space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                {timeframe === 'today' ? 'Today\'s Target' : timeframe === 'week' ? 'Weekly Goal' : 'Monthly Goal'}
              </span>
              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {progressPct}% Completed
              </span>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-3xl font-black font-mono tracking-tight text-zinc-950 dark:text-white">
                  {currentHours.toFixed(1)} <span className="text-sm font-normal text-zinc-400">/ {targetHours.toFixed(1)}h</span>
                </span>
                <span className="text-xs font-mono font-semibold text-zinc-400">
                  {currentMinutes} mins
                </span>
              </div>

              {/* Glowing Posh Progress Bar */}
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden p-0.5">
                <div 
                  className="h-full rounded-full bg-zinc-950 dark:bg-white transition-all duration-700 shadow-sm"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-200/60 dark:border-white/[0.06]">
              <span>Focus Pass Rate</span>
              <span className="font-bold text-zinc-950 dark:text-white font-mono">{overallStats.rate}% ({overallStats.passed}/{overallStats.total})</span>
            </div>
          </div>

        </div>

      </div>

      {/* ═══ 2. Top Header & Timeframe Tabs ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl shadow-sm transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-950 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-xs">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-zinc-950 dark:text-white tracking-tight">
              Focus Analytics & History
            </h3>
            <p className="text-xs text-zinc-400">Continuous sitting logs & 7-day distribution chart</p>
          </div>
        </div>

        {/* Timeframe Tabs: Today | This Week | This Month */}
        <div className="flex items-center space-x-1 glass-pill p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setTimeframe('today')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              timeframe === 'today'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeframe('week')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              timeframe === 'week'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              timeframe === 'month'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* ═══ 3. Interactive Study Distribution Bar Chart (Calibrated Per-Day: 4h College / 7h Non-College) ═══ */}
      <div className="posh-card rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
        
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-base text-zinc-950 dark:text-white">
                {sevenDayBreakdown.daysCount === 7 ? '7-Day' : `${sevenDayBreakdown.daysCount}-Day`} Study Distribution
              </h4>
              <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                2 AM Reset Aligned
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Daily verified hours vs calibrated day target (4h College / 7h No College)
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-zinc-400 font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <span className="text-zinc-700 dark:text-zinc-300 font-semibold">Today</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600/90" />
              <span>Previous Days</span>
            </span>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="relative pt-2 pb-2">
          
          {/* Vertical Bar Pillars Grid */}
          <div 
            className="grid gap-2 sm:gap-6 items-end h-52 sm:h-60 relative z-10"
            style={{
              gridTemplateColumns: `repeat(${sevenDayBreakdown.days.length}, minmax(0, 1fr))`
            }}
          >
            {sevenDayBreakdown.days.map((day, idx) => {
              // Bar height is strictly relative to THAT day's target (4h or 7h)
              const heightPct = day.hours > 0 ? Math.min(100, Math.max(10, Math.round((day.hours / day.targetHours) * 100))) : 0;
              const isHovered = activeHoverDayIdx === idx;

              return (
                <div 
                  key={day.dayKey}
                  onMouseEnter={() => setActiveHoverDayIdx(idx)}
                  onMouseLeave={() => setActiveHoverDayIdx(null)}
                  className="flex flex-col items-center h-full justify-end group cursor-pointer relative"
                >
                  {/* Floating Tooltip Capsule on Hover */}
                  {isHovered && (
                    <div className="absolute -top-14 z-30 bg-zinc-950 text-white dark:bg-zinc-900 dark:text-white px-3 py-1.5 rounded-xl text-xs font-mono font-bold whitespace-nowrap shadow-2xl animate-in fade-in zoom-in-95 duration-150 pointer-events-none border border-emerald-500/30 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.9)]"></span>
                      <span>{day.fullDateStr}: {day.hours}h / {day.targetHours}h Goal ({day.routineLabel}) · {day.passCount} passes</span>
                    </div>
                  )}

                  {/* Hours Label on Top of Pillar */}
                  <span className={`text-[11px] sm:text-xs font-mono font-bold mb-2 transition-all duration-200 ${
                    day.isToday 
                      ? 'text-emerald-500 dark:text-emerald-400 font-black scale-105' 
                      : day.hours > 0 
                      ? 'text-zinc-600 dark:text-zinc-300 group-hover:text-emerald-400' 
                      : 'text-zinc-400/60 dark:text-zinc-600'
                  }`}>
                    {day.hours > 0 ? `${day.hours}h` : '0h'}
                  </span>

                  {/* Pillar Column Track & Filled Emerald Bar */}
                  <div className="w-full max-w-[32px] sm:max-w-[46px] h-36 sm:h-44 flex items-end justify-center relative rounded-2xl bg-zinc-100/50 dark:bg-white/[0.02] p-1 group-hover:bg-zinc-200/50 dark:group-hover:bg-white/[0.05] transition-colors border border-transparent group-hover:border-emerald-500/20">
                    
                    {day.hours > 0 ? (
                      /* Filled Bar with Smooth Vertical Emerald Gradient & Luminous Crest */
                      <div 
                        className={`w-full rounded-t-2xl rounded-b-lg transition-all duration-500 relative flex flex-col justify-between overflow-hidden ${
                          day.isToday
                            ? 'bg-gradient-to-t from-emerald-950 via-emerald-600 to-emerald-400 shadow-[0_-2px_18px_rgba(16,185,129,0.55)]'
                            : 'bg-gradient-to-t from-emerald-950/80 via-emerald-800/90 to-emerald-600 group-hover:brightness-110 shadow-[0_-1px_8px_rgba(16,185,129,0.25)]'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      >
                        {/* Glowing Emerald Top Edge Highlight Line */}
                        <div className={`w-full h-1 shrink-0 rounded-t-2xl ${
                          day.isToday ? 'bg-emerald-300 shadow-[0_0_8px_rgba(16,185,129,1)]' : 'bg-emerald-400/80'
                        }`} />
                        {/* Subtle Inner Gradient Flare */}
                        <div className="w-full flex-1 bg-gradient-to-b from-white/20 to-transparent" />
                      </div>
                    ) : (
                      /* Minimalist Elegant Baseline Dot for 0h */
                      <div className="w-4 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-800 group-hover:bg-zinc-400 dark:group-hover:bg-zinc-700 transition-colors" />
                    )}

                  </div>

                  {/* Day Footer Label (M, T, W, TH, F, SA, S + Date Number + Target Badge) */}
                  <div className="mt-3 text-center flex flex-col items-center gap-1">
                    <span className={`text-xs sm:text-sm font-black transition ${
                      day.isToday ? 'text-emerald-500 dark:text-emerald-400' : 'text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200'
                    }`}>
                      {day.dayShort}
                    </span>
                    
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md transition ${
                      day.isToday 
                        ? 'bg-emerald-500 text-white dark:bg-emerald-500 dark:text-black font-extrabold shadow-xs' 
                        : 'text-zinc-400 dark:text-zinc-500'
                    }`}>
                      {day.fullDateStr.split(' ')[1]}
                    </span>

                    {/* Target Pill Indicator (4h / 7h) */}
                    <span className="text-[9px] font-mono text-zinc-400/70 dark:text-zinc-500 font-bold">
                      {day.targetHours}h
                    </span>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* ═══ 4. Summary Metric Cards ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Focus Time */}
        <div className="posh-card rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Registered Focus</span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white font-mono">
            {currentHours.toFixed(1)} <span className="text-xs font-normal text-zinc-400">hrs</span>
          </div>
          <div className="text-[11px] text-zinc-400 font-mono flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span>{currentMinutes} mins in {timeframe === 'today' ? 'today\'s cycle' : timeframe === 'week' ? 'this week' : 'this month'}</span>
          </div>
        </div>

        {/* Focus Sittings Count */}
        <div className="posh-card rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Study Sittings</span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white font-mono">
            {groupedSessions.length}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            {totalBlocks} total AI checkpoints (5m)
          </div>
        </div>

        {/* Goal Target Progress */}
        <div className="posh-card rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Goal Progress</span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <Target className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white font-mono">{progressPct}%</span>
            <span className="text-xs text-zinc-400 font-mono">{currentHours.toFixed(1)} / {targetHours.toFixed(1)}h</span>
          </div>
          <div className="w-full bg-zinc-200/80 dark:bg-zinc-800/80 h-2 rounded-full overflow-hidden p-0.5">
            <div 
              className="h-full rounded-full bg-zinc-950 dark:bg-white transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Lifetime All Sessions */}
        <div className="posh-card rounded-3xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cohort Lifetime</span>
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white font-mono">
            {(historyData.totalMinutes / 60).toFixed(1)} <span className="text-xs font-normal text-zinc-400">hrs</span>
          </div>
          <div className="text-[11px] text-zinc-400 truncate">
            {campaignName}
          </div>
        </div>

      </div>

      {/* ═══ 5. Focus Sittings Grouped Log Section ═══ */}
      <div className="posh-card rounded-3xl overflow-hidden shadow-sm">
        
        {/* Table / Section Header */}
        <div className="px-6 py-4 border-b border-zinc-200/60 dark:border-white/[0.08] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="font-bold text-sm sm:text-base text-zinc-950 dark:text-white">
              {timeframe === 'today' ? "Today's Study Sittings & Focus Log" : timeframe === 'week' ? "This Week's Study Sittings" : "This Month's Study Sittings"}
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Continuous focus sittings with expandable AI inspection passes & fails
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {groupedSessions.length > 1 && (
              <div className="hidden sm:flex items-center space-x-1">
                <button
                  type="button"
                  onClick={expandAllSessions}
                  className="px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition cursor-pointer"
                >
                  Expand All
                </button>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <button
                  type="button"
                  onClick={collapseAllSessions}
                  className="px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition cursor-pointer"
                >
                  Collapse All
                </button>
              </div>
            )}

            <span className="text-[11px] font-mono font-semibold text-zinc-400 glass-pill px-2.5 py-0.5 rounded-full">
              {groupedSessions.length} {groupedSessions.length === 1 ? 'Sitting' : 'Sittings'}
            </span>
          </div>
        </div>

        {/* Sittings List Container */}
        <div className="divide-y divide-zinc-200/60 dark:divide-white/[0.06]">
          {isLoading && groupedSessions.length === 0 ? (
            [1, 2, 3].map(i => (
              <div key={i} className="p-5 animate-pulse flex items-center justify-between">
                <div className="space-y-2">
                  <div className="w-36 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="w-56 h-3 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
                <div className="w-24 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
              </div>
            ))
          ) : groupedSessions.length === 0 ? (
            <div className="py-14 text-center text-zinc-400">
              <div className="flex flex-col items-center justify-center space-y-2">
                <Clock className="w-8 h-8 text-zinc-300 dark:text-zinc-700" />
                <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                  No study sittings recorded for {timeframe === 'today' ? 'today' : timeframe === 'week' ? 'this week' : 'this month'}
                </p>
                <p className="text-xs text-zinc-400">
                  Start a focus session in Focus Studio to record your study blocks!
                </p>
              </div>
            </div>
          ) : (
            groupedSessions.map((session) => {
              const isExpanded = expandedSessionIds.has(session.id);

              return (
                <div key={session.id} className="transition-colors">
                  
                  {/* Parent Sitting Entry Header (Clickable Accordion) */}
                  <div
                    onClick={() => toggleSessionExpand(session.id)}
                    className="p-4 sm:p-5 hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                  >
                    
                    {/* Left: Time Range & Study Topic */}
                    <div className="flex items-start space-x-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 mt-0.5 border border-zinc-200 dark:border-zinc-700/60 shadow-xs">
                        <Clock className="w-4 h-4" />
                      </div>
                      
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="font-extrabold text-sm sm:text-base text-zinc-950 dark:text-white font-mono leading-tight">
                            {session.timeWindowLabel}
                          </h5>
                          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                            ({session.dateLabel})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 glass-pill px-2.5 py-0.5 rounded-lg border border-zinc-200/80 dark:border-white/[0.08]">
                            {session.subjectNote}
                          </span>
                          <span className="text-[11px] text-zinc-400 font-mono">
                            {session.blocks.length} {session.blocks.length === 1 ? 'checkpoint' : 'checkpoints'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Total Sitting Duration & Inspection Summary & Chevron */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
                      
                      {/* Total Duration Badge */}
                      <div className="px-3 py-1.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-black text-xs font-black font-mono shadow-xs">
                        {session.formattedDuration}
                      </div>

                      {/* AI Pass/Fail Summary Pill */}
                      <div className="flex items-center gap-1.5">
                        {session.allPassed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>100% Passed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{session.passedCount} Pass · {session.flaggedCount} Flagged</span>
                          </span>
                        )}
                      </div>

                      {/* Expand / Collapse Chevron */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSessionExpand(session.id);
                        }}
                        className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer border border-zinc-200/80 dark:border-zinc-700"
                        title={isExpanded ? 'Collapse Inspections' : 'Expand AI Inspections'}
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>

                    </div>

                  </div>

                  {/* Child Drawer: Individual 5-Minute AI Inspections (Expandable) */}
                  {isExpanded && (
                    <div className="bg-zinc-50/70 dark:bg-zinc-950/60 p-3 sm:p-5 border-t border-zinc-200/60 dark:border-white/[0.06] animate-in fade-in zoom-in-98 duration-150">
                      
                      <div className="mb-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-semibold px-2">
                        <span>Study Checkpoints ({session.blocks.length} intervals)</span>
                        <span>Time: {session.timeWindowLabel}</span>
                      </div>

                      <div className="space-y-2">
                        {session.blocks.map((block, idx) => {
                          const checkpointTime = formatTime12h(block.timestamp);
                          const isPassed = block.status === 'active';

                          return (
                            <div 
                              key={block.id || idx}
                              className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-white/[0.08] shadow-xs text-xs"
                            >
                              {/* Left: Checkpoint number & time */}
                              <div className="flex items-center space-x-3 min-w-0">
                                <span className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                                  #{session.blocks.length - idx}
                                </span>
                                <div>
                                  <p className="font-bold text-zinc-950 dark:text-white font-mono text-xs">
                                    {checkpointTime}
                                  </p>
                                  <p className="text-[10px] text-zinc-400 truncate max-w-[200px] sm:max-w-[320px]">
                                    {block.subjectNote || 'Focus Study Session'}
                                  </p>
                                </div>
                              </div>

                              {/* Middle: Duration & Status Badge */}
                              <div className="flex items-center space-x-3">
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                  +{block.durationMinutes || 5}m
                                </span>

                                {isPassed ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Verified Pass
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                    Flagged Fail
                                  </span>
                                )}

                                {/* Snapshot button */}
                                {block.snapshotUrl && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSnapshotUrl(block.snapshotUrl || null)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition cursor-pointer active:scale-95 border border-zinc-200 dark:border-zinc-700"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Snapshot</span>
                                  </button>
                                )}
                              </div>

                            </div>
                          );
                        })}
                      </div>

                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

      </div>

      {/* Snapshot Preview Modal */}
      {selectedSnapshotUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedSnapshotUrl(null)}
        >
          <div 
            className="bg-zinc-900 border border-white/10 rounded-3xl p-5 max-w-2xl w-full space-y-4 shadow-2xl relative text-zinc-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-white">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-sm">Inspected Screen Snapshot</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSnapshotUrl(null)}
                className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-video flex items-center justify-center shadow-inner">
              <img 
                src={selectedSnapshotUrl} 
                alt="AI Inspected Screen Snapshot" 
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-xs text-zinc-400 text-center">
              Verified Study Session • Privacy-Preserved StudySync
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

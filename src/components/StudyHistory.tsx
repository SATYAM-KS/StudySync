import React, { useState, useEffect, useMemo } from 'react';
import { StudyBlock } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
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
  Maximize2
} from 'lucide-react';

interface StudyHistoryProps {
  campaignId: string;
  campaignName: string;
  targetDailyHours: number;
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
  targetDailyHours
}) => {
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const cacheKey = `study_history_cache_${campaignId}_${user?.id || 'anon'}`;

  const [timeframe, setTimeframe] = useState<Timeframe>('today');
  const [historyData, setHistoryData] = useState<HistoryResponse>(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
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

  const fetchHistory = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/study/history?campaignId=${campaignId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {}
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
      if (prev.blocks.some(b => b.id === newBlock.id)) {
        return prev;
      }

      const updatedBlocks = [newBlock, ...prev.blocks];
      const isPassed = newBlock.status === 'active';
      const duration = isPassed ? (newBlock.durationMinutes || 5) : 0;

      const updatedData: HistoryResponse = {
        blocks: updatedBlocks,
        todayMinutes: prev.todayMinutes + duration,
        thisWeekMinutes: prev.thisWeekMinutes + duration,
        thisMonthMinutes: prev.thisMonthMinutes + duration,
        totalMinutes: prev.totalMinutes + duration
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(updatedData));
      } catch {}

      return updatedData;
    });

    setTimeout(() => {
      fetchHistory();
    }, 400);
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
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
    const baseDaily = targetDailyHours || 4;
    if (tf === 'today') return baseDaily;
    if (tf === 'week') return baseDaily * 7;
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

  // Filter blocks by selected timeframe (aligned to 2:00 AM boundary)
  const filteredBlocks = useMemo(() => {
    return historyData.blocks.filter(block => {
      const now = new Date();
      const adjustedNow = new Date(now.getTime() - 2 * 3600000);
      const todayStart = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), adjustedNow.getDate(), 2, 0, 0, 0).getTime();
      const weekStart = todayStart - 6 * 86400000;
      const monthStart = new Date(adjustedNow.getFullYear(), adjustedNow.getMonth(), 1, 2, 0, 0, 0).getTime();

      const blockTime = new Date(block.timestamp).getTime();
      if (timeframe === 'today') {
        return blockTime >= todayStart;
      }
      if (timeframe === 'week') {
        return blockTime >= weekStart;
      }
      return blockTime >= monthStart;
    });
  }, [historyData.blocks, timeframe]);

  // Group individual 5-min inspection blocks into Continuous Study Sittings / Focus Sessions
  const groupedSessions: FocusSittingSession[] = useMemo(() => {
    if (filteredBlocks.length === 0) return [];

    // Sort chronological (earliest first) to group sequential blocks
    const sorted = [...filteredBlocks].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const sessions: FocusSittingSession[] = [];
    let currentGroup: StudyBlock[] = [];

    const finalizeGroup = (group: StudyBlock[]) => {
      if (group.length === 0) return;

      const earliestBlock = group[0];
      const latestBlock = group[group.length - 1];

      const startMs = new Date(earliestBlock.timestamp).getTime();
      const latestBlockMs = new Date(latestBlock.timestamp).getTime();
      // End time is latest block start + its duration (default 5 mins)
      const endMs = latestBlockMs + (latestBlock.durationMinutes || 5) * 60 * 1000;

      const startTimeStr = earliestBlock.timestamp;
      const endTimeStr = new Date(endMs).toISOString();

      const startTimeFormatted = formatTime12h(startTimeStr);
      const endTimeFormatted = formatTime12h(endTimeStr);
      const timeWindowLabel = `${startTimeFormatted} – ${endTimeFormatted}`;
      const dateLabel = formatDateLabel(startTimeStr);

      const totalMinutes = group.reduce((sum, b) => sum + (b.durationMinutes || 5), 0);
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
        subjectNote: earliestBlock.subjectNote || 'General Study',
        campaignName: earliestBlock.campaignName || campaignName,
        // Keep inner blocks sorted latest first for detailed inspection
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

      // If blocks occurred within a 12-minute window and share same subject, group as same seating
      const isSameTopic = (block.subjectNote || 'General Study') === (prevBlock.subjectNote || 'General Study');
      if (gapMinutes <= 12 && isSameTopic) {
        currentGroup.push(block);
      } else {
        finalizeGroup(currentGroup);
        currentGroup = [block];
      }
    });

    if (currentGroup.length > 0) {
      finalizeGroup(currentGroup);
    }

    // Sort sessions latest sitting first (most recent on top)
    return sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [filteredBlocks, campaignName]);

  const getMinutesForTimeframe = (tf: Timeframe) => {
    if (tf === 'today') return historyData.todayMinutes;
    if (tf === 'week') return historyData.thisWeekMinutes;
    return historyData.thisMonthMinutes;
  };

  const currentMinutes = getMinutesForTimeframe(timeframe);
  const currentHours = currentMinutes / 60;
  const targetHours = getTimeframeTargetHours(timeframe);
  const progressPct = targetHours > 0 ? Math.min(100, Math.round((currentHours / targetHours) * 100)) : 0;
  const totalBlocks = filteredBlocks.length;

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100 pb-8 select-none">
      
      {/* Top Header & Timeframe Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl shadow-sm transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-950 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-xs">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-zinc-950 dark:text-white tracking-tight">
              Study Focus History
            </h3>
            <p className="text-xs text-zinc-400">Continuous sitting logs & AI inspection records</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Focus Time */}
        <div className="glass-card rounded-3xl p-5 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Registered Focus</span>
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-zinc-950 dark:text-white font-mono">
            {currentHours.toFixed(1)} hrs
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            {currentMinutes} mins in {timeframe === 'today' ? 'today\'s focus' : timeframe === 'week' ? 'this week' : 'this month'}
          </div>
        </div>

        {/* Focus Sittings Count */}
        <div className="glass-card rounded-3xl p-5 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Study Sittings</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-zinc-950 dark:text-white font-mono">
            {groupedSessions.length}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            {totalBlocks} total AI checkpoints (5m)
          </div>
        </div>

        {/* Goal Target Progress */}
        <div className="glass-card rounded-3xl p-5 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Goal Progress</span>
            <Target className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-zinc-950 dark:text-white font-mono">{progressPct}%</span>
            <span className="text-xs text-zinc-400 font-mono">{currentHours.toFixed(1)} / {targetHours.toFixed(1)}h</span>
          </div>
          <div className="w-full bg-zinc-200/80 dark:bg-zinc-800/80 h-1.5 rounded-full overflow-hidden glass-pill">
            <div 
              className="h-full rounded-full bg-zinc-950 dark:bg-white transition-all duration-500 shadow-xs"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Total Lifetime Focus */}
        <div className="glass-card rounded-3xl p-5 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">All-Time Focus</span>
            <Flame className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-zinc-950 dark:text-white font-mono">
            {(historyData.totalMinutes / 60).toFixed(1)} hrs
          </div>
          <div className="text-[11px] text-zinc-400 truncate">
            {campaignName}
          </div>
        </div>

      </div>

      {/* Focus Sittings Grouped Log Section */}
      <div className="glass-panel rounded-3xl overflow-hidden shadow-sm">
        
        {/* Table / Section Header */}
        <div className="px-6 py-4 border-b border-zinc-200/60 dark:border-white/[0.08] flex items-center justify-between flex-wrap gap-2">
          <div>
            <h4 className="font-bold text-sm text-zinc-950 dark:text-white">
              {timeframe === 'today' ? "Today's Study Sittings & Focus Log" : timeframe === 'week' ? "This Week's Study Sittings" : "This Month's Study Sittings"}
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Continuous focus sittings with expandable AI inspection passes/fails
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
                      <div className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0 mt-0.5 border border-zinc-200 dark:border-zinc-700/60 shadow-xs">
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
                            <span>{session.passedCount} Pass · {session.flaggedCount} Fail</span>
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
                        <span>AI Proctor Checkpoints ({session.blocks.length} 5-minute intervals)</span>
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
                                {block.snapshotUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedSnapshotUrl(block.snapshotUrl || null)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition cursor-pointer active:scale-95 border border-zinc-200 dark:border-zinc-700"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Snapshot</span>
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-zinc-400 font-mono">—</span>
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
              Verified by Gemini Vision AI Screen Proctor • 100% Privacy-Preserved Study Sync
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

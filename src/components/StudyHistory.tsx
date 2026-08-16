import React, { useState, useEffect } from 'react';
import { StudyBlock } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { 
  History, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  Flame, 
  Target, 
  Sparkles, 
  Eye, 
  X,
  Layers,
  ArrowUpRight
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
      const duration = newBlock.durationMinutes || 5;

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

    // Revalidate in background
    setTimeout(() => {
      fetchHistory();
    }, 400);
  };

  useEffect(() => {
    fetchHistory();
    // 5s background sync fallback
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [campaignId, token]);

  // Real-time updates via window custom events (0ms immediate local response)
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

  // Real-time updates via socket
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
    const baseDaily = targetDailyHours || 3;
    if (tf === 'today') return baseDaily;
    if (tf === 'week') return baseDaily * 7;
    return baseDaily * getDaysInCurrentMonth();
  };

  // Filter blocks by selected timeframe
  const filteredBlocks = historyData.blocks.filter(block => {
    if (block.status !== 'active') return false;
    const now = new Date();
    const todayDateStr = now.toISOString().split('T')[0];
    const todayLocalDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 86400000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const blockTime = new Date(block.timestamp).getTime();
    if (timeframe === 'today') {
      return block.timestamp.startsWith(todayDateStr) || block.timestamp.startsWith(todayLocalDateStr) || blockTime >= todayStart;
    }
    if (timeframe === 'week') {
      return blockTime >= weekStart || block.timestamp.startsWith(todayDateStr);
    }
    return blockTime >= monthStart;
  });

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

  // Format date helper
  const formatBlockTime = (timestampStr: string) => {
    try {
      const date = new Date(timestampStr);
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return 'Just now';
    }
  };

  const formatBlockDate = (timestampStr: string) => {
    try {
      const date = new Date(timestampStr);
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      }
      const yesterday = new Date(today.getTime() - 86400000);
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100 pb-8">
      
      {/* Top Header & Timeframe Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl shadow-sm transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-950 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-xs">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-zinc-950 dark:text-white tracking-tight">
              Study History
            </h3>
            <p className="text-xs text-zinc-400">Verified focus blocks & inspection records</p>
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
            {currentMinutes} mins in {timeframe === 'today' ? 'today\'s session' : timeframe === 'week' ? 'this week' : 'this month'}
          </div>
        </div>

        {/* Verified 5-Min Blocks */}
        <div className="glass-card rounded-3xl p-5 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Focus Blocks</span>
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div className="text-2xl font-black text-zinc-950 dark:text-white font-mono">
            {totalBlocks}
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            5-min verified blocks
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
            <span className="text-[11px] font-semibold uppercase tracking-wider">All Sessions</span>
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

      {/* Focus Blocks Log Table */}
      <div className="glass-panel rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-200/60 dark:border-white/[0.08] flex items-center justify-between">
          <h4 className="font-bold text-sm text-zinc-950 dark:text-white">
            {timeframe === 'today' ? 'Today\'s Focus Log' : timeframe === 'week' ? 'This Week\'s Focus Log' : 'This Month\'s Focus Log'}
          </h4>
          <span className="text-[11px] font-mono font-semibold text-zinc-400 glass-pill px-2.5 py-0.5 rounded-full">
            {filteredBlocks.length} {filteredBlocks.length === 1 ? 'Record' : 'Records'}
          </span>
        </div>

        <div className="divide-y divide-zinc-200/60 dark:divide-white/[0.06] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100/60 dark:bg-zinc-800/30 text-zinc-400 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Study Topic</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
              {isLoading && filteredBlocks.length === 0 ? (
                [1, 2, 3, 4].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="w-24 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-48 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-16 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-24 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="w-8 h-4 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredBlocks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400">
                    <div className="flex flex-col items-center justify-center space-y-1.5">
                      <Clock className="w-7 h-7 text-zinc-300 dark:text-zinc-700" />
                      <p className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">No records for {timeframe === 'today' ? 'today' : timeframe === 'week' ? 'this week' : 'this month'}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBlocks.map((block, idx) => {
                  const dateLabel = formatBlockDate(block.timestamp);
                  const timeLabel = formatBlockTime(block.timestamp);

                  return (
                    <tr key={block.id || idx} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition">
                      
                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-zinc-950 dark:text-white font-mono text-xs">
                          {timeLabel}
                        </div>
                        <span className="text-[10px] text-zinc-400">
                          {dateLabel}
                        </span>
                      </td>

                      {/* Study Topic */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 max-w-[280px] block truncate">
                          {block.subjectNote || 'General Study'}
                        </span>
                      </td>

                      {/* Registered Duration */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-white/[0.08]">
                          +{block.durationMinutes || 5}m
                        </span>
                      </td>

                      {/* Verification Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Verified
                        </span>
                      </td>

                      {/* Snapshot preview */}
                      <td className="py-3 px-4 text-right">
                        {block.snapshotUrl ? (
                          <button
                            onClick={() => setSelectedSnapshotUrl(block.snapshotUrl || null)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-zinc-400">—</span>
                        )}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Snapshot Preview Modal */}
      {selectedSnapshotUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 max-w-2xl w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-white">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h4 className="font-bold text-sm">Inspected Screen Snapshot</h4>
              </div>
              <button
                onClick={() => setSelectedSnapshotUrl(null)}
                className="p-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-black aspect-video flex items-center justify-center">
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

import React, { useState, useEffect } from 'react';
import { LeaderboardEntry } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { 
  Trophy, 
  Flame, 
  Crown
} from 'lucide-react';

interface LeaderboardProps {
  campaignId: string;
  targetDailyHours: number;
}

type Timeframe = 'today' | 'week' | 'month';

export const Leaderboard: React.FC<LeaderboardProps> = ({ campaignId, targetDailyHours }) => {
  const { socket } = useSocket();
  const cacheKey = `study_leaderboard_cache_${campaignId}`;

  const [entries, setEntries] = useState<LeaderboardEntry[]>(() => {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });
  const [timeframe, setTimeframe] = useState<Timeframe>('today');
  const [isLoading, setIsLoading] = useState(() => {
    try {
      return !localStorage.getItem(cacheKey);
    } catch {
      return true;
    }
  });

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {}
      }
    } catch (e) {
      console.error('Failed to load leaderboard:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [campaignId]);

  // Real-time leaderboard updates on study blocks
  useEffect(() => {
    if (!socket) return;
    const handleBlock = () => {
      fetchLeaderboard();
    };
    socket.on('study:block_logged', handleBlock);
    return () => {
      socket.off('study:block_logged', handleBlock);
    };
  }, [socket]);

  const getDaysInCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  };

  const getTimeframeTargetHours = (dailyTarget: number, tf: Timeframe) => {
    const baseDaily = dailyTarget || targetDailyHours || 3;
    if (tf === 'today') return baseDaily;
    if (tf === 'week') return baseDaily * 7;
    return baseDaily * getDaysInCurrentMonth();
  };

  const getTimeframeTitle = (tf: Timeframe) => {
    if (tf === 'today') return 'Daily Goal Progress';
    if (tf === 'week') return 'Weekly Goal Progress';
    return 'Monthly Goal Progress';
  };

  const getMinutesForTimeframe = (entry: LeaderboardEntry, tf: Timeframe) => {
    if (tf === 'today') return entry.todayMinutes || 0;
    if (tf === 'week') return entry.thisWeekMinutes || 0;
    return entry.thisMonthMinutes ?? entry.thisWeekMinutes ?? 0;
  };

  // Sort according to active timeframe
  const sortedEntries = [...entries].sort((a, b) => {
    const minA = getMinutesForTimeframe(a, timeframe);
    const minB = getMinutesForTimeframe(b, timeframe);
    return minB - minA;
  });

  const topThree = sortedEntries.slice(0, 3);

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100">
      
      {/* Top Controls & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-zinc-950 dark:text-white flex items-center gap-2">
              Cohort Leaderboard
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                Live Synced
              </span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Ranked by verified 5-minute study focus blocks</p>
          </div>
        </div>

        {/* Timeframe Tabs: Today | This Week | This Month */}
        <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto">
          <button
            onClick={() => setTimeframe('today')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              timeframe === 'today'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            Today
          </button>
          <button
            onClick={() => setTimeframe('week')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              timeframe === 'week'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              timeframe === 'month'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            This Month
          </button>
        </div>
      </div>

      {/* Podium for Top 3 (or Skeleton) */}
      {isLoading && sortedEntries.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col items-center animate-pulse">
              <div className="w-16 h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800 mb-3" />
              <div className="w-24 h-4 rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
              <div className="w-16 h-3 rounded bg-zinc-100 dark:bg-zinc-800 mb-3" />
              <div className="w-20 h-6 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : sortedEntries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          
          {/* 2nd Place */}
          {topThree[1] && (() => {
            const mins = getMinutesForTimeframe(topThree[1], timeframe);
            const hrs = mins / 60;
            const targetHrs = getTimeframeTargetHours(topThree[1].targetDailyHours, timeframe);
            const pct = targetHrs > 0 ? Math.min(100, Math.round((hrs / targetHrs) * 100)) : 0;
            return (
              <div className="order-2 md:order-1 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
                <div className="absolute top-3 right-3 text-zinc-400 font-bold text-xs">#2</div>
                <div className="relative mb-3">
                  <UserAvatar
                    name={topThree[1].userName}
                    avatarUrl={topThree[1].userAvatarUrl}
                    size="2xl"
                    rounded="2xl"
                    className="ring-2 ring-zinc-300 dark:ring-zinc-700 shadow-sm"
                  />
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white flex items-center justify-center font-black text-xs shadow border border-zinc-300 dark:border-zinc-600">
                    2
                  </div>
                </div>

                <h4 className="font-bold text-sm text-zinc-950 dark:text-white truncate max-w-[160px]">{topThree[1].userName}</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">{topThree[1].role}</p>

                <div className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                  {hrs.toFixed(1)} hrs
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pct}%</span> of {timeframe === 'today' ? 'daily' : timeframe === 'week' ? 'weekly' : 'monthly'} target ({targetHrs.toFixed(1)}h)
                </div>
                <p className="text-[10px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1 mt-2 font-medium">
                  <Flame className="w-3 h-3 text-zinc-700 dark:text-zinc-300" />
                  {topThree[1].activeStreakDays} day streak
                </p>
              </div>
            );
          })()}

          {/* 1st Place */}
          {topThree[0] && (() => {
            const mins = getMinutesForTimeframe(topThree[0], timeframe);
            const hrs = mins / 60;
            const targetHrs = getTimeframeTargetHours(topThree[0].targetDailyHours, timeframe);
            const pct = targetHrs > 0 ? Math.min(100, Math.round((hrs / targetHrs) * 100)) : 0;
            return (
              <div className="order-1 md:order-2 bg-white dark:bg-zinc-900 rounded-3xl border-2 border-black dark:border-white p-6 flex flex-col items-center text-center shadow-md relative overflow-hidden md:-translate-y-2">
                <div className="absolute top-3 right-3 text-zinc-950 dark:text-white font-extrabold text-xs flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                  #1 Leader
                </div>
                
                <div className="relative mb-3">
                  <UserAvatar
                    name={topThree[0].userName}
                    avatarUrl={topThree[0].userAvatarUrl}
                    size="3xl"
                    rounded="2xl"
                    className="ring-4 ring-black dark:ring-white shadow-md"
                  />
                  <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-black text-white dark:bg-white dark:text-black flex items-center justify-center font-black text-xs shadow-md">
                    1
                  </div>
                </div>

                <h4 className="font-extrabold text-base text-zinc-950 dark:text-white truncate max-w-[180px]">{topThree[0].userName}</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 font-medium">{topThree[0].role}</p>

                <div className="text-2xl font-black text-zinc-950 dark:text-white">
                  {hrs.toFixed(1)} hrs
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-300 font-medium">
                  <span className="font-bold text-zinc-950 dark:text-white">{pct}%</span> of {timeframe === 'today' ? 'daily' : timeframe === 'week' ? 'weekly' : 'monthly'} target ({targetHrs.toFixed(1)}h)
                </div>
                <p className="text-xs text-zinc-800 dark:text-zinc-200 flex items-center gap-1 mt-2 font-semibold">
                  <Flame className="w-3.5 h-3.5 text-zinc-950 dark:text-white fill-current" />
                  {topThree[0].activeStreakDays} day streak
                </p>
              </div>
            );
          })()}

          {/* 3rd Place */}
          {topThree[2] && (() => {
            const mins = getMinutesForTimeframe(topThree[2], timeframe);
            const hrs = mins / 60;
            const targetHrs = getTimeframeTargetHours(topThree[2].targetDailyHours, timeframe);
            const pct = targetHrs > 0 ? Math.min(100, Math.round((hrs / targetHrs) * 100)) : 0;
            return (
              <div className="order-3 md:order-3 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
                <div className="absolute top-3 right-3 text-zinc-400 font-bold text-xs">#3</div>
                <div className="relative mb-3">
                  <UserAvatar
                    name={topThree[2].userName}
                    avatarUrl={topThree[2].userAvatarUrl}
                    size="2xl"
                    rounded="2xl"
                    className="ring-2 ring-zinc-300 dark:ring-zinc-700 shadow-sm"
                  />
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white flex items-center justify-center font-black text-xs shadow border border-zinc-300 dark:border-zinc-600">
                    3
                  </div>
                </div>

                <h4 className="font-bold text-sm text-zinc-950 dark:text-white truncate max-w-[160px]">{topThree[2].userName}</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">{topThree[2].role}</p>

                <div className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                  {hrs.toFixed(1)} hrs
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{pct}%</span> of {timeframe === 'today' ? 'daily' : timeframe === 'week' ? 'weekly' : 'monthly'} target ({targetHrs.toFixed(1)}h)
                </div>
                <p className="text-[10px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1 mt-2 font-medium">
                  <Flame className="w-3 h-3 text-zinc-700 dark:text-zinc-300" />
                  {topThree[2].activeStreakDays} day streak
                </p>
              </div>
            );
          })()}

        </div>
      ) : null}

      {/* Detailed Ranking Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h4 className="font-bold text-sm text-zinc-950 dark:text-white">Full Cohort Rankings</h4>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{sortedEntries.length} Members</span>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-zinc-800 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Streak</th>
                <th className="py-3 px-4">{getTimeframeTitle(timeframe)}</th>
                <th className="py-3 px-4 text-right">Logged Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {isLoading && sortedEntries.length === 0 ? (
                [1, 2, 3, 4].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-28 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-12 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-8 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-36 h-3 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="w-10 h-4 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No study focus recorded yet for this timeframe. Start a focus session to rank #1!
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry, idx) => {
                  const minutes = getMinutesForTimeframe(entry, timeframe);
                  const hours = minutes / 60;
                  const dailyTarget = entry.targetDailyHours || targetDailyHours || 3;
                  const targetHours = getTimeframeTargetHours(dailyTarget, timeframe);
                  const progressPct = targetHours > 0 ? Math.min(100, Math.round((hours / targetHours) * 100)) : 0;

                  return (
                    <tr key={entry.userId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                      
                      {/* Rank */}
                      <td className="py-3.5 px-4 font-bold text-zinc-700 dark:text-zinc-300">
                        {idx === 0 ? '1' : idx === 1 ? '2' : idx === 2 ? '3' : `${idx + 1}`}
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-3">
                          <UserAvatar
                            name={entry.userName}
                            avatarUrl={entry.userAvatarUrl}
                            size="xs"
                            rounded="lg"
                          />
                          <span className="font-semibold text-zinc-950 dark:text-white truncate max-w-[140px]">
                            {entry.userName}
                          </span>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          {entry.role}
                        </span>
                      </td>

                      {/* Streak */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1 text-zinc-800 dark:text-zinc-200 font-semibold">
                          <Flame className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                          <span>{entry.activeStreakDays}d</span>
                        </div>
                      </td>

                      {/* Dynamic Timeframe Progress Bar */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {hours.toFixed(1)} / {targetHours.toFixed(1)}h
                            </span>
                            <span className="font-bold text-zinc-900 dark:text-white">
                              {progressPct}%
                            </span>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-black dark:bg-white transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-950 dark:text-white text-sm">
                        {hours.toFixed(1)}h
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

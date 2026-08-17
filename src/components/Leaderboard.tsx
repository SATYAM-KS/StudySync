import React, { useState, useEffect } from 'react';
import { LeaderboardEntry } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { useStudy } from '../context/StudyContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { 
  Trophy, 
  Flame, 
  Crown,
  Code2,
  Terminal,
  ExternalLink,
  Medal,
  Sparkles,
  TrendingUp
} from 'lucide-react';

interface LeaderboardProps {
  campaignId: string;
  targetDailyHours: number;
}

type Timeframe = 'today' | 'week' | 'month';

export function normalizeLeetcodeUrl(val?: string | null): string {
  if (!val || !val.trim()) return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.includes('leetcode.com')) return `https://${trimmed}`;
  const username = trimmed.replace(/^@/, '');
  return `https://leetcode.com/u/${username}`;
}

export function normalizeHackerrankUrl(val?: string | null): string {
  if (!val || !val.trim()) return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.includes('hackerrank.com')) return `https://${trimmed}`;
  const username = trimmed.replace(/^@/, '');
  return `https://www.hackerrank.com/profile/${username}`;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ campaignId, targetDailyHours }) => {
  const { socket } = useSocket();
  const { todayTargetHours: userDailyTarget } = useStudy();
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

    if (!socket) return;
    const handleUpdate = () => {
      fetchLeaderboard();
    };

    socket.on('study:block_logged', handleUpdate);
    socket.on('campaign:member_joined', handleUpdate);

    return () => {
      socket.off('study:block_logged', handleUpdate);
      socket.off('campaign:member_joined', handleUpdate);
    };
  }, [campaignId, socket]);

  // Real-time local study events
  useEffect(() => {
    const handleLocalEvent = () => {
      fetchLeaderboard();
    };
    window.addEventListener('study:block_logged', handleLocalEvent);
    return () => {
      window.removeEventListener('study:block_logged', handleLocalEvent);
    };
  }, [campaignId]);

  const getDaysInCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  };

  const getTimeframeTargetHours = (userTarget: number | undefined, tf: Timeframe) => {
    const baseDaily = userTarget || targetDailyHours || 4;
    if (tf === 'today') return baseDaily;
    if (tf === 'week') return 34; // 5 days @ 4h + 2 days @ 7h
    return baseDaily * getDaysInCurrentMonth();
  };

  const getMinutesForTimeframe = (entry: LeaderboardEntry, tf: Timeframe) => {
    if (tf === 'today') return entry.todayMinutes;
    if (tf === 'week') return entry.thisWeekMinutes;
    return entry.thisMonthMinutes;
  };

  const getTimeframeTitle = (tf: Timeframe) => {
    if (tf === 'today') return "Today's Focus Target";
    if (tf === 'week') return "Weekly Focus Target";
    return "Monthly Focus Target";
  };

  const sortedEntries = [...entries].sort((a, b) => {
    return getMinutesForTimeframe(b, timeframe) - getMinutesForTimeframe(a, timeframe);
  });

  const topThree = sortedEntries.slice(0, 3);

  const renderCodingBadges = (entry: LeaderboardEntry, variant: 'podium' | 'table') => {
    const leetcodeRaw = entry.leetcodeUrl || (entry as any).leetcodeUsername;
    const hackerrankRaw = entry.hackerrankUrl || (entry as any).hackerrankUsername;

    const leetcodeUrl = normalizeLeetcodeUrl(leetcodeRaw);
    const hackerrankUrl = normalizeHackerrankUrl(hackerrankRaw);

    if (!leetcodeUrl && !hackerrankUrl) {
      if (variant === 'table') {
        return <span className="text-[11px] text-zinc-400/50 font-mono">—</span>;
      }
      return null;
    }

    if (variant === 'podium') {
      return (
        <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
          {leetcodeUrl && (
            <a
              href={leetcodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition cursor-pointer shadow-xs"
              title="LeetCode Profile"
            >
              <Code2 className="w-3 h-3 text-amber-500" />
              <span>LeetCode</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}
          {hackerrankUrl && (
            <a
              href={hackerrankUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition cursor-pointer shadow-xs"
              title="HackerRank Profile"
            >
              <Terminal className="w-3 h-3 text-emerald-500" />
              <span>HackerRank</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5">
        {leetcodeUrl && (
          <a
            href={leetcodeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition cursor-pointer text-[10px] font-mono font-bold"
            title="View LeetCode Profile"
          >
            <Code2 className="w-3 h-3 text-amber-500" />
            <span>LeetCode</span>
            <ExternalLink className="w-2 h-2 opacity-50" />
          </a>
        )}
        {hackerrankUrl && (
          <a
            href={hackerrankUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition cursor-pointer text-[10px] font-mono font-bold"
            title="View HackerRank Profile"
          >
            <Terminal className="w-3 h-3 text-emerald-500" />
            <span>HackerRank</span>
            <ExternalLink className="w-2 h-2 opacity-50" />
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 text-zinc-900 dark:text-zinc-100 pb-8 select-none">
      
      {/* Top Controls & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-panel p-5 rounded-2xl shadow-sm transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-950 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-xs">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-zinc-950 dark:text-white flex items-center gap-2">
              Cohort Leaderboard
              <span className="text-[10px] px-2.5 py-0.5 rounded-full glass-pill text-zinc-700 dark:text-zinc-300 font-mono">
                Live Synced
              </span>
            </h3>
            <p className="text-xs text-zinc-400">Rankings based on verified AI study minutes</p>
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

      {/* ═══ Posh Top 3 Podium Cards (Inspired by Reference Designs) ═══ */}
      {isLoading && sortedEntries.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="posh-card rounded-3xl p-6 flex flex-col items-center animate-pulse">
              <div className="w-16 h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800 mb-3" />
              <div className="w-28 h-4 rounded bg-zinc-200 dark:bg-zinc-800 mb-2" />
              <div className="w-16 h-3 rounded bg-zinc-100 dark:bg-zinc-800 mb-3" />
              <div className="w-20 h-6 rounded bg-zinc-200 dark:bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : sortedEntries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 items-end">
          
          {/* 2nd Place (Silver Podium) */}
          {topThree[1] && (() => {
            const mins = getMinutesForTimeframe(topThree[1], timeframe);
            const hrs = mins / 60;
            const targetHrs = getTimeframeTargetHours(topThree[1].targetDailyHours, timeframe);
            const pct = targetHrs > 0 ? Math.min(100, Math.round((hrs / targetHrs) * 100)) : 0;
            return (
              <div className="order-2 md:order-1 posh-card rounded-3xl p-6 flex flex-col items-center text-center shadow-md relative overflow-hidden group">
                <div className="absolute top-4 right-4 text-zinc-400 font-mono font-bold text-xs">#2</div>
                
                <div className="relative mb-3">
                  <UserAvatar
                    name={topThree[1].userName}
                    avatarUrl={topThree[1].userAvatarUrl}
                    size="xl"
                    rounded="2xl"
                    className="ring-2 ring-zinc-300 dark:ring-zinc-600 shadow-md group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center font-black text-xs border border-zinc-400 dark:border-zinc-600 shadow-sm">
                    2
                  </div>
                </div>

                <h4 className="font-extrabold text-base text-zinc-950 dark:text-white truncate max-w-[160px]">{topThree[1].userName}</h4>
                <p className="text-[10px] text-zinc-400 mb-1 font-mono uppercase tracking-wider">{topThree[1].role}</p>

                {renderCodingBadges(topThree[1], 'podium')}

                <div className="text-2xl font-black text-zinc-950 dark:text-white font-mono mt-3">
                  {hrs.toFixed(1)} <span className="text-xs font-normal text-zinc-400">hrs</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500 font-mono">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{pct}%</span> of target ({targetHrs.toFixed(1)}h)
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 mt-2 font-mono font-medium">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  {topThree[1].activeStreakDays}d streak
                </p>
              </div>
            );
          })()}

          {/* 1st Place (Gold Champion Podium) */}
          {topThree[0] && (() => {
            const mins = getMinutesForTimeframe(topThree[0], timeframe);
            const hrs = mins / 60;
            const targetHrs = getTimeframeTargetHours(topThree[0].targetDailyHours, timeframe);
            const pct = targetHrs > 0 ? Math.min(100, Math.round((hrs / targetHrs) * 100)) : 0;
            return (
              <div className="order-1 md:order-2 posh-card rounded-3xl p-7 flex flex-col items-center text-center shadow-xl relative overflow-hidden md:-translate-y-3 group border-2 border-zinc-950/80 dark:border-white/40">
                
                {/* Ambient Gold Radial Flare */}
                <div className="absolute -top-10 -right-10 w-36 h-36 bg-amber-500/15 rounded-full blur-2xl pointer-events-none" />

                <div className="absolute top-4 right-4 text-zinc-950 dark:text-white font-bold text-xs flex items-center gap-1 font-mono">
                  <Crown className="w-4 h-4 fill-amber-400 text-amber-500 animate-pulse" />
                  <span>#1</span>
                </div>
                
                <div className="relative mb-3.5">
                  <UserAvatar
                    name={topThree[0].userName}
                    avatarUrl={topThree[0].userAvatarUrl}
                    size="2xl"
                    rounded="2xl"
                    className="ring-4 ring-amber-400/40 dark:ring-amber-400/30 shadow-xl group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-black flex items-center justify-center font-black text-xs shadow-md border-2 border-amber-400">
                    1
                  </div>
                </div>

                <h4 className="font-black text-lg text-zinc-950 dark:text-white truncate max-w-[180px]">{topThree[0].userName}</h4>
                <p className="text-[10px] text-zinc-400 mb-1 font-mono uppercase tracking-wider">{topThree[0].role}</p>

                {renderCodingBadges(topThree[0], 'podium')}

                <div className="text-3xl font-black text-zinc-950 dark:text-white font-mono mt-3">
                  {hrs.toFixed(1)} <span className="text-sm font-normal text-zinc-400">hrs</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500 font-mono">
                  <span className="font-bold text-zinc-950 dark:text-white">{pct}%</span> of target ({targetHrs.toFixed(1)}h)
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 mt-2.5 font-mono font-semibold">
                  <Flame className="w-4 h-4 text-amber-500 fill-current" />
                  {topThree[0].activeStreakDays}d streak
                </p>
              </div>
            );
          })()}

          {/* 3rd Place (Bronze Podium) */}
          {topThree[2] && (() => {
            const mins = getMinutesForTimeframe(topThree[2], timeframe);
            const hrs = mins / 60;
            const targetHrs = getTimeframeTargetHours(topThree[2].targetDailyHours, timeframe);
            const pct = targetHrs > 0 ? Math.min(100, Math.round((hrs / targetHrs) * 100)) : 0;
            return (
              <div className="order-3 md:order-3 posh-card rounded-3xl p-6 flex flex-col items-center text-center shadow-md relative overflow-hidden group">
                <div className="absolute top-4 right-4 text-zinc-400 font-mono font-bold text-xs">#3</div>
                
                <div className="relative mb-3">
                  <UserAvatar
                    name={topThree[2].userName}
                    avatarUrl={topThree[2].userAvatarUrl}
                    size="xl"
                    rounded="2xl"
                    className="ring-2 ring-zinc-300 dark:ring-zinc-600 shadow-md group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute -bottom-2 -right-2 w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 flex items-center justify-center font-black text-xs border border-zinc-400 dark:border-zinc-600 shadow-sm">
                    3
                  </div>
                </div>

                <h4 className="font-extrabold text-base text-zinc-950 dark:text-white truncate max-w-[160px]">{topThree[2].userName}</h4>
                <p className="text-[10px] text-zinc-400 mb-1 font-mono uppercase tracking-wider">{topThree[2].role}</p>

                {renderCodingBadges(topThree[2], 'podium')}

                <div className="text-2xl font-black text-zinc-950 dark:text-white font-mono mt-3">
                  {hrs.toFixed(1)} <span className="text-xs font-normal text-zinc-400">hrs</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500 font-mono">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">{pct}%</span> of target ({targetHrs.toFixed(1)}h)
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 mt-2 font-mono font-medium">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  {topThree[2].activeStreakDays}d streak
                </p>
              </div>
            );
          })()}

        </div>
      ) : null}

      {/* Detailed Ranking Table */}
      <div className="posh-card rounded-3xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-zinc-200/60 dark:border-white/[0.08] flex items-center justify-between">
          <h4 className="font-bold text-sm sm:text-base text-zinc-950 dark:text-white">Full Cohort Rankings</h4>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 glass-pill px-3 py-1 rounded-full font-mono">{sortedEntries.length} Members</span>
        </div>

        <div className="divide-y divide-zinc-200/60 dark:divide-white/[0.06] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-100/60 dark:bg-zinc-800/30 text-zinc-500 dark:text-zinc-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="py-3.5 px-4">Rank</th>
                <th className="py-3.5 px-4">Student</th>
                <th className="py-3.5 px-4">Coding Profiles</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Streak</th>
                <th className="py-3.5 px-4">{getTimeframeTitle(timeframe)}</th>
                <th className="py-3.5 px-4 text-right">Logged Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {isLoading && sortedEntries.length === 0 ? (
                [1, 2, 3, 4].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-3.5 px-4"><div className="w-4 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-28 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-20 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-12 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-8 h-4 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4"><div className="w-36 h-3 bg-zinc-200 dark:bg-zinc-800 rounded" /></td>
                    <td className="py-3.5 px-4 text-right"><div className="w-10 h-4 bg-zinc-200 dark:bg-zinc-800 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : sortedEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No study focus recorded yet for this timeframe. Start a focus session to rank #1!
                  </td>
                </tr>
              ) : (
                sortedEntries.map((entry, idx) => {
                  const minutes = getMinutesForTimeframe(entry, timeframe);
                  const hours = minutes / 60;
                  const dailyTarget = entry.targetDailyHours || targetDailyHours || 4;
                  const targetHours = getTimeframeTargetHours(dailyTarget, timeframe);
                  const progressPct = targetHours > 0 ? Math.min(100, Math.round((hours / targetHours) * 100)) : 0;

                  return (
                    <tr key={entry.userId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                      
                      {/* Rank */}
                      <td className="py-3.5 px-4 font-bold text-zinc-700 dark:text-zinc-300 font-mono">
                        {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${idx + 1}`}
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
                          <span className="font-bold text-zinc-950 dark:text-white truncate max-w-[140px]">
                            {entry.userName}
                          </span>
                        </div>
                      </td>

                      {/* Coding Profiles (LeetCode & HackerRank) */}
                      <td className="py-3.5 px-4">
                        {renderCodingBadges(entry, 'table')}
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          {entry.role}
                        </span>
                      </td>

                      {/* Streak */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1 text-zinc-800 dark:text-zinc-200 font-semibold font-mono">
                          <Flame className="w-3.5 h-3.5 text-amber-500" />
                          <span>{entry.activeStreakDays}d</span>
                        </div>
                      </td>

                      {/* Dynamic Timeframe Progress Bar */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-zinc-500 dark:text-zinc-400">
                              {hours.toFixed(1)} / {targetHours.toFixed(1)}h
                            </span>
                            <span className="font-bold text-zinc-900 dark:text-white">
                              {progressPct}%
                            </span>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden p-0.5">
                            <div 
                              className="h-full rounded-full bg-zinc-950 dark:bg-white transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Time */}
                      <td className="py-3.5 px-4 text-right font-mono font-black text-zinc-950 dark:text-white text-sm">
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

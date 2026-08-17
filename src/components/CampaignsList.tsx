import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Campaign } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useStudy } from '../context/StudyContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { formatTimeTo12h } from '../utils/schedule.ts';
import { 
  Plus, 
  Search, 
  Users, 
  Target, 
  Clock, 
  Calendar, 
  Flame, 
  ArrowRight,
  SlidersHorizontal,
  GraduationCap,
  Lock,
  Hourglass,
  CheckCircle2,
  UserPlus,
  X
} from 'lucide-react';

interface CampaignsListProps {
  campaigns: Campaign[];
  onSelectCampaign: (campaignId: string) => void;
  onOpenCreateModal: () => void;
  onJoinCampaign: (campaignId: string) => Promise<void>;
  isLoading: boolean;
}

export const CampaignsList: React.FC<CampaignsListProps> = ({
  campaigns,
  onSelectCampaign,
  onOpenCreateModal,
  onJoinCampaign,
  isLoading
}) => {
  const { user } = useAuth();
  const { stats, isStudying, activeCampaignId } = useStudy();
  const { activeStudySessions } = useSocket();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [pendingModalCampaign, setPendingModalCampaign] = useState<Campaign | null>(null);

  const categories = ['All', 'Computer Science & Tech', 'Pre-Med & Healthcare', 'Law & Bar Exam', 'Engineering', 'Finance & Accounting', 'Languages', 'General Studies'];

  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];

  const filteredCampaigns = safeCampaigns.filter(c => {
    if (!c) return false;
    const nameMatch = (c.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const descMatch = (c.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const tagMatch = Array.isArray(c.tags) && c.tags.some(t => (t || '').toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesSearch = nameMatch || descMatch || tagMatch;
    const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleJoinClick = async (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    setJoiningId(campaignId);
    try {
      await onJoinCampaign(campaignId);
    } finally {
      setJoiningId(null);
    }
  };

  const handleCardClick = (camp: Campaign) => {
    const isApproved = camp.userStatus === 'approved';
    const isAdmin = camp.userRole === 'admin' || camp.userRole === 'co-admin' || camp.adminId === user?.id;

    if (isApproved || isAdmin) {
      onSelectCampaign(camp.id);
    } else {
      // User is not approved yet (pending or not requested)
      setPendingModalCampaign(camp);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 pt-6 pb-24 text-zinc-900 dark:text-zinc-100" style={{ overscrollBehavior: 'contain' }}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Welcome & Global Focus Header */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                Peer Accountability Platform
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">
                Welcome back, {user?.name?.split(' ')[0] || 'Scholar'}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-xl">
                Select your study cohort below to enter live AI-monitored focus sessions, track sprint targets, and study synchronously with peers.
              </p>
            </div>

            {/* Global User Metric Quick-Cards */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="glass-pill px-4 py-2.5 rounded-2xl flex items-center space-x-3 flex-1 md:flex-initial">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                  <Flame className="w-4 h-4 fill-current" />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-zinc-950 dark:text-white">
                    {stats?.streakDays || 0}d
                  </div>
                  <div className="text-[10px] text-zinc-400">Current Streak</div>
                </div>
              </div>

              <div className="glass-pill px-4 py-2.5 rounded-2xl flex items-center space-x-3 flex-1 md:flex-initial">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-zinc-950 dark:text-white">
                    {stats?.totalFocusMinutes ? (stats.totalFocusMinutes / 60).toFixed(1) : '0.0'}h
                  </div>
                  <div className="text-[10px] text-zinc-400">Total Focus</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cohorts by title, keyword, or tag..."
                className="w-full bg-zinc-100/80 dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-white/[0.08] rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-900 dark:focus:border-white transition backdrop-blur-md"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
              <button
                onClick={onOpenCreateModal}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-extrabold text-xs shadow-sm flex items-center justify-center space-x-2 transition transform active:scale-98 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Cohort</span>
              </button>
            </div>

          </div>

          {/* Category Chips Carousel */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-sm'
                    : 'glass-pill text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Cohorts Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl glass-card p-6 space-y-4 animate-pulse">
                <div className="h-5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
                <div className="h-7 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-lg" />
                <div className="h-12 w-full bg-zinc-100 dark:bg-zinc-800/60 rounded-lg" />
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
                  <div className="h-4 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-16 glass-card rounded-3xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-zinc-950 dark:text-white">No study cohorts found</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                {searchQuery || selectedCategory !== 'All'
                  ? 'Try modifying your search or filter tags.'
                  : 'Be the first to create an accountability study cohort!'}
              </p>
            </div>
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold shadow-sm hover:opacity-90 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Cohort</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCampaigns.map((camp) => {
              const isApproved = camp.userStatus === 'approved';
              const isPending = camp.userStatus === 'pending';
              const isAdmin = camp.userRole === 'admin' || camp.userRole === 'co-admin' || camp.adminId === user?.id;
              const isCurrentStudying = isStudying && activeCampaignId === camp.id;
              const activeInCamp = activeStudySessions.filter(s => s.campaignId === camp.id);
              const canAccess = isApproved || isAdmin;

              return (
                <div
                  key={camp.id}
                  onClick={() => handleCardClick(camp)}
                  className={`group relative rounded-2xl glass-card overflow-hidden flex flex-col cursor-pointer transition hover:shadow-md ${
                    isCurrentStudying
                      ? 'border-emerald-500/80 dark:border-emerald-400/80 ring-1 ring-emerald-500/50 shadow-lg'
                      : ''
                  }`}
                >
                  {/* Banner Strip */}
                  <div className="h-14 bg-zinc-100/60 dark:bg-zinc-800/30 border-b border-zinc-200/60 dark:border-white/[0.06] p-3.5 flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full glass-pill text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                      {camp.category}
                    </span>

                    {/* Status Badge */}
                    <div>
                      {isApproved ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-950 text-white dark:bg-white dark:text-black">
                          {isAdmin ? 'Admin' : 'Member'}
                        </span>
                      ) : isPending ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold uppercase flex items-center gap-1">
                          <Hourglass className="w-2.5 h-2.5 animate-pulse" />
                          <span>Pending Review</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full glass-pill text-zinc-700 dark:text-zinc-300 text-[10px] font-medium flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Request Access</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    
                    <div className="space-y-2">
                      <h3 className="font-bold text-base text-zinc-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition leading-snug">
                        {camp.name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {camp.description || 'Dedicated study cohort for peer accountability and daily target tracking.'}
                      </p>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {(camp.tags || []).slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md glass-pill text-zinc-600 dark:text-zinc-400">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Metrics Specs */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200/60 dark:border-white/[0.06] text-xs text-zinc-500 dark:text-zinc-400">
                      <div className="flex items-center space-x-1.5">
                        <Target className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                        <span>4h / 7h daily goal</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                        <span className="truncate">Flexible anytime</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <Users className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                        <span>{camp.memberCount || 1} / {camp.maxMembers || 20} members</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                        <span className="truncate">Until {camp.endDate}</span>
                      </div>
                    </div>

                    {/* Footer Bar & Actions */}
                    <div className="pt-3 border-t border-zinc-200/60 dark:border-white/[0.06] flex items-center justify-between">
                      
                      {/* Live Studying Indicator */}
                      <div className="flex items-center space-x-1.5 text-[11px]">
                        {activeInCamp.length > 0 ? (
                          <div className="flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>{activeInCamp.length} focus now</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500">Ready</span>
                        )}
                      </div>

                      {/* Join / Enter Button */}
                      {canAccess ? (
                        <button
                          className="flex items-center space-x-1 text-xs font-bold text-zinc-950 dark:text-white group-hover:translate-x-0.5 transition"
                        >
                          <span>Open Lounge</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ) : isPending ? (
                        <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold flex items-center gap-1.5 select-none">
                          <Hourglass className="w-3.5 h-3.5 animate-pulse" />
                          <span>Pending Approval</span>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleJoinClick(e, camp.id)}
                          disabled={joiningId === camp.id}
                          className="px-3.5 py-1.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 font-bold text-xs shadow-sm transition active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title="Request to join this study campaign"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>{joiningId === camp.id ? 'Requesting...' : 'Request to Join'}</span>
                        </button>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Pending / Not-Approved Membership Modal (Portaled) */}
      {pendingModalCampaign && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
                {pendingModalCampaign.userStatus === 'pending' ? (
                  <Hourglass className="w-5 h-5 text-amber-500 animate-pulse" />
                ) : (
                  <UserPlus className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                )}
              </div>
              <button
                onClick={() => setPendingModalCampaign(null)}
                className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {pendingModalCampaign.category}
              </span>
              <h3 className="text-xl font-bold text-zinc-950 dark:text-white">
                {pendingModalCampaign.name}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {pendingModalCampaign.userStatus === 'pending'
                  ? 'Your request to join this campaign is currently awaiting review by the administrator. Once accepted, you will receive full access to the AI Focus Studio, live voice channels, chat, and leaderboard.'
                  : 'This study campaign is restricted to approved cohort members. Request to join below to participate in study sessions with this group.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 text-zinc-600 dark:text-zinc-400">
              <div className="flex justify-between">
                <span>Daily Target:</span>
                <strong className="text-zinc-900 dark:text-white font-bold">{pendingModalCampaign.targetDailyHours}h / day</strong>
              </div>
              <div className="flex justify-between">
                <span>Members:</span>
                <span className="text-zinc-900 dark:text-white font-medium">{pendingModalCampaign.memberCount || 1} / {pendingModalCampaign.maxMembers || 25}</span>
              </div>
              <div className="flex justify-between">
                <span>Host:</span>
                <span className="text-zinc-900 dark:text-white font-medium">{pendingModalCampaign.adminName || 'Cohort Lead'}</span>
              </div>
            </div>

            <div className="flex gap-2.5 pt-1">
              {pendingModalCampaign.userStatus !== 'pending' ? (
                <>
                  <button
                    onClick={() => setPendingModalCampaign(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async (e) => {
                      await handleJoinClick(e, pendingModalCampaign.id);
                      setPendingModalCampaign(null);
                    }}
                    disabled={joiningId === pendingModalCampaign.id}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {joiningId === pendingModalCampaign.id ? 'Requesting...' : 'Request to Join'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setPendingModalCampaign(null)}
                  className="w-full py-2.5 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs shadow-sm hover:opacity-90 transition cursor-pointer"
                >
                  Understood (Awaiting Approval)
                </button>
              )}
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};

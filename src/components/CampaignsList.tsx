import React, { useState } from 'react';
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
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [pendingModalCampaign, setPendingModalCampaign] = useState<Campaign | null>(null);

  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const categories = ['All', ...Array.from(new Set(safeCampaigns.map(c => c?.category).filter(Boolean)))];

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
    await onJoinCampaign(campaignId);
    setJoiningId(null);
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
    <div className="h-full overflow-y-auto px-4 sm:px-8 py-8 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Welcome & Global Focus Header */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Peer Accountability Platform
              </span>
              <h1 className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white tracking-tight">
                Welcome back, {user?.name?.split(' ')[0] || 'Learner'} 👋
              </h1>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-xl">
                Join study cohorts, complete your daily targets, and inspect your focus sessions automatically with AI.
              </p>
            </div>

            {/* Quick Stats Banner */}
            <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <div className="flex-1 sm:flex-initial bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 min-w-[130px] text-center">
                <div className="flex items-center justify-center space-x-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                  <span>Today's Focus</span>
                </div>
                <p className="text-xl font-black text-zinc-950 dark:text-white">{stats?.todayHours || 0}h</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">({stats?.todayMinutes || 0} mins logged)</p>
              </div>

              <div className="flex-1 sm:flex-initial bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 min-w-[130px] text-center">
                <div className="flex items-center justify-center space-x-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  <Flame className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                  <span>Study Streak</span>
                </div>
                <p className="text-xl font-black text-zinc-950 dark:text-white">
                  {stats?.recentDays?.filter(d => d.minutes > 0).length || 1} Days
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">Consistent learner</p>
              </div>

              <div className="flex-1 sm:flex-initial bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3.5 min-w-[130px] text-center">
                <div className="flex items-center justify-center space-x-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                  <GraduationCap className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                  <span>Weekly Total</span>
                </div>
                <p className="text-xl font-black text-zinc-950 dark:text-white">{stats?.thisWeekHours || 0}h</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">{stats?.totalBlocksCount || 0} blocks</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search campaigns by name, topic, or exam..."
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-950 dark:focus:border-white transition"
            />
          </div>

          {/* Action Button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onOpenCreateModal}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-sm shadow-sm transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Campaign</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                  : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Campaign Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700"></div>
            ))}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900/60 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-8">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-500 dark:text-zinc-400">
              <SlidersHorizontal className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-950 dark:text-white mb-1">No study campaigns found</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mb-4">
              Try adjusting your search keywords or create a new campaign for your cohort!
            </p>
            <button
              onClick={onOpenCreateModal}
              className="px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs shadow-sm hover:opacity-90 transition cursor-pointer"
            >
              Create the First One
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
                  className={`group relative rounded-2xl bg-white dark:bg-zinc-900 border transition-all duration-200 overflow-hidden flex flex-col cursor-pointer ${
                    isCurrentStudying
                      ? 'border-zinc-950 dark:border-white shadow-lg ring-1 ring-zinc-950 dark:ring-white'
                      : canAccess
                      ? 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 hover:shadow-md'
                      : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm'
                  }`}
                >
                  {/* Banner Strip */}
                  <div className="h-16 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-800 p-3.5 flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200">
                      {camp.category}
                    </span>

                    {/* Status Badge */}
                    <div>
                      {isApproved ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black text-white dark:bg-white dark:text-black">
                          {isAdmin ? 'Admin' : 'Member'}
                        </span>
                      ) : isPending ? (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 text-[10px] font-bold uppercase flex items-center gap-1">
                          <Hourglass className="w-2.5 h-2.5" />
                          <span>Pending Review</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-medium flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Request Access</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    
                    <div className="space-y-2">
                      <h3 className="font-bold text-base text-zinc-950 dark:text-white group-hover:underline transition leading-snug">
                        {camp.name}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {camp.description || 'Dedicated study campaign for peer accountability and daily target tracking.'}
                      </p>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {(camp.tags || []).slice(0, 3).map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Metrics Specs */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="flex items-center space-x-1.5">
                        <Target className="w-3.5 h-3.5 text-zinc-800 dark:text-zinc-200 shrink-0" />
                        <span>{camp.targetDailyHours}h daily goal</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-800 dark:text-zinc-200 shrink-0" />
                        <span>{formatTimeTo12h(camp.dailyStartTime)} - {formatTimeTo12h(camp.dailyEndTime)}</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <Users className="w-3.5 h-3.5 text-zinc-800 dark:text-zinc-200 shrink-0" />
                        <span>{camp.memberCount || 1} / {camp.maxMembers} members</span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-800 dark:text-zinc-200 shrink-0" />
                        <span className="truncate">Until {camp.endDate}</span>
                      </div>
                    </div>

                    {/* Footer Bar & Actions */}
                    <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                      
                      {/* Live Studying Indicator */}
                      <div className="flex items-center space-x-1.5 text-[11px]">
                        {activeInCamp.length > 0 ? (
                          <div className="flex items-center space-x-1 text-zinc-900 dark:text-white font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 dark:bg-white animate-pulse"></span>
                            <span>{activeInCamp.length} studying now</span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500">Voice & Chat ready</span>
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
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium flex items-center gap-1">
                          <Hourglass className="w-3 h-3" />
                          <span>Awaiting Review</span>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleJoinClick(e, camp.id)}
                          disabled={joiningId === camp.id}
                          className="px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-black hover:text-white dark:bg-zinc-800 dark:hover:bg-white dark:hover:text-black text-zinc-800 dark:text-zinc-200 font-semibold text-xs border border-zinc-200 dark:border-zinc-700 transition cursor-pointer flex items-center gap-1"
                        >
                          <Lock className="w-3 h-3" />
                          <span>{joiningId === camp.id ? 'Sending...' : 'Request to Join'}</span>
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

      {/* Pending / Not-Approved Membership Modal */}
      {pendingModalCampaign && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
                {pendingModalCampaign.userStatus === 'pending' ? (
                  <Hourglass className="w-5 h-5 text-amber-500 animate-pulse" />
                ) : (
                  <Lock className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
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
                <span className="text-zinc-900 dark:text-white font-medium">{pendingModalCampaign.memberCount || 1} / {pendingModalCampaign.maxMembers}</span>
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
                    className="flex-1 py-2.5 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black hover:opacity-90 text-xs font-bold transition shadow-sm cursor-pointer"
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
        </div>
      )}

    </div>
  );
};

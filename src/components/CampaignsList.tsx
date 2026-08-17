import React, { useState } from 'react';
import { Campaign } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useStudy } from '../context/StudyContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { 
  Plus, 
  Search, 
  Users, 
  Target, 
  Clock, 
  Flame, 
  ArrowRight,
  GraduationCap,
  Lock,
  Hourglass,
  CheckCircle2,
  Sparkles,
  Zap,
  Layers
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
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [pendingModalCampaign, setPendingModalCampaign] = useState<Campaign | null>(null);

  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];

  // Filter cohorts purely by search query (categories completely removed)
  const filteredCampaigns = safeCampaigns.filter(c => {
    if (!c) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = (c.name || '').toLowerCase().includes(q);
    const descMatch = (c.description || '').toLowerCase().includes(q);
    const tagMatch = Array.isArray(c.tags) && c.tags.some(t => (t || '').toLowerCase().includes(q));
    return nameMatch || descMatch || tagMatch;
  });

  const handleCardClick = (camp: Campaign) => {
    const isApproved = camp.userStatus === 'approved';
    const isAdmin = camp.userRole === 'admin' || camp.userRole === 'co-admin' || camp.adminId === user?.id;

    if (isApproved || isAdmin) {
      onSelectCampaign(camp.id);
    } else {
      setPendingModalCampaign(camp);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-8 pt-6 pb-24 text-zinc-900 dark:text-zinc-100 select-none" style={{ overscrollBehavior: 'contain' }}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* ═══ 1. Posh Hero Spotlight Header ═══ */}
        <div className="posh-hero-glow rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden text-zinc-950 dark:text-white">
          
          {/* Subtle Ambient Radial Halos */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xs">
                  Accountability Platform
                </span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full glass-pill border border-zinc-200/80 dark:border-white/10 text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-500" />
                  Live AI Screen Proctor
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black text-zinc-950 dark:text-white tracking-tight leading-tight">
                Welcome back, {user?.name?.split(' ')[0] || 'Scholar'}
              </h1>
              
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Select your study cohort below to enter live AI-monitored focus sessions, track sprint targets, and study synchronously with peers.
              </p>
            </div>

            {/* Global User Metric Quick-Cards */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              
              {/* Current Streak */}
              <div className="posh-card px-5 py-3.5 rounded-2xl flex items-center space-x-3.5 flex-1 md:flex-initial shadow-md">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold shrink-0 border border-amber-500/30">
                  <Flame className="w-5 h-5 fill-amber-500 text-amber-500" />
                </div>
                <div>
                  <div className="text-sm font-mono font-black text-zinc-950 dark:text-white">
                    {stats?.streakDays || 0}d
                  </div>
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Current Streak</div>
                </div>
              </div>

              {/* Total Focus Hours */}
              <div className="posh-card px-5 py-3.5 rounded-2xl flex items-center space-x-3.5 flex-1 md:flex-initial shadow-md">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold shrink-0 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-mono font-black text-zinc-950 dark:text-white">
                    {stats?.totalFocusMinutes ? (stats.totalFocusMinutes / 60).toFixed(1) : '0.0'}h
                  </div>
                  <div className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">Total Focus</div>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* ═══ 2. Search & Action Bar (Categories Removed) ═══ */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Search Input */}
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cohorts by title, keyword, or tag..."
              className="w-full bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl pl-10 pr-4 py-3 text-xs text-zinc-950 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition shadow-sm backdrop-blur-md"
            />
          </div>

          {/* Create Cohort Action */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end">
            <span className="px-4 py-3 rounded-2xl glass-pill text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-center shadow-xs">
              {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'Cohort' : 'Cohorts'}
            </span>

            <button
              onClick={onOpenCreateModal}
              className="px-5 py-3 rounded-2xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-black font-black text-xs shadow-md flex items-center justify-center space-x-2 transition transform active:scale-98 cursor-pointer border border-zinc-800 dark:border-white"
            >
              <Plus className="w-4 h-4" />
              <span>Create Cohort</span>
            </button>
          </div>

        </div>

        {/* ═══ 3. Cohorts Grid (Posh Cards with Deep Elevation) ═══ */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-3xl posh-card p-6 space-y-4 animate-pulse">
                <div className="h-5 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
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
          <div className="text-center py-20 posh-card rounded-3xl space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
              <GraduationCap className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-extrabold text-base text-zinc-950 dark:text-white">No study cohorts found</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'Try modifying your search query.'
                  : 'Be the first to create an accountability study cohort!'}
              </p>
            </div>
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center space-x-1.5 px-5 py-2.5 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-black text-xs font-black shadow-md hover:opacity-90 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Cohort</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((camp) => {
              const isAdmin = camp.userRole === 'admin' || camp.userRole === 'co-admin' || camp.adminId === user?.id;
              const isApproved = isAdmin || camp.userStatus === 'approved';
              const isPending = !isAdmin && camp.userStatus === 'pending';
              const isCurrentStudying = isStudying && activeCampaignId === camp.id;
              const activeInCamp = activeStudySessions.filter(s => s.campaignId === camp.id);

              return (
                <div
                  key={camp.id}
                  onClick={() => handleCardClick(camp)}
                  className={`group relative rounded-3xl posh-card overflow-hidden flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1 ${
                    isCurrentStudying
                      ? 'border-emerald-500/80 dark:border-emerald-400/80 ring-2 ring-emerald-500/50 shadow-xl'
                      : 'hover:shadow-2xl'
                  }`}
                >
                  
                  {/* Top Card Header */}
                  <div className="p-5 pb-3 flex items-center justify-between border-b border-zinc-200/60 dark:border-white/[0.06] bg-zinc-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                        {camp.category || 'Study Group'}
                      </span>
                    </div>

                    {/* Role / Access Badge */}
                    <div>
                      {isApproved ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase tracking-wider bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xs">
                          {isAdmin ? 'Admin' : 'Member'}
                        </span>
                      ) : isPending ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
                          <Hourglass className="w-2.5 h-2.5 animate-pulse" />
                          <span>Pending</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full glass-pill text-zinc-700 dark:text-zinc-300 text-[10px] font-bold flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Request Access</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    
                    <div className="space-y-2">
                      <h3 className="font-black text-xl text-zinc-950 dark:text-white tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {camp.name}
                      </h3>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                        {camp.description || 'Synchronous peer accountability cohort.'}
                      </p>
                    </div>

                    {/* Cohort Key Metrics */}
                    <div className="pt-2 grid grid-cols-2 gap-3 border-t border-zinc-200/60 dark:border-white/[0.06] text-xs">
                      
                      {/* Target Indicator */}
                      <div className="flex items-center space-x-2 text-zinc-700 dark:text-zinc-300">
                        <Target className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="font-bold font-mono text-[11px]">4h / 7h daily</span>
                      </div>

                      {/* Member Capacity */}
                      <div className="flex items-center space-x-2 text-zinc-700 dark:text-zinc-300 justify-end">
                        <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="font-bold font-mono text-[11px]">
                          {camp.memberCount || 1}/{camp.maxMembers || 20}
                        </span>
                      </div>

                    </div>

                  </div>

                  {/* Footer Bar */}
                  <div className="px-6 py-3.5 bg-zinc-50/80 dark:bg-white/[0.03] border-t border-zinc-200/60 dark:border-white/[0.06] flex items-center justify-between">
                    
                    {/* Live Studying Indicator */}
                    {activeInCamp.length > 0 ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                        <span>{activeInCamp.length} studying now</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-zinc-400 font-medium">Lounge ready</span>
                    )}

                    {/* Enter Action */}
                    <div className="flex items-center gap-1 text-xs font-black text-zinc-950 dark:text-white group-hover:translate-x-1 transition-transform">
                      <span>Open Lounge</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>

                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Access Request / Pending Modal */}
      {pendingModalCampaign && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPendingModalCampaign(null)}
        >
          <div 
            className="posh-card max-w-md w-full rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl relative text-zinc-950 dark:text-white"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto">
              {pendingModalCampaign.userStatus === 'pending' ? (
                <Hourglass className="w-6 h-6 text-amber-500 animate-pulse" />
              ) : (
                <Lock className="w-6 h-6 text-zinc-400" />
              )}
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="font-black text-lg text-zinc-950 dark:text-white">
                {pendingModalCampaign.name}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {pendingModalCampaign.userStatus === 'pending'
                  ? 'Your membership request is currently awaiting approval by the cohort admin.'
                  : 'This cohort requires approval before accessing focus sessions and cohort channels.'}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingModalCampaign(null)}
                className="flex-1 py-3 px-4 rounded-xl glass-pill text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition cursor-pointer"
              >
                Close
              </button>

              {pendingModalCampaign.userStatus !== 'pending' && (
                <button
                  type="button"
                  onClick={async () => {
                    setJoiningId(pendingModalCampaign.id);
                    try {
                      await onJoinCampaign(pendingModalCampaign.id);
                      setPendingModalCampaign(null);
                    } finally {
                      setJoiningId(null);
                    }
                  }}
                  disabled={joiningId === pendingModalCampaign.id}
                  className="flex-1 py-3 px-4 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-black text-xs font-black shadow-md hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                >
                  {joiningId === pendingModalCampaign.id ? 'Requesting...' : 'Request Access'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

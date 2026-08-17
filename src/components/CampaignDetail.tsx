import React, { useState, useEffect } from 'react';
import { Campaign } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { useStudy } from '../context/StudyContext.tsx';
import { FocusLounge } from './FocusLounge.tsx';
import { Leaderboard } from './Leaderboard.tsx';
import { StudyHistory } from './StudyHistory.tsx';
import { AdminSettingsModal } from './AdminSettingsModal.tsx';
import { 
  ArrowLeft, 
  Trophy, 
  History,
  Settings, 
  Users, 
  Clock, 
  Target, 
  Calendar,
  Sparkles,
  Lock,
  Hourglass
} from 'lucide-react';
import { checkScheduleStatus, sortSlotsChronologically, formatTimeTo12h, calculateSlotHours } from '../utils/schedule.ts';

interface CampaignDetailProps {
  campaignId: string;
  onBack: () => void;
  onCampaignDeleted: () => void;
}

type TabType = 'focus' | 'leaderboard' | 'history';

export const CampaignDetail: React.FC<CampaignDetailProps> = ({
  campaignId,
  onBack,
  onCampaignDeleted
}) => {
  const { user, token } = useAuth();
  const { joinCampaignRoom, leaveCampaignRoom, activeStudySessions, onlineUserIds } = useSocket();
  const { collegeRoutine, todayTargetHours, setShowRoutineModal } = useStudy();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const saved = sessionStorage.getItem('study_tab_' + campaignId);
    if (saved === 'focus' || saved === 'leaderboard' || saved === 'history') {
      return saved as TabType;
    }
    return 'focus';
  });
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);

  const handleRequestJoin = async () => {
    if (!token) return;
    setIsRequestingJoin(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchCampaign();
      }
    } catch (e) {
      console.error('Failed to request join:', e);
    } finally {
      setIsRequestingJoin(false);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    sessionStorage.setItem('study_tab_' + campaignId, tab);
  };

  const fetchCampaign = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/campaigns/${campaignId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setCampaign(data);
      }
    } catch (e) {
      console.error('Failed to fetch campaign:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const { socket } = useSocket();

  useEffect(() => {
    fetchCampaign();
    joinCampaignRoom(campaignId);

    if (!socket) return () => leaveCampaignRoom(campaignId);

    const onCampUpdated = (updated: Campaign) => {
      if (updated.id === campaignId) {
        setCampaign(prev => prev ? { ...prev, ...updated } : updated);
      }
    };

    const onMembershipChanged = (data?: { campaignId?: string }) => {
      if (!data?.campaignId || data.campaignId === campaignId) {
        fetchCampaign();
      }
    };

    socket.on('campaign:updated', onCampUpdated);
    socket.on('campaign:membership_updated', onMembershipChanged);
    socket.on('campaign:member_joined', onMembershipChanged);
    socket.on('campaign:member_left', onMembershipChanged);

    return () => {
      leaveCampaignRoom(campaignId);
      socket.off('campaign:updated', onCampUpdated);
      socket.off('campaign:membership_updated', onMembershipChanged);
      socket.off('campaign:member_joined', onMembershipChanged);
      socket.off('campaign:member_left', onMembershipChanged);
    };
  }, [campaignId, token, socket]);

  if (isLoading || !campaign) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 animate-pulse space-y-6">
        <div className="h-8 w-48 bg-zinc-200 dark:bg-zinc-800 rounded-xl"></div>
        <div className="h-48 bg-zinc-200 dark:bg-zinc-800 rounded-3xl"></div>
        <div className="h-96 bg-zinc-200 dark:bg-zinc-800 rounded-3xl"></div>
      </div>
    );
  }

  const isApprovedMember = campaign.adminId === user?.id || campaign.userStatus === 'approved' || campaign.userRole === 'admin' || campaign.userRole === 'co-admin';

  if (!isApprovedMember) {
    return (
      <div className="h-full flex flex-col text-zinc-900 dark:text-zinc-100 overflow-hidden bg-zinc-50 dark:bg-zinc-950">
        {/* Top bar: back button */}
        <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-xs font-bold text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white glass-pill px-3.5 py-1.5 rounded-xl transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Cohorts</span>
          </button>
        </div>

        {/* Lock screen content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full glass-card p-8 rounded-3xl text-center space-y-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-black flex items-center justify-center mx-auto shadow-md">
              <Lock className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono font-bold uppercase tracking-wider">
                {campaign.category}
              </span>
              <h2 className="text-xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
                {campaign.name}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {campaign.description || 'This is a private accountability study cohort. Membership approval is required to access the Focus Studio, Leaderboard, and Study History.'}
              </p>
            </div>

            <div className="pt-2">
              {campaign.userStatus !== 'pending' ? (
                <button
                  onClick={handleRequestJoin}
                  disabled={isRequestingJoin}
                  className="w-full py-3 px-5 rounded-2xl bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black text-xs font-black shadow-md flex items-center justify-center space-x-2 transition transform active:scale-98 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isRequestingJoin ? 'Submitting Request...' : 'Request Access to Join'}</span>
                </button>
              ) : (
                <div className="flex-1 py-3 px-5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold flex items-center justify-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5 animate-pulse" />
                  <span>Awaiting Approval</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAdminOrCoAdmin = campaign.adminId === user?.id || campaign.userRole === 'admin' || campaign.userRole === 'co-admin';
  const activeInThisCamp = activeStudySessions.filter(s => s.campaignId === campaign.id);

  return (
    <div className="h-full flex text-zinc-900 dark:text-zinc-100 overflow-hidden">

      {/* ═══ LEFT PANEL: Campaign sidebar with All Cohorts + Admin ═══ */}
      <div className="w-72 shrink-0 flex flex-col border-r border-zinc-200/80 dark:border-white/[0.08] glass-panel overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
        
        {/* Top sidebar action bar: All Cohorts & Admin */}
        <div className="h-14 px-3.5 border-b border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2 shrink-0 glass-nav">
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 text-xs font-bold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white glass-pill hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 px-3 py-1.5 rounded-xl transition cursor-pointer active:scale-95 border border-zinc-200/80 dark:border-white/[0.08]"
            title="Back to all cohorts"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Cohorts</span>
          </button>

          {isAdminOrCoAdmin && (
            <button
              onClick={() => setShowAdminModal(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl glass-pill hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 text-zinc-900 dark:text-white text-xs font-black transition cursor-pointer active:scale-95 border border-zinc-200/80 dark:border-white/[0.08]"
              title="Cohort Admin Settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}
        </div>

        <div className="p-5 space-y-5 flex-1">

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5">
            <span className="px-3 py-1 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-black text-[10px] font-black tracking-wider uppercase shadow-xs">
              {campaign.category}
            </span>
              {(campaign.tags || []).map(t => (
                <span key={t} className="px-2.5 py-0.5 rounded-full glass-pill text-zinc-600 dark:text-zinc-400 text-[10px] font-semibold border border-zinc-200/60 dark:border-white/[0.06]">
                  #{t}
                </span>
              ))}
            </div>

            {/* Name + description */}
            <div className="space-y-1">
              <h1 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white leading-tight">
                {campaign.name}
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {campaign.description || 'Synchronous peer accountability cohort.'}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px bg-zinc-200/60 dark:border-white/[0.06]" />

            {/* Stats */}
            <div className="space-y-3">
              {/* Today's Dynamic Target Card */}
              <div 
                onClick={() => setShowRoutineModal(true)}
                className="p-4 rounded-2xl posh-card border hover:border-zinc-300 dark:hover:border-white/20 transition cursor-pointer group shadow-sm"
                title="Click to calibrate today's study target"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-emerald-500" />
                    Today's Target
                  </span>
                  <span className="text-[10px] text-zinc-400 group-hover:text-zinc-950 dark:group-hover:text-white transition font-bold underline underline-offset-2">
                    Change
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-zinc-950 dark:text-white font-mono">
                    {todayTargetHours}h Goal
                  </span>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                    collegeRoutine === 'college'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                      : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30'
                  }`}>
                    {collegeRoutine === 'college' ? 'College Day' : 'No College'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                  {collegeRoutine === 'college' ? '4h flexible target anytime' : '7h deep work target anytime'}
                </p>
              </div>

              {/* Members */}
              <div className="flex items-center justify-between p-3 rounded-2xl glass-pill border border-zinc-200/80 dark:border-white/[0.08] text-xs">
                <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
                  <div className="w-7 h-7 rounded-xl bg-zinc-200/80 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-extrabold">Cohort Size</p>
                    <p className="font-mono font-black text-zinc-900 dark:text-white">{campaign.memberCount || 1} / {campaign.maxMembers || 20}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400 font-bold">
                  {Math.round(((campaign.memberCount || 1) / (campaign.maxMembers || 20)) * 100)}%
                </span>
              </div>

            </div>

            {/* Live Presence Status (Online & Focus) */}
            <div className="h-px bg-zinc-200/60 dark:border-white/[0.06]" />
            <div className="flex items-center justify-center space-x-2.5 text-xs text-zinc-600 dark:text-zinc-300 glass-pill px-3.5 py-2 rounded-full shadow-2xs border border-zinc-200/80 dark:border-white/[0.08]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
              <span className="font-semibold">{onlineUserIds.length} online</span>
              {activeStudySessions.length > 0 && (
                <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  · {activeStudySessions.length} focus
                </span>
              )}
            </div>
          </div>
      </div>

      {/* ═══ RIGHT PANEL: Content ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Sub-nav Header: Centered Cohort Tabs */}
        <div className="h-14 px-4 sm:px-6 border-b border-zinc-200/80 dark:border-white/[0.08] flex items-center justify-center shrink-0 glass-nav">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full glass-pill p-1 rounded-2xl border border-zinc-200/80 dark:border-white/[0.08] shadow-xs">
            {([ 
              { id: 'focus',       icon: Clock,         label: 'Focus Studio',      badge: activeInThisCamp.length > 0 ? '●' : null },
              { id: 'leaderboard', icon: Trophy,        label: 'Leaderboard',       badge: null },
              { id: 'history',     icon: History,       label: 'Study History',     badge: null },
            ] as const).map(({ id, icon: Icon, label, badge }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex items-center gap-2 px-4.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === id
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-md'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
                {badge === '●' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.9)]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content — fills remaining height with instant 0ms CSS-preserved switching */}
        <div className="flex-1 overflow-hidden relative">
          <div
            className="h-full overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-24"
            style={{
              overscrollBehavior: 'contain',
              display: activeTab === 'focus' ? 'block' : 'none'
            }}
          >
            <FocusLounge campaign={campaign} />
          </div>

          <div
            className="h-full overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-24"
            style={{
              overscrollBehavior: 'contain',
              display: activeTab === 'leaderboard' ? 'block' : 'none'
            }}
          >
            <Leaderboard campaignId={campaign.id} targetDailyHours={campaign.targetDailyHours} />
          </div>

          <div
            className="h-full overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-24"
            style={{
              overscrollBehavior: 'contain',
              display: activeTab === 'history' ? 'block' : 'none'
            }}
          >
            <StudyHistory 
              campaignId={campaign.id} 
              campaignName={campaign.name}
              targetDailyHours={campaign.targetDailyHours} 
              campaignCreatedAt={campaign.createdAt || campaign.startDate}
            />
          </div>
        </div>
      </div>

      {/* Admin Modal */}
      {showAdminModal && (
        <AdminSettingsModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          campaign={campaign}
          onCampaignUpdated={(updated) => {
            setCampaign(updated);
            setShowAdminModal(false);
          }}
          onCampaignDeleted={onCampaignDeleted}
        />
      )}
    </div>
  );
};

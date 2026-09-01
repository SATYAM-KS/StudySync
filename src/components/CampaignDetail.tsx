import React, { useState, useEffect } from 'react';
import { Campaign } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { useStudy } from '../context/StudyContext.tsx';
import { FocusLounge } from './FocusLounge.tsx';
import { Leaderboard } from './Leaderboard.tsx';
import { StudyHistory } from './StudyHistory.tsx';
import { AdminSettingsModal } from './AdminSettingsModal.tsx';
import { SyllabusModal } from './SyllabusModal.tsx';
import { exportSyllabusToPdf } from '../utils/pdf.ts';
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
  Hourglass,
  BookOpen,
  Download,
  FileText
} from 'lucide-react';
import { checkScheduleStatus, sortSlotsChronologically, formatTimeTo12h, calculateSlotHours } from '../utils/schedule.ts';

interface CampaignDetailProps {
  campaignId: string;
  onBack: () => void;
  onCampaignDeleted: () => void;
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

type TabType = 'focus' | 'leaderboard' | 'history';

export const CampaignDetail: React.FC<CampaignDetailProps> = ({
  campaignId,
  onBack,
  onCampaignDeleted,
  activeTab: controlledActiveTab,
  onTabChange
}) => {
  const { user, token } = useAuth();
  const { joinCampaignRoom, leaveCampaignRoom, activeStudySessions, onlineUserIds } = useSocket();
  const { 
    collegeRoutine, 
    todayTargetHours, 
    dailyTargetHours,
    setShowRoutineModal,
    isStudying,
    sessionElapsedSeconds,
    activeCampaignId,
    activeCampaignName
  } = useStudy();

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [internalTab, setInternalTab] = useState<TabType>(() => {
    const saved = sessionStorage.getItem('study_tab_' + campaignId);
    if (saved === 'focus' || saved === 'leaderboard' || saved === 'history') {
      return saved as TabType;
    }
    return 'focus';
  });

  const activeTab = controlledActiveTab || internalTab;

  const handleTabChange = (tab: TabType) => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalTab(tab);
      sessionStorage.setItem('study_tab_' + campaignId, tab);
    }
  };
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequestingJoin, setIsRequestingJoin] = useState(false);

  // When a user starts with or opens a cohort, ensure their daily target is calibrated
  useEffect(() => {
    if (campaign && user) {
      const todayKey = new Date(Date.now() - 2 * 3600 * 1000).toISOString().split('T')[0];
      const saved = localStorage.getItem(`study_daily_target_hours_${user.id}_${todayKey}`) || localStorage.getItem(`study_daily_target_hours_${todayKey}`);
      if (!saved && dailyTargetHours === null) {
        setShowRoutineModal(true);
      }
    }
  }, [campaign?.id, user?.id]);

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

            {/* Name */}
            <div className="space-y-1">
              <h1 className="text-xl font-black tracking-tight text-zinc-950 dark:text-white leading-tight">
                {campaign.name}
              </h1>
            </div>

            {/* Syllabus & Curriculum Section */}
            <div className="p-3.5 rounded-2xl glass-card border border-zinc-200/80 dark:border-white/[0.08] space-y-2.5 bg-zinc-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Cohort Syllabus
                </span>
                <span className="text-[10px] font-mono text-zinc-400">PDF Ready</span>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowSyllabusModal(true)}
                  className="flex-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-white dark:hover:bg-zinc-200 dark:text-black text-xs font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Syllabus</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportSyllabusToPdf(campaign)}
                  title="Export Syllabus to PDF"
                  className="py-2 px-3 rounded-xl bg-zinc-200/80 hover:bg-zinc-300 dark:bg-white/10 dark:hover:bg-white/15 text-zinc-800 dark:text-zinc-200 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-zinc-200/60 dark:border-white/[0.06]" />

            {/* Stats */}
            <div className="space-y-3">
              {/* Today's Target Card (Locked for the day) */}
              <div className="p-4 rounded-2xl posh-card border shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-emerald-500" />
                    Today's Target
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRoutineModal(true)}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-mono font-bold transition cursor-pointer"
                    title="Recalibrate your daily study target"
                  >
                    Change (2 AM Reset)
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-black text-zinc-950 dark:text-white font-mono">
                    {todayTargetHours}h Goal
                  </span>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                    {todayTargetHours <= 2 ? 'Light Target' : todayTargetHours <= 4 ? 'Standard Target' : todayTargetHours <= 7 ? 'Deep Work' : 'Elite Target'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
                  {todayTargetHours}h flexible focus target (2 AM reset)
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

            {/* Active Focus Session in Sidebar */}
            {isStudying && (
              <>
                <div className="h-px bg-zinc-200/60 dark:border-white/[0.06]" />
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-xs shadow-xs animate-pulse">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" style={{ animationDuration: '2s' }} />
                    <span className="font-bold text-emerald-900 dark:text-emerald-300 truncate">
                      {activeCampaignId === campaign.id ? 'Focusing in this Cohort' : `Focusing: ${activeCampaignName}`}
                    </span>
                  </div>
                  <span className="font-mono font-bold bg-zinc-950 text-white dark:bg-white dark:text-black px-2.5 py-0.5 rounded-md text-[11px] shadow-xs shrink-0 ml-2">
                    {formatTimer(sessionElapsedSeconds)}
                  </span>
                </div>
              </>
            )}

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

      {/* Syllabus & Curriculum Modal with PDF Export */}
      {showSyllabusModal && (
        <SyllabusModal
          isOpen={showSyllabusModal}
          onClose={() => setShowSyllabusModal(false)}
          campaign={campaign}
          isAdmin={campaign.adminId === user?.id || campaign.userRole === 'admin' || campaign.userRole === 'co-admin'}
          onEditSyllabus={() => setShowAdminModal(true)}
        />
      )}
    </div>
  );
};

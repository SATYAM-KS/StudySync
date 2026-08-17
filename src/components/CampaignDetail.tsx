import React, { useState, useEffect } from 'react';
import { Campaign } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { useCall } from '../context/CallContext.tsx';
import { FocusLounge } from './FocusLounge.tsx';
import { Leaderboard } from './Leaderboard.tsx';
import { StudyHistory } from './StudyHistory.tsx';
import { ChatRoom } from './ChatRoom.tsx';
import { VoiceRoom } from './VoiceRoom.tsx';
import { AdminSettingsModal } from './AdminSettingsModal.tsx';
import { 
  ArrowLeft, 
  Trophy, 
  History,
  MessageSquare, 
  Headphones, 
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

type TabType = 'focus' | 'leaderboard' | 'history' | 'chat' | 'voice';

export const CampaignDetail: React.FC<CampaignDetailProps> = ({
  campaignId,
  onBack,
  onCampaignDeleted
}) => {
  const { user, token } = useAuth();
  const { joinCampaignRoom, leaveCampaignRoom, activeStudySessions } = useSocket();
  const { isInCall, activeCampaignId } = useCall();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    return (sessionStorage.getItem('study_tab_' + campaignId) as TabType) || 'focus';
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
    if (tab === 'chat') {
      window.dispatchEvent(new CustomEvent('chat:scroll_to_bottom'));
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
      console.error('Failed to load campaign:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaign();
    joinCampaignRoom(campaignId);

    return () => {
      leaveCampaignRoom(campaignId);
    };
  }, [campaignId, token]);

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
            className="flex items-center space-x-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Campaigns</span>
          </button>
        </div>

        {/* Access Locked Card */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 max-w-lg w-full text-center space-y-5 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-900 dark:text-white">
              {campaign.userStatus === 'pending' ? (
                <Hourglass className="w-7 h-7 text-amber-500 animate-pulse" />
              ) : (
                <Lock className="w-7 h-7 text-zinc-700 dark:text-zinc-300" />
              )}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                {campaign.category}
              </span>
              <h2 className="text-2xl font-black text-zinc-950 dark:text-white">
                {campaign.name}
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                {campaign.userStatus === 'pending'
                  ? 'Your membership request is currently awaiting review by the campaign host. You cannot open the study lounge, live voice room, or cohort chat until you are accepted.'
                  : 'This study campaign requires approval from the cohort admin. Request to join below to participate in study sessions with this group.'}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={onBack}
                className="flex-1 py-3 px-5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Back to All Cohorts
              </button>
              {campaign.userStatus !== 'pending' ? (
                <button
                  onClick={handleRequestJoin}
                  disabled={isRequestingJoin}
                  className="flex-1 py-3 px-5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs shadow-sm hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isRequestingJoin ? 'Requesting...' : 'Request to Join'}</span>
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
  const isCallActive = isInCall && activeCampaignId === campaign.id;

  return (
    <div className="h-full flex flex-col text-zinc-900 dark:text-zinc-100 overflow-hidden">

      {/* ── Top bar: back + admin ── full width, always pinned */}
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-200/60 dark:border-white/[0.08] glass-nav">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white glass-pill hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 px-3.5 py-2 rounded-xl transition cursor-pointer active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Cohorts</span>
        </button>

        {isAdminOrCoAdmin && (
          <button
            onClick={() => setShowAdminModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl glass-pill hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 text-zinc-900 dark:text-white text-xs font-bold transition cursor-pointer active:scale-95"
          >
            <Settings className="w-4 h-4" />
            <span>Admin Settings</span>
          </button>
        )}
      </div>

      {/* ── Two-column body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ═══ LEFT PANEL: Campaign info ═══ */}
        <div className="w-72 shrink-0 flex flex-col border-r border-zinc-200/60 dark:border-white/[0.08] glass-panel overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <div className="p-5 space-y-5">

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-full bg-zinc-950 text-white dark:bg-white dark:text-black text-[10px] font-bold tracking-wide uppercase">
                {campaign.category}
              </span>
              {(campaign.tags || []).map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full glass-pill text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
                  #{t}
                </span>
              ))}
            </div>

            {/* Name + description */}
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-zinc-950 dark:text-white leading-tight">
                {campaign.name}
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 leading-relaxed">
                {campaign.description}
              </p>
            </div>

            {/* Divider */}
            <div className="h-px bg-zinc-200/60 dark:border-white/[0.06]" />

            {/* Stats */}
            {(() => {
              const todayStatus = checkScheduleStatus(campaign.schedule, campaign.dailyStartTime, campaign.dailyEndTime);
              return (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                    <div className="w-7 h-7 rounded-lg glass-pill flex items-center justify-center shrink-0">
                      <Target className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide font-semibold">Today's Target</p>
                      <p className="font-bold text-zinc-900 dark:text-white">
                        {todayStatus.todayHours}h {todayStatus.todayHours > 0 ? 'today' : '(Rest Day)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                    <div className="w-7 h-7 rounded-lg glass-pill flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide font-semibold mb-1">Preferred Windows (Today)</p>
                      {todayStatus.todaySchedule?.slots && todayStatus.todaySchedule.slots.length > 0 ? (
                        <div className="space-y-1">
                          {sortSlotsChronologically(todayStatus.todaySchedule.slots).map((slot, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs glass-pill px-2.5 py-1 rounded-lg">
                              <span className="font-bold text-zinc-950 dark:text-white">
                                {formatTimeTo12h(slot.startTime)} – {formatTimeTo12h(slot.endTime)}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500 font-semibold ml-1">
                                {calculateSlotHours(slot)}h
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="font-bold text-zinc-500 dark:text-zinc-400 text-xs">
                          {todayStatus.todaySlotsText}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                    <div className="w-7 h-7 rounded-lg glass-pill flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide font-semibold">Members</p>
                      <p className="font-bold text-zinc-900 dark:text-white">{campaign.memberCount || 1} / {campaign.maxMembers || 20}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                    <div className="w-7 h-7 rounded-lg glass-pill flex items-center justify-center shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide font-semibold">End Date</p>
                      <p className="font-bold text-zinc-900 dark:text-white">{campaign.endDate}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Active session indicator */}
            {activeInThisCamp.length > 0 && (
              <>
                <div className="h-px bg-zinc-200/60 dark:border-white/[0.06]" />
                <div className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {activeInThisCamp.length} studying now
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ═══ RIGHT PANEL: Tabs + content ═══ */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tab nav */}
          <div className="shrink-0 flex items-center gap-1.5 px-4 py-2.5 border-b border-zinc-200/60 dark:border-white/[0.08] glass-nav overflow-x-auto">
            {([ 
              { id: 'focus',       icon: Clock,         label: 'Focus Studio',      badge: isCallActive ? null : (activeInThisCamp.length > 0 ? '●' : null) },
              { id: 'leaderboard', icon: Trophy,        label: 'Leaderboard',       badge: null },
              { id: 'history',     icon: History,       label: 'Study History',     badge: null },
              { id: 'chat',        icon: MessageSquare, label: 'Lounge Chat',       badge: null },
              { id: 'voice',       icon: Headphones,    label: 'Voice Channel',     badge: isCallActive ? 'Live' : null },
            ] as const).map(({ id, icon: Icon, label, badge }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                  activeTab === id
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
                {badge === '●' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {badge === 'Live' && <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-900 text-white dark:bg-white dark:text-black font-bold font-mono">Live</span>}
              </button>
            ))}
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
              />
            </div>

            <div
              className="h-full flex flex-col p-3 sm:p-4"
              style={{
                display: activeTab === 'chat' ? 'flex' : 'none'
              }}
            >
              <ChatRoom campaign={campaign} />
            </div>

            {/* VoiceRoom is ALWAYS mounted — hidden with CSS so LiveKit stays connected across tabs */}
            <div
              className="h-full overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-24"
              style={{
                overscrollBehavior: 'contain',
                display: activeTab === 'voice' ? 'block' : 'none'
              }}
            >
              <VoiceRoom campaign={campaign} />
            </div>
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

      {/* Persistent floating call bar — visible on non-voice tabs when in a live call */}
      {isCallActive && activeTab !== 'voice' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xl border border-zinc-800 dark:border-zinc-200 text-xs font-bold animate-in slide-in-from-bottom-4 duration-300">
          <span className="w-2 h-2 rounded-full bg-white dark:bg-zinc-900 animate-pulse shrink-0" />
          <span>Voice & Screen — Live</span>
          <button
            onClick={() => handleTabChange('voice')}
            className="px-3 py-1 rounded-xl bg-white/20 dark:bg-zinc-900/20 hover:bg-white/30 dark:hover:bg-zinc-900/30 text-white dark:text-zinc-950 transition cursor-pointer border border-white/10 dark:border-zinc-900/10"
          >
            Open
          </button>
        </div>
      )}
    </div>
  );
};

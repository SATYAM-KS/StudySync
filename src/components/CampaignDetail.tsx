import React, { useState, useEffect } from 'react';
import { Campaign } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useSocket } from '../context/SocketContext.tsx';
import { useCall } from '../context/CallContext.tsx';
import { FocusLounge } from './FocusLounge.tsx';
import { Leaderboard } from './Leaderboard.tsx';
import { ChatRoom } from './ChatRoom.tsx';
import { VoiceRoom } from './VoiceRoom.tsx';
import { AdminSettingsModal } from './AdminSettingsModal.tsx';
import { 
  ArrowLeft, 
  Trophy, 
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

type TabType = 'focus' | 'leaderboard' | 'chat' | 'voice';

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
                  : 'This study campaign is private. You must request and be accepted by the administrator to access the focus lounge and group channels.'}
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onBack}
                className="w-full py-3 px-6 rounded-xl bg-black dark:bg-white text-white dark:text-black font-bold text-xs shadow-sm hover:opacity-90 transition cursor-pointer"
              >
                Back to All Campaigns
              </button>
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
      <div className="shrink-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-xs font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Campaigns</span>
        </button>

        {isAdminOrCoAdmin && (
          <button
            onClick={() => setShowAdminModal(true)}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 text-xs font-bold transition cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>Admin Settings</span>
          </button>
        )}
      </div>

      {/* ── Two-column body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ═══ LEFT PANEL: Campaign info ═══ */}
        <div className="w-72 shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
          <div className="p-5 space-y-5">

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5">
              <span className="px-2.5 py-1 rounded-full bg-black text-white dark:bg-white dark:text-black text-[10px] font-bold tracking-wide uppercase">
                {campaign.category}
              </span>
              {campaign.tags.map(t => (
                <span key={t} className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
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
            <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

            {/* Stats */}
            {(() => {
              const todayStatus = checkScheduleStatus(campaign.schedule, campaign.dailyStartTime, campaign.dailyEndTime);
              return (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                    <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
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
                    <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide font-semibold mb-1">Preferred Windows (Today)</p>
                      {todayStatus.todaySchedule?.slots && todayStatus.todaySchedule.slots.length > 0 ? (
                        <div className="space-y-1">
                          {sortSlotsChronologically(todayStatus.todaySchedule.slots).map((slot, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-white dark:bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs">
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
                    <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Users className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide font-semibold">Members</p>
                      <p className="font-bold text-zinc-900 dark:text-white">{campaign.memberCount || 1} / {campaign.maxMembers}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                    <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
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
                <div className="h-px bg-zinc-200 dark:bg-zinc-800" />
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
          <div className="shrink-0 flex items-center gap-1 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
            {([ 
              { id: 'focus',       icon: Sparkles,     label: 'Focus Studio',      badge: isCallActive ? null : (activeInThisCamp.length > 0 ? '●' : null) },
              { id: 'leaderboard', icon: Trophy,        label: 'Leaderboard',       badge: null },
              { id: 'chat',        icon: MessageSquare, label: 'Lounge Chat',       badge: null },
              { id: 'voice',       icon: Headphones,    label: 'Voice & Screen',    badge: isCallActive ? 'Live' : null },
            ] as const).map(({ id, icon: Icon, label, badge }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeTab === id
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{label}</span>
                {badge === '●' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {badge === 'Live' && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-zinc-900 text-white dark:bg-white dark:text-black font-bold">Live</span>}
              </button>
            ))}
          </div>

          {/* Tab content — fills remaining height */}
          <div className="flex-1 overflow-hidden p-4">
            {activeTab === 'focus' && (
              <div className="h-full overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
                <FocusLounge campaign={campaign} />
              </div>
            )}
            {activeTab === 'leaderboard' && (
              <div className="h-full overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
                <Leaderboard campaignId={campaign.id} targetDailyHours={campaign.targetDailyHours} />
              </div>
            )}
            {activeTab === 'chat' && (
              <div className="h-full flex flex-col">
                <ChatRoom campaign={campaign} />
              </div>
            )}
            {activeTab === 'voice' && (
              <div className="h-full overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
                <VoiceRoom campaign={campaign} />
              </div>
            )}
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

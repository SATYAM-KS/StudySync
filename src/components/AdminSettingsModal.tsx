import React, { useState, useEffect } from 'react';
import { Campaign, CampaignMembership, DaySchedule } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { ScheduleBuilder } from './ScheduleBuilder.tsx';
import { DEFAULT_WEEKLY_SCHEDULE, calculateAverageDailyHours } from '../utils/schedule.ts';
import { 
  X, 
  Shield, 
  UserCheck, 
  UserX, 
  Trash2, 
  Save, 
  Clock, 
  Target, 
  Check, 
  Crown,
  Users
} from 'lucide-react';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  onCampaignUpdated: (campaign: Campaign) => void;
  onCampaignDeleted?: () => void;
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  onClose,
  campaign,
  onCampaignUpdated,
  onCampaignDeleted
}) => {
  const { token, user } = useAuth();

  const [members, setMembers] = useState<CampaignMembership[]>([]);
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description);
  const [schedule, setSchedule] = useState<DaySchedule[]>(campaign.schedule || DEFAULT_WEEKLY_SCHEDULE);
  const [maxMembers, setMaxMembers] = useState(campaign.maxMembers);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'requests' | 'settings'>('requests');
  const [statusMessage, setStatusMessage] = useState('');

  const fetchMembers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (e) {
      console.error('Failed to fetch members:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      setName(campaign.name);
      setDescription(campaign.description);
      setSchedule(campaign.schedule || DEFAULT_WEEKLY_SCHEDULE);
      setMaxMembers(campaign.maxMembers);
    }
  }, [isOpen, campaign.id]);

  if (!isOpen) return null;

  const pendingMembers = members.filter(m => m.status === 'pending');
  const approvedMembers = members.filter(m => m.status === 'approved');

  const handleApprove = async (memberId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'approved' })
      });
      if (res.ok) {
        setStatusMessage('Member approved successfully!');
        fetchMembers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (memberId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'rejected' })
      });
      if (res.ok) {
        setStatusMessage('Join request rejected');
        fetchMembers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        setStatusMessage('Role updated');
        fetchMembers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleKick = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the campaign?')) return;
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setStatusMessage('Member removed');
        fetchMembers();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const autoTargetDailyHours = calculateAverageDailyHours(schedule);
    const firstEnabledDay = schedule.find(d => d.enabled && d.slots.length > 0);
    const fallbackStart = firstEnabledDay?.slots[0]?.startTime || '07:00';
    const fallbackEnd = firstEnabledDay?.slots[firstEnabledDay.slots.length - 1]?.endTime || '22:00';

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          schedule,
          dailyStartTime: fallbackStart,
          dailyEndTime: fallbackEnd,
          targetDailyHours: autoTargetDailyHours,
          maxMembers: Number(maxMembers)
        })
      });

      if (res.ok) {
        const updated = await res.json();
        onCampaignUpdated(updated);
        setStatusMessage('Campaign settings updated successfully!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!confirm('Are you sure you want to permanently delete this campaign and its study logs?')) return;
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        if (onCampaignDeleted) onCampaignDeleted();
        onClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-zinc-900 dark:text-zinc-100 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white">Campaign Admin Controls</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Manage memberships, join requests, and cohort rules</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusMessage && (
          <div className="mb-4 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs flex items-center justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage('')} className="text-zinc-950 dark:text-white font-bold cursor-pointer">×</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-6">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800'
            }`}
          >
            <span>Join Requests</span>
            {pendingMembers.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-white text-[10px] font-black flex items-center justify-center">
                {pendingMembers.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              activeTab === 'members'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800'
            }`}
          >
            <span>Member Roster</span>
            <span className="text-[10px] opacity-70">({approvedMembers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-black text-white dark:bg-white dark:text-black shadow-sm'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800'
            }`}
          >
            <span>Cohort Settings</span>
          </button>
        </div>

        {/* Tab 1: Pending Join Requests */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            {pendingMembers.length === 0 ? (
              <div className="text-center py-12 bg-zinc-50 dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6">
                <UserCheck className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">No pending join requests</p>
                <p className="text-xs text-zinc-500 mt-1">When new students request to join this campaign, they will appear here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingMembers.map((m) => (
                  <div key={m.id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <UserAvatar
                        name={m.userName}
                        avatarUrl={m.userAvatarUrl}
                        size="lg"
                        rounded="xl"
                      />
                      <div>
                        <p className="text-sm font-bold text-zinc-950 dark:text-white">{m.userName}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{m.userEmail}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleApprove(m.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs shadow-sm flex items-center space-x-1 transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        onClick={() => handleReject(m.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs border border-zinc-300 dark:border-zinc-700 flex items-center space-x-1 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Member Roster & Roles */}
        {activeTab === 'members' && (
          <div className="space-y-3">
            {approvedMembers.map((m) => {
              const isCreator = m.userId === campaign.adminId;

              return (
                <div key={m.id} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <UserAvatar
                      name={m.userName}
                      avatarUrl={m.userAvatarUrl}
                      size="lg"
                      rounded="xl"
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-bold text-zinc-950 dark:text-white">{m.userName}</p>
                        {isCreator && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-bold flex items-center gap-1 border border-zinc-300 dark:border-zinc-700">
                            <Crown className="w-3 h-3" /> Creator
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{m.userEmail}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {/* Role Selector */}
                    {!isCreator && (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-zinc-900 dark:focus:border-white cursor-pointer"
                      >
                        <option value="member">Member</option>
                        <option value="co-admin">Co-Admin</option>
                      </select>
                    )}

                    {/* Kick Button */}
                    {!isCreator && (
                      <button
                        onClick={() => handleKick(m.id)}
                        className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
                        title="Remove member"
                      >
                        <UserX className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 3: Campaign Settings Form */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Campaign Title
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              />
            </div>

            {/* Day-by-Day Multi-slot Schedule Builder */}
            <div className="pt-2">
              <ScheduleBuilder
                schedule={schedule}
                onChange={(updated) => setSchedule(updated)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" /> Max Member Capacity
                </span>
                <span className="text-zinc-950 dark:text-white font-bold">{maxMembers} members</span>
              </label>
              <input
                type="number"
                min="2"
                max="100"
                value={maxMembers}
                onChange={(e) => setMaxMembers(parseInt(e.target.value) || 10)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-950 dark:text-white"
              />
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              {/* Delete Campaign (Only for Creator) */}
              {user?.id === campaign.adminId ? (
                <button
                  type="button"
                  onClick={handleDeleteCampaign}
                  className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Campaign</span>
                </button>
              ) : <div></div>}

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>

          </form>
        )}

      </div>
    </div>
  );
};

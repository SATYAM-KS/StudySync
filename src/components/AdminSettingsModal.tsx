import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Campaign, CampaignMembership } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { CustomSelect } from './ui/CustomSelect.tsx';
import { NumberStepper } from './ui/NumberStepper.tsx';
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
    setStatusMessage('');

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
          maxMembers: Number(maxMembers)
        })
      });

      const data = await res.json();
      if (res.ok) {
        onCampaignUpdated(data);
        setStatusMessage('✓ Campaign settings updated successfully!');
      } else {
        console.error('Update failed:', data);
        setStatusMessage(`Error: ${data.error || 'Failed to save settings. Please try again.'}`);
      }
    } catch (err) {
      console.error('Save settings error:', err);
      setStatusMessage('Network error: Could not reach the server.');
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

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl glass-panel rounded-3xl shadow-2xl text-zinc-900 dark:text-zinc-100 flex flex-col animate-in fade-in zoom-in-95 duration-200" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
        
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-6 sm:px-8 pt-6 sm:pt-8">
        <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-white/[0.08] pb-4 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-black flex items-center justify-center shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-950 dark:text-white">Cohort Admin Controls</h2>
              <p className="text-xs text-zinc-400">Manage memberships, join requests, and cohort rules</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl glass-pill hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {statusMessage && (
          <div className="mb-4 p-3 rounded-xl glass-card text-zinc-900 dark:text-zinc-100 text-xs flex items-center justify-between">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage('')} className="text-zinc-950 dark:text-white font-bold cursor-pointer">×</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-zinc-200/60 dark:border-white/[0.08] pb-3 mb-6">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 cursor-pointer active:scale-95 ${
              activeTab === 'requests'
                ? 'bg-zinc-950 text-white dark:bg-white dark:text-black shadow-xs'
                : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white glass-pill'
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
        </div>{/* End fixed header */}

        {/* Scrollable Tab Content */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 pb-6 sm:pb-8">

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
                      <CustomSelect
                        value={m.role}
                        onChange={(val) => handleRoleChange(m.id, val)}
                        options={[
                          { value: 'member', label: 'Member' },
                          { value: 'co-admin', label: 'Co-Admin' }
                        ]}
                        size="sm"
                        className="w-32"
                      />
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



            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" /> Max Member Capacity
                </span>
                <span className="text-zinc-950 dark:text-white font-bold">{maxMembers} members</span>
              </label>
              <NumberStepper
                value={maxMembers}
                onChange={setMaxMembers}
                min={2}
                max={100}
                unit="members"
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

        </div>{/* End scrollable content */}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

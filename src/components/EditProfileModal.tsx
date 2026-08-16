import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { UserAvatar } from './UserAvatar.tsx';
import { 
  X, 
  User as UserIcon, 
  Target, 
  Save, 
  CheckCircle2,
  Upload,
  Trash2,
  Loader2,
  Code2,
  Terminal
} from 'lucide-react';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, token, updateProfile } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [studyGoal, setStudyGoal] = useState(user?.studyGoal || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [leetcodeUrl, setLeetcodeUrl] = useState(user?.leetcodeUrl || '');
  const [hackerrankUrl, setHackerrankUrl] = useState(user?.hackerrankUrl || '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be under 5MB.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.url);
      } else {
        const errData = await res.json().catch(() => ({}));
        setUploadError(errData.error || 'Failed to upload photo.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Upload connection error.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl(null);
    setUploadError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    const success = await updateProfile({
      name: name.trim(),
      studyGoal: studyGoal.trim(),
      bio: bio.trim(),
      leetcodeUrl: leetcodeUrl.trim(),
      hackerrankUrl: hackerrankUrl.trim(),
      avatarUrl: avatarUrl || ''
    });

    setIsSaving(false);
    if (success) {
      setSavedSuccess(true);
      window.dispatchEvent(new CustomEvent('profile:updated'));
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 800);
    }
  };

  const modalContent = (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60 dark:bg-black/75 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg max-h-[90vh] sm:max-h-[85vh] flex flex-col glass-panel rounded-3xl shadow-2xl text-zinc-900 dark:text-zinc-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Pinned Header */}
        <div className="shrink-0 flex items-center justify-between p-5 sm:p-6 border-b border-zinc-200/60 dark:border-white/[0.08] glass-nav z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold shadow-xs">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-950 dark:text-white">Profile Settings</h3>
              <p className="text-xs text-zinc-400">Update your public study goal, bio, and avatar</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl glass-pill hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition cursor-pointer active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="profile-edit-form" onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {/* Avatar Section: Custom Upload & Initials Preview */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Profile Avatar
            </label>
            
            <div className="flex items-center space-x-4 p-3.5 rounded-2xl glass-card">
              {/* Avatar Preview */}
              <div className="relative shrink-0">
                <UserAvatar
                  name={name || 'User'}
                  avatarUrl={avatarUrl}
                  size="xl"
                  rounded="2xl"
                />
              </div>

              {/* Upload & Remove Controls */}
              <div className="flex-1 space-y-1.5 min-w-0">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="hidden"
                />

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs shadow-sm flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Photo</span>
                      </>
                    )}
                  </button>

                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="px-3 py-1.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition cursor-pointer flex items-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                  {avatarUrl 
                    ? 'Custom photo uploaded. Click remove to use initials.' 
                    : 'No photo uploaded. Your name initials will be displayed.'}
                </p>

                {uploadError && (
                  <p className="text-[11px] text-red-500 font-medium">{uploadError}</p>
                )}
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
            />
          </div>

          {/* Study Goal */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Current Accountability Target / Goal
            </label>
            <div className="relative">
              <Target className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={studyGoal}
                onChange={(e) => setStudyGoal(e.target.value)}
                placeholder="e.g. 515+ on MCAT, FAANG Prep, 4.0 GPA"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              Bio / Focus Track
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your study cohort about your study routine or focus areas..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-none"
            />
          </div>

          {/* LeetCode Profile */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-amber-500" />
                <span>LeetCode Profile</span>
              </label>
              <span className="text-[10px] text-zinc-400 font-medium">Visible on Leaderboard</span>
            </div>
            <div className="relative">
              <Code2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={leetcodeUrl}
                onChange={(e) => setLeetcodeUrl(e.target.value)}
                placeholder="https://leetcode.com/u/username or username"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              />
            </div>
          </div>

          {/* HackerRank Profile */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-500" />
                <span>HackerRank Profile</span>
              </label>
              <span className="text-[10px] text-zinc-400 font-medium">Visible on Leaderboard</span>
            </div>
            <div className="relative">
              <Terminal className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                value={hackerrankUrl}
                onChange={(e) => setHackerrankUrl(e.target.value)}
                placeholder="https://www.hackerrank.com/profile/username or username"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              />
            </div>
          </div>

        </form>

        {/* Pinned Footer Actions */}
        <div className="shrink-0 flex items-center justify-end space-x-3 p-4 sm:p-5 border-t border-zinc-200/60 dark:border-white/[0.08] glass-nav z-10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="profile-edit-form"
            disabled={isSaving || !name.trim()}
            className="px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-extrabold text-xs shadow-sm flex items-center space-x-2 transition disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : savedSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

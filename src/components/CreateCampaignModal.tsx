import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { Campaign } from '../types/index.ts';
import { X, Plus, Calendar, Users, Bookmark, RotateCcw, Sparkles } from 'lucide-react';
import { DatePicker } from './ui/DatePicker.tsx';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: (campaign: Campaign) => void;
}

const CATEGORIES = [
  'Computer Science & Tech',
  'Medical & Healthcare',
  'Finance & Business',
  'Academic Research',
  'Law & Bar Exam',
  'Language Learning',
  'Creative Writing & Arts',
  'General High Focus'
];

const DRAFT_KEY = 'study_campaign_draft_v2';

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, onCampaignCreated }) => {
  const { token } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextMonth);
  const [maxMembers, setMaxMembers] = useState(25);
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem(DRAFT_KEY);
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft.name) setName(draft.name);
          if (draft.description) setDescription(draft.description);
          if (draft.category) setCategory(draft.category);
          if (draft.startDate) setStartDate(draft.startDate);
          if (draft.endDate) setEndDate(draft.endDate);
          if (draft.maxMembers) setMaxMembers(draft.maxMembers);
          if (draft.isPublic !== undefined) setIsPublic(draft.isPublic);
          setHasDraft(true);
        }
      } catch (e) {
        console.warn('Could not load draft:', e);
      }
    }
  }, [isOpen]);

  const saveDraft = () => {
    try {
      const draftData = {
        name,
        description,
        category,
        startDate,
        endDate,
        maxMembers,
        isPublic,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      setHasDraft(true);
    } catch (e) {
      console.warn('Could not save draft:', e);
    }
  };

  const handleClose = () => {
    saveDraft();
    onClose();
  };

  const handleClearDraft = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    localStorage.removeItem(DRAFT_KEY);
    setName('');
    setDescription('');
    setCategory(CATEGORIES[0]);
    setStartDate(today);
    setEndDate(nextMonth);
    setMaxMembers(25);
    setHasDraft(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a cohort name');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          startDate,
          endDate,
          targetDailyHours: 4,
          maxMembers: Number(maxMembers),
          isPublic,
          bannerColor: 'from-zinc-800 to-zinc-900',
          tags: [category.split(' ')[0] || 'Focus', 'Cohort']
        })
      });

      if (res.ok) {
        localStorage.removeItem(DRAFT_KEY);
        const created = await res.json();
        onCampaignCreated(created);
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create cohort');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating cohort');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60 dark:bg-black/75 backdrop-blur-xl animate-in fade-in duration-200 select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-zinc-900 dark:text-zinc-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Pinned Modal Header */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold shadow-sm">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-zinc-950 dark:text-white">
                  Create Study Cohort
                </h2>
                {hasDraft && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 glass-pill px-2 py-0.5 rounded-md">
                    <Bookmark className="w-2.5 h-2.5" />
                    Draft Saved
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Peer accountability & flexible study hours
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {hasDraft && (
              <button
                type="button"
                onClick={handleClearDraft}
                className="hidden sm:flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer"
                title="Reset form and clear draft"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}

            <button 
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition cursor-pointer"
              title="Close & Save Draft"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" style={{ overscrollBehavior: 'contain' }}>
          
          {error && (
            <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs">
              {error}
            </div>
          )}

          {/* Campaign Name & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Cohort Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Algorithms & System Design"
                required
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Field / Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white cursor-pointer"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat} className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Description & Focus Topics
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Outline what members will focus on, daily expectations, and study materials..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white resize-none"
            />
          </div>

          {/* Dates & Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                Start & End Date
              </label>
              <div className="grid grid-cols-2 gap-2">
                <DatePicker
                  value={startDate}
                  onChange={(d) => setStartDate(d)}
                />
                <DatePicker
                  value={endDate}
                  onChange={(d) => setEndDate(d)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                  Max Member Capacity
                </span>
                <span className="text-zinc-950 dark:text-white font-bold">{maxMembers} members</span>
              </label>
              <input
                type="number"
                min={2}
                max={100}
                value={maxMembers}
                onChange={(e) => setMaxMembers(parseInt(e.target.value) || 25)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-950 dark:text-white"
              />
            </div>
          </div>

          {/* Daily Dynamic Routine Info Card */}
          <div className="p-4 rounded-2xl glass-card border border-white/10 flex items-start gap-3 text-xs text-zinc-400">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-zinc-200">Dynamic Daily Study Hours</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Members calibrate their daily goal each day: <strong>4h on college days</strong> and <strong>7h on off-days/holidays</strong>, completed whenever convenient.
              </p>
            </div>
          </div>

        </form>

        {/* Pinned Modal Footer */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur z-10">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Flexible <strong className="text-zinc-950 dark:text-white font-bold">4h / 7h</strong> daily targets
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition cursor-pointer"
            >
              Close & Save Draft
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Creating Cohort...' : 'Launch Cohort'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { Campaign } from '../types/index.ts';
import { X, Plus, Users, Bookmark, RotateCcw, Sparkles, Calendar } from 'lucide-react';
import { CustomSelect } from './ui/CustomSelect.tsx';
import { NumberStepper } from './ui/NumberStepper.tsx';

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

const DRAFT_KEY = 'study_campaign_draft_v3';

const getTodayDateString = () => new Date().toISOString().split('T')[0];
const getDefaultEndDateString = () => new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, onCampaignCreated }) => {
  const { token } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [startDate, setStartDate] = useState(getTodayDateString);
  const [endDate, setEndDate] = useState(getDefaultEndDateString);
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
    setStartDate(getTodayDateString());
    setEndDate(getDefaultEndDateString());
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
          startDate: startDate || getTodayDateString(),
          endDate: endDate || getDefaultEndDateString(),
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
                Peer accountability & flexible daily goals
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

          {/* Campaign Name */}
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
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-950 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white"
            />
          </div>

          {/* Start Date & End Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                <span>Start Date *</span>
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                <span>End Date *</span>
              </label>
              <input
                type="date"
                required
                min={startDate}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-950 dark:text-white focus:outline-none focus:border-zinc-900 dark:focus:border-white cursor-pointer"
              />
            </div>
          </div>

          {/* Category & Capacity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Field / Category
              </label>
              <CustomSelect
                value={category}
                onChange={setCategory}
                options={CATEGORIES}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
                  Max Member Capacity
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

          {/* Daily Dynamic Routine Info Card */}
          <div className="p-4 rounded-2xl glass-card border border-white/10 flex items-start gap-3 text-xs text-zinc-400">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-zinc-200">Flexible Daily Study Hours</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                No rigid schedules or fixed time windows. Members calibrate their goals each day: <strong>4h on college days</strong> and <strong>7h on off-days/holidays</strong>, studied at any time.
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

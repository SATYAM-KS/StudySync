import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Campaign, DaySchedule } from '../types/index.ts';
import { ScheduleBuilder } from './ScheduleBuilder.tsx';
import { 
  DEFAULT_WEEKLY_SCHEDULE, 
  calculateAverageDailyHours,
  calculateWeeklyHours
} from '../utils/schedule.ts';
import { X, Plus, Calendar, Users, Bookmark, RotateCcw } from 'lucide-react';
import { DatePicker } from './ui/DatePicker.tsx';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: (campaign: Campaign) => void;
}

const CATEGORIES = [
  'Medical & Healthcare',
  'Computer Science & Tech',
  'Finance & Business',
  'Academic Research',
  'Law & Bar Exam',
  'Language Learning',
  'Creative Writing & Arts',
  'General High Focus'
];

const DRAFT_KEY = 'study_campaign_draft_v1';

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, onCampaignCreated }) => {
  const { token } = useAuth();
  const modalRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  // Load initial draft from localStorage if available
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(nextMonth);
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_WEEKLY_SCHEDULE);
  const [maxMembers, setMaxMembers] = useState(15);
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [hasDraft, setHasDraft] = useState(false);

  // Restore draft when modal opens
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
          if (draft.schedule && Array.isArray(draft.schedule)) setSchedule(draft.schedule);
          if (draft.maxMembers) setMaxMembers(draft.maxMembers);
          if (draft.isPublic !== undefined) setIsPublic(draft.isPublic);
          setHasDraft(true);
        }
      } catch (e) {
        console.warn('Could not load draft:', e);
      }
    }
  }, [isOpen]);

  // Save draft helper
  const saveDraft = () => {
    try {
      const draftData = {
        name,
        description,
        category,
        startDate,
        endDate,
        schedule,
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
    setSchedule(DEFAULT_WEEKLY_SCHEDULE);
    setMaxMembers(15);
    setHasDraft(false);
  };

  if (!isOpen) return null;

  const autoTargetDailyHours = calculateAverageDailyHours(schedule);
  const weeklyHours = calculateWeeklyHours(schedule);

  // Derive default fallback window from the first enabled day's first slot
  const firstEnabledDay = schedule.find(d => d.enabled && d.slots.length > 0);
  const fallbackStart = firstEnabledDay?.slots[0]?.startTime || '07:00';
  const fallbackEnd = firstEnabledDay?.slots[firstEnabledDay.slots.length - 1]?.endTime || '22:00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a campaign name');
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
          dailyStartTime: fallbackStart,
          dailyEndTime: fallbackEnd,
          targetDailyHours: autoTargetDailyHours,
          schedule,
          maxMembers: Number(maxMembers),
          isPublic,
          bannerColor: 'from-zinc-800 to-zinc-900',
          tags: [category.split(' ')[0] || 'Focus', 'Cohort']
        })
      });

      if (res.ok) {
        // Clear saved draft on successful submission
        localStorage.removeItem(DRAFT_KEY);
        const created = await res.json();
        onCampaignCreated(created);
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create campaign');
      }
    } catch (err: any) {
      setError(err.message || 'Error creating campaign');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 dark:bg-black/75 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={(e) => {
        // If clicked on backdrop overlay (outside dialog)
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[90vh] sm:max-h-[86vh] flex flex-col glass-panel rounded-3xl shadow-2xl text-zinc-900 dark:text-zinc-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        
        {/* Pinned Modal Header */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-5 border-b border-zinc-200/60 dark:border-white/[0.08] glass-nav z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-black flex items-center justify-center font-bold shadow-xs">
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
                Auto-saves your changes as a draft
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

            {/* Pinned Top-Right Cross Button */}
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
                Campaign Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. USMLE Step 1 Sprint 2026"
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
              Description & Study Goals
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
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
                onChange={(e) => setMaxMembers(parseInt(e.target.value) || 10)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-zinc-950 dark:text-white"
              />
            </div>
          </div>

          {/* Customizable Day-by-Day Multi-slot Schedule Builder */}
          <div className="pt-1">
            <ScheduleBuilder
              schedule={schedule}
              onChange={(updated) => setSchedule(updated)}
            />
          </div>

        </form>

        {/* Pinned Modal Footer */}
        <div className="shrink-0 flex items-center justify-between p-4 sm:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur z-10">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            Target: <strong className="text-zinc-950 dark:text-white font-bold">{autoTargetDailyHours}h/day</strong> ({weeklyHours}h/wk)
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
              {isSubmitting ? 'Creating Campaign...' : 'Launch Campaign'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
